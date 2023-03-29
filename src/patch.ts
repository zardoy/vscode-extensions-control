import * as vscode from 'vscode'

import * as fs from 'fs'

import { SourceMapConsumer, RawSourceMap } from 'source-map'
import got from 'got'
import { join } from 'path'

const injectMarkers = ['/*evscepS*/', '/*evscepE*/'] as const
const identifierRegex = /^[\w\d]+/i

const basePath = vscode.env.appRoot

const patchFile = 'out/vs/workbench/api/node/extensionHostProcess.js'

export const doPatch = async () => {
    const fileToPatch = join(basePath, patchFile)
    let text = fs.readFileSync(fileToPatch, 'utf8')
    const startInsertConfig = text.indexOf('function(){') + 'function(){'.length
    text = text.slice(0, startInsertConfig) + injectMarkers[0] + 'process.env.VSC_CONTROL_EXT_CONFIG="{}";' + injectMarkers[1] + text.slice(startInsertConfig)
    const smNeedle = '//# sourceMappingURL='
    const sourcemapUrl = text.slice(text.lastIndexOf(smNeedle) + smNeedle.length).slice()
    // todo write to fs (cache) for subseq offline patching
    const { body } = await got(sourcemapUrl, {
        responseType: 'text',
    })

    const mapContent = JSON.parse(body) as RawSourceMap
    if (!mapContent.sourcesContent) throw new Error('No sourcesContent')

    const c = await new SourceMapConsumer(mapContent)

    const getFunctionIdentifiers = (fileSource: string, functionName: string, identifiers: string[]) => {
        const sourceIndex = mapContent.sources.findIndex(source => source.endsWith(fileSource))

        if (sourceIndex === -1) throw new Error('Source file not found')

        const originalContent = mapContent.sourcesContent![sourceIndex]

        const findOffset = (needles: string[]) => {
            let prevOffset = -1
            for (const p of needles) {
                prevOffset = originalContent!.indexOf(p, prevOffset)
                if (prevOffset === -1) throw new Error(`Cannot find ${p} in source`)
            }

            return prevOffset
        }

        const getGeneratedIdentifier = (needles: string[]) => {
            const pos = getLineCharacterPosition(findOffset([functionName, ...needles]), originalContent!)

            let result: string | undefined

            // probably not that effective
            c.eachMapping(e => {
                if (e.source !== mapContent.sources[sourceIndex]) return
                if (e.originalLine === pos[0] + 1 && e.originalColumn === pos[1]) {
                    // console.log(1, originalContent.split('\n')[pos[0]].slice(e.originalColumn))
                    const contentAfter = text.split('\n')[e.generatedLine - 1]!.slice(e.generatedColumn)
                    const identifier = contentAfter.match(identifierRegex)
                    if (!identifier) throw new Error('Matched content not identifier')
                    result = identifier[0]
                    // console.log(3, e.originalColumn)
                }
            })

            return result
        }

        return identifiers.map(identifier => getGeneratedIdentifier([identifier]))
    }

    const genIdentifiers = getFunctionIdentifiers('src/vs/workbench/api/common/extHostLanguageFeatures.ts', '_withAdapter', [
        'callback',
        'fallbackValue',
        'data',
    ])

    const [callbackV, fallbackV, dataV] = genIdentifiers

    let injectStart = text.slice(0, text.indexOf('INVOKE provider')).lastIndexOf(';') + ';'.length

    if (text.slice(injectStart).startsWith(injectMarkers[1])) {
        const endMarkerPos = injectStart
        injectStart = text.slice(0, injectStart).lastIndexOf(injectMarkers[0])
        text = text.slice(0, injectStart) + text.slice(endMarkerPos + injectMarkers[1].length)
    }

    const injectCode = /* ts */ `
const ___configIgnore = c => c && Object.entries(c).find(([p, ids]) => ${callbackV}.toString().includes(p))?.[1].some(v => v === '*' || v === ${dataV}.extension.identifier.value);
if (___configIgnore(JSON.parse(process.env.VSC_CONTROL_EXT_CONFIG).disableProviders)) return ${fallbackV};
    `
        .replaceAll(/\n/g, '')
        .trim()

    text = text.slice(0, injectStart) + injectMarkers[0] + injectCode + injectMarkers[1] + text.slice(injectStart)

    fs.writeFileSync(fileToPatch, text, 'utf8')

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
}
