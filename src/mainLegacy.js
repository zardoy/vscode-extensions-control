const vscode = require('vscode')

exports.activate = () => {
    const config = vscode.workspace.getConfiguration('').get('extensionsControl')
    console.log('control: apply config', config)
    process.env.VSC_CONTROL_EXT_CONFIG = JSON.stringify(config)
}
