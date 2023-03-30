import * as vscode from 'vscode'

import * as fs from 'fs'

import { SourceMapConsumer, RawSourceMap } from 'source-map'
import got from 'got'
import { join } from 'path'

const injectMarkers = ['/*evscepS*/', '/*evscepE*/'] as const
const identifierRegex = /^[\w\d]+/i

const basePath = vscode.env.appRoot

const fileToPatch = join(basePath, 'out/vs/workbench/api/node/extensionHostProcess.js')

const doPatchInner = async (config: any) => {
    let text = fs.readFileSync(fileToPatch, 'utf8')
    const backupFile = join(fileToPatch, '../extensionHostProcess.backup.js')
    if (!fs.existsSync(backupFile)) fs.writeFileSync(backupFile, text, 'utf8')
    text = cleanPatchesFromText(text)

    const mapContent = JSON.parse(await getSourceMapsFromText(fileToPatch, text)) as RawSourceMap
    if (!mapContent.sourcesContent) throw new Error('No sourcesContent')

    const c = await new SourceMapConsumer(mapContent)

    injectScriptContents(text.indexOf('function(){') + 'function(){'.length, `process.env.VSC_CONTROL_EXT_CONFIG=${JSON.stringify(JSON.stringify(config))};`)

    const findOffset = (text: string, needles: string[]) => {
        let prevOffset = -1
        for (const p of needles) {
            prevOffset = text.indexOf(p, prevOffset)
            if (prevOffset === -1) throw new Error(`Cannot find ${p} in source`)
        }

        return prevOffset
    }

    function getSourceMap(fileSource: string) {
        const sourceIndex = mapContent.sources.findIndex(source => source.endsWith(fileSource))
        if (sourceIndex === -1) throw new Error('Source file not found')

        const originalContent = mapContent.sourcesContent![sourceIndex]
        return { originalContent, sourceIndex }
    }

    const getGeneratedOffset = (fileSource: string, offsetOrNeedles: number | string[]) => {
        const { originalContent, sourceIndex } = getSourceMap(fileSource)

        const pos = getLineCharacterPosition(
            typeof offsetOrNeedles === 'number' ? offsetOrNeedles : findOffset(originalContent!, offsetOrNeedles),
            originalContent!,
        )

        let result: number | undefined
        // probably not that effective
        c.eachMapping(e => {
            if (e.source !== mapContent.sources[sourceIndex]) return
            if (e.originalLine !== pos[0] + 1) return
            if (e.originalLine === pos[0] + 1 && e.originalColumn === pos[1]) {
                // console.log(1, originalContent.split('\n')[pos[0]].slice(e.originalColumn))
                result = positionToOffset(text, e.generatedLine - 1, e.generatedColumn)
            }
        })
        if (result === undefined) throw new Error("Couldn't find generated position")
        return result
    }

    const getFunctionIdentifiers = <T extends string[]>(fileSource: string, functionName: string, identifiers: T): T => {
        const getGeneratedIdentifier = (needles: string[]) => {
            const outputOffset = getGeneratedOffset(fileSource, [functionName, ...needles])
            const contentAfter = text.slice(outputOffset)
            const identifier = contentAfter.match(identifierRegex)
            if (!identifier) {
                throw new Error('Matched content not identifier')
            }
            return identifier[0]
        }

        return identifiers.map(identifier => getGeneratedIdentifier([identifier])) as T
    }

    const genIdentifiers = getFunctionIdentifiers('src/vs/workbench/api/common/extHostLanguageFeatures.ts', '_withAdapter', [
        'callback',
        'fallbackValue',
        'data',
    ])

    const [callbackV, fallbackV, dataV] = genIdentifiers

    let injectStart = text.slice(0, text.indexOf('INVOKE provider')).lastIndexOf(';') + ';'.length

    const injectCode = /* ts */ `
        const ___configIgnore = _c => _c && Object.entries(_c).find(([p, ids]) => ${callbackV}.toString().includes(p))?.[1].some(v => v === '*' || v === ${dataV}.extension.identifier.value);
        if (___configIgnore(JSON.parse(process.env.VSC_CONTROL_EXT_CONFIG).disableProviders)) return ${fallbackV};
    `

    injectScriptContents(injectStart, injectCode)

    const showMessageOffset = text.indexOf('$showMessage(') + '$showMessage('.length
    // of course we could easily get original names from sourceMaps, but this one was just faster to write
    const identifiers = text.slice(showMessageOffset).match(/^([\w\d]+),([\w\d]+),([\w\d]+)/i)!
    const [, severityV, messageV, optionsV] = identifiers
    const insertShowPos = text.slice(0, showMessageOffset).lastIndexOf('return')
    injectScriptContents(
        insertShowPos,
        /* ts */ `
            const ___configIgnore = _c => {
                for (const _i of _c) {
                    if (Object.entries(_i).every(([_k, _v]) => {
                        switch (_k) {
                            case 'extension': return _v === ${optionsV}.source.identifier.value;
                            case 'severity': return _v === ${severityV};
                            case 'regex': return new RegExp(_v, _i.regexCaseInsensitive ? 'i' : '').test(${messageV});
                            case 'regexCaseInsensitive': return true;
                        }
                    })) return true;
                }
            };
            if (___configIgnore(JSON.parse(process.env.VSC_CONTROL_EXT_CONFIG).ignoreMessages)) return Promise.resolve(undefined);
    `,
    )

    // const [activationEventV, startupV, activateExtMethodV] = getFunctionIdentifiers(
    //     'src/vs/workbench/api/common/extHostExtensionActivator.ts',
    //     'async activateByEvent',
    //     ['activationEvent', 'startup', '_activateExtensions'],
    // )
    // const insertExtOrder = findOffset(text, ['async activateByEvent', 'getExtensionDescriptionsForActivationEvent', ';']) + 1
    // const [activateExtensionsV] = text.slice(text.slice(0, insertExtOrder).lastIndexOf('const ') + 'const '.length).match(identifierRegex)!
    // there should be code to allow adjust sequence of loading extensions (eg to load some extension BEFORE another)
    // but it seems affects performance really bad, so need to figure out things
    //
    // const actNow = ${activateExtensionsV}.find(a => a.id === 'zardoy.extensions-control');
    // const _d = Date.now();
    // if (actNow) {
    //     ${activateExtensionsV}.splice(${activateExtensionsV}.indexOf(actNow), 1);
    //     await this.${activateExtMethodV}([{
    //         id: actNow.identifier,
    //         reason: {
    //             startup: ${startupV},
    //             activationEvent: ${activationEventV},
    //             extensionId: actNow.identifier
    //         }
    //     }]);
    // }
    // injectScriptContents(
    //     insertExtOrder,
    //     /* ts */ `
    //     const __prevObj = process.env.VSC_EXT_ACT_ORDER ? JSON.parse(process.env.VSC_EXT_ACT_ORDER) : {};
    //     __prevObj[${activationEventV}] ??= [];
    //     __prevObj[${activationEventV}].push(...${activateExtensionsV}.map(e => e.id));
    //     process.env.VSC_EXT_ACT_ORDER = JSON.stringify(__prevObj);
    //     `,
    // )
    // const __getS = e => __order.includes(e) ? __order.length - 1 - __order.indexOf(e) : -1;
    // ${activateExtensionsV}.sort((a, b) => __getS(b.id) - __getS(a.id));

    fs.writeFileSync(fileToPatch, text, 'utf8')

    function injectScriptContents(offset: number, inject: string) {
        if (!inject) return
        text =
            text.slice(0, offset) +
            injectMarkers[0] +
            inject
                .split('\n')
                .map(line => line.trim())
                .join('')
                .trim() +
            injectMarkers[1] +
            text.slice(offset)
    }

    function injectScript(marker: string, getInject: (stringBefore: string, stringAfter: string) => string) {
        const start = text.indexOf(marker)
        const inject = getInject(text.slice(0, start), text)
        if (!inject) return

        injectScriptContents(start, inject)
    }
}

