import * as vscode from 'vscode'
import { extensionCtx, getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { doPatch, removeAllPatches } from './patch'

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

    // Main activation actions

    // todo continue impl
    // for (const [id, expected] of Object.entries(getExtensionSetting('overrideActivationEvents'))) {
    // }

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
