const vscode = require('vscode')

exports.activate = () => {
    console.log('Testing extension activated')
    vscode.languages.registerCodeActionsProvider('*', {
        provideCodeActions() {
            console.log('Testing extension code action provider called')
        },
    })
    // semantic highlighting would be also called
    vscode.window.showWarningMessage('Hi! I am activated!')
}
