import * as vscode from 'vscode'
import { getExtensionSetting } from 'vscode-framework'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { doPatch } from './patch'

export const activate = async () => {
    const upConfig = () => {
        process.env.VSC_CONTROL_EXT_CONFIG = JSON.stringify({ disableProviders: getExtensionSetting('disableProviders') })
    }

    watchExtensionSettings(['disableProviders'], upConfig)

    if (process.env.VSC_CONTROL_EXT_CONFIG) {
        upConfig()
    } else {
        if (
            !getExtensionSetting('autoApplyPatch') &&
            !(await vscode.window.showWarningMessage('Extensions Control needs to apply VS Code patch', 'Patch now'))
        ) {
            return
        }
        vscode.window.showInformationMessage('Patching & restarting extension host...')
        setTimeout(async () => {
            try {
                await doPatch()
                await vscode.commands.executeCommand('fixChecksums.apply')
                await vscode.commands.executeCommand('workbench.action.restartExtensionHost')
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to apply patch: ${err.message ?? err}`)
                throw err
            }
        }, 0)
    }
}