function getLineCharacterPosition(offset: number, text: string): [number, number] {
    let lineNumber = 0
    let characterNumber = 0

    for (let i = 0; i < offset; i++) {
        if (text[i] === '\n') {
            lineNumber++
            characterNumber = 0
        } else {
            characterNumber++
        }
    }

    return [lineNumber, characterNumber]
}

function positionToOffset(text: string, line: number, character: number): number | undefined {
    let lineIndex = 0
    let charIndex = 0

    for (let i = 0; i < text.length; i++) {
        // check if we've reached the desired line and character position
        if (lineIndex === line && charIndex === character) {
            return i
        }

        // increment our line/character index as we iterate over the text
        if (text[i] === '\n' || text[i] === '\r\n') {
            lineIndex++
            charIndex = 0
        } else {
            charIndex++
        }
    }

    // return the length of the text if the position is not found
    return undefined
}

export const doPatch = async config => {
    try {
        await doPatchInner(config)
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to patch: ${err.message ?? err}`)
        throw err
    }
}

const cleanPatchesFromText = (text: string) => {
    let pos!: number
    while ((pos = text.indexOf(injectMarkers[0])) !== -1) {
        text = text.slice(0, pos) + text.slice(text.indexOf(injectMarkers[1], pos) + injectMarkers[1].length)
    }

    return text
}

export const removeAllPatches = () => {
    const text = fs.readFileSync(fileToPatch, 'utf8')

    fs.writeFileSync(fileToPatch, cleanPatchesFromText(text), 'utf8')
}

async function getSourceMapsFromText(filePath: string, text: string) {
    const smNeedle = '//# sourceMappingURL='
    const sourcemapUrl = text.slice(text.lastIndexOf(smNeedle) + smNeedle.length).slice()
    // todo write to fs (cache) for subseq offline patching
    const { body } = await got(sourcemapUrl, {
        responseType: 'text',
    })
    return body
}
