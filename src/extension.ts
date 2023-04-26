import * as fs from 'fs'

import * as vscode from 'vscode'
import { extensionCtx, getExtensionSetting, getExtensionSettingId, registerExtensionCommand } from 'vscode-framework'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { doPatch, removeAllPatches } from './patch'
import { parseTree, findNodeAtOffset, getNodePath, getLocation } from 'jsonc-parser'
import { join } from 'path'

export const activate = async () => {
    const getNewConfig = () => {
        return {
            disableProviders: getExtensionSetting('disableProviders'),
            ignoreMessages: getExtensionSetting('ignoreMessages'),
            version: extensionCtx.extension.packageJSON.version,
        }
    }
    const updateConfig = async (restartExtHost = false) => {
        const config = getNewConfig()
        process.env.VSC_CONTROL_EXT_CONFIG = JSON.stringify(config)
        await patchNow(config, restartExtHost)
    }

    watchExtensionSettings(['disableProviders', 'ignoreMessages'], async () => {
        await updateConfig()
    })

    // #region commands
    registerExtensionCommand('forcePatch', () => updateConfig())
    registerExtensionCommand('removeAllPatches', () => {
        removeAllPatches()
    })
    registerExtensionCommand('logExtensionsActivationOrder', () => {
        console.log(JSON.parse(process.env.VSC_EXT_ACT_ORDER ?? 'null'))
    })
    // #endregion

    vscode.languages.registerCompletionItemProvider(
        {
            pattern: '**/settings.json',
        },
        {
            provideCompletionItems(document, position, token, context) {
                const root = parseTree(document.getText(), [])
                if (!root) {
                    return
                }
                const node = findNodeAtOffset(root, document.offsetAt(position))
                if (node?.type !== 'string') {
                    return
                }

                let path = getNodePath(node)
                const pathMatches = (compare: string[], useStartsWith = false) => {
                    if (!useStartsWith && compare.length !== path.length) {
                        return undefined
                    }
                    return compare.every((item, i) => item === '*' || item === path[i])
                }
                if (
                    (pathMatches([getExtensionSettingId('overrideActivationEvents'), '*']) && node.parent?.type === 'property') ||
                    pathMatches([getExtensionSettingId('disableProviders'), '*', '*'])
                ) {
                    const start = document.positionAt(node.offset + 1)
                    const end = document.positionAt(node.offset + 1 + node.length - 2)
                    const range = new vscode.Range(start, end)
                    return vscode.extensions.all.map(ext => ({
                        label: ext.id,
                        detail: ext.packageJSON.displayName,
                        filterText: `${ext.id}${ext.packageJSON.displayName}`,
                        range,
                    }))
                }
                return []
            },
        },
    )

    // Main activation actions

    let reloadExtHostExtensions = false
    for (const [id, expected] of Object.entries(getExtensionSetting('overrideActivationEvents'))) {
        const ext = vscode.extensions.getExtension(id)
        if (!ext) continue
        const { activationEvents = [] } = ext.packageJSON
        if (JSON.stringify(expected.sort()) !== JSON.stringify(activationEvents.sort())) {
            const packageJson = join(ext.extensionPath, 'package.json')
            fs.writeFileSync(
                packageJson,
                JSON.stringify(
                    {
                        ...ext.packageJSON,
                        activationEvents: expected,
                    },
                    undefined,
                    4,
                ),
            )
            reloadExtHostExtensions = true
        }
    }
    if (reloadExtHostExtensions) {
        vscode.window.showInformationMessage('Restarting extension host as activation events were patched...')
        await vscode.commands.executeCommand('workbench.action.restartExtensionHost')
        return
    }

    const extVersion = extensionCtx.extension.packageJSON.version
    const currentLoadedConfig = process.env.VSC_CONTROL_EXT_CONFIG && JSON.parse(process.env.VSC_CONTROL_EXT_CONFIG)
    const patchedVersion = currentLoadedConfig?.version
    if (patchedVersion && patchedVersion === extVersion) {
        if (process.env.VSC_CONTROL_EXT_CONFIG !== JSON.stringify(getNewConfig())) await updateConfig()
    } else {
        if (
            !getExtensionSetting('autoApplyPatch') &&
            !(await vscode.window.showWarningMessage('Extensions Control needs to apply VS Code patch', 'Patch now'))
        ) {
            return
        }
        if (patchedVersion && patchedVersion !== extVersion) {
            // force save unpatched version after update
            removeAllPatches()
        }
        vscode.window.showInformationMessage('Patching & restarting extension host...')
        setTimeout(async () => {
            await updateConfig(true)
        }, 0)
    }
}

async function patchNow(config, restart: boolean) {
    await doPatch(config)
    await vscode.commands.executeCommand('fixChecksums.apply')
    if (!restart) return
    await vscode.commands.executeCommand('workbench.action.restartExtensionHost')
}
