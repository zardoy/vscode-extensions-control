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
    /**
     * @default {}
     */
    disableProviders: {
        [provider in ProviderType]?: string[]
    }
    /**
     * @default {}
     */
    // overrideActivationEvents: {
    //     [id: string]: string[]
    // }
    /**
     * @default []
     */
    ignoreMessages: {
        regex?: string
        /** @default false */
        regexCaseInsensitive?: boolean
        /**
         * Full extension id to filter
         */
        extension?: string
        severity?: 0 | 1 | 2 | 3
    }[]
}
