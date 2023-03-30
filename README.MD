# VS Code Extensions Control

Extremely powerful extension for VS Code to control (configure) providers of other installed extensions!

Currently, it can only disable specific extension providers for now.

### Usage Examples

Usually you want to disable providers that misbehave or slows down your editing experience and don't have a setting to disable provider.

Let's say you have extension with id `styled-components.vscode-styled-components` installed. You don't want to get completions from this extension, but you still want to preserve it's functionality (so you can't just disable it!).

```json
{
    "extensionsControl.disableProviders": {
        "provideCompletionItems": [
            "styled-components.vscode-styled-components",
        ],
    },
}
```

This will make vscode stop asking `styled-components.vscode-styled-components` extension for completion items. For some extensions it can even improve performance.

And works in the same way for hovers, definitions and so on...

Hint: You can quickly enable/disable specific provider with keybinding with Setting Toggle extension.

Obviously you need to be careful with this power or you can blame yourself in future. Also it will never be supported in the web as **it makes VS Code installation patching**. On first patch it requires internet connection to download vscode sourcemaps.

#### Ignore Extension Messages

```json
"extensionsControl.ignoreMessages": [
    // hide all extension messages that contains text "was updated"
    {
        "regex": "was updated"
    },
],
```

## Roadmap

- add filters to existing functionality (eg globs)
- add a way to use middleware script
- override ext activationEvents (easy) - motivation
- [x] disable messages (ext or regex)
- ~~disable diagnostics (ext or regex)~~
- add script to disable ext without reload

> Note: if vscode window crahes instantly, you can restore you can restore .backup file in *%localappdata%\Programs\Microsoft VS Code\resources\app\out\vs\workbench\api\node*
