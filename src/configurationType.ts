type ProviderType =
    | 'provideDocumentSymbols'
    | 'provideCodeLenses'
    | 'resolveCodeLens'
    | 'provideDefinition'
    | 'provideDeclaration'
    | 'provideImplementation'
    | 'provideTypeDefinition'
    | 'provideHover'
    | 'provideEvaluatableExpression'
    | 'provideInlineValues'
    | 'provideDocumentHighlights'
    | 'provideReferences'
    | 'provideCodeActions'
    | 'resolveCodeAction'
    | 'provideDocumentFormattingEdits'
    | 'provideDocumentRangeFormattingEdits'
    | 'provideOnTypeFormattingEdits'
    | 'provideWorkspaceSymbols'
    | 'resolveWorkspaceSymbol'
    // | 'releaseWorkspaceSymbols'
    | 'provideRenameEdits'
    | 'resolveRenameLocation'
    | 'provideDocumentSemanticTokens'
    // | 'releaseDocumentSemanticColoring'
    | 'provideDocumentRangeSemanticTokens'
    | 'provideCompletionItems'
    | 'resolveCompletionItem'
    // | 'releaseCompletionItems'
    | 'provideInlineCompletions'
    | 'provideSignatureHelp'
    // | 'releaseSignatureHelp'
    | 'provideInlayHints'
    | 'resolveInlayHint'
    | 'releaseHints'
    | 'provideLinks'
    | 'resolveLink'
    // | 'releaseLinks'
    | 'provideColors'
    | 'provideColorPresentations'
    | 'provideFoldingRanges'
    | 'provideSelectionRanges'
    | 'provideCallsTo'
    | 'provideCallsFrom'
    | 'provideSupertypes'
    | 'provideSubtypes'
    | 'prepareDocumentPaste'
    | 'providePasteEdits'

export type Configuration = {
    /**
     * @default true
     */
    autoApplyPatch: boolean
    disableProviders: {
        [provider in ProviderType]?: string[]
    }
}
