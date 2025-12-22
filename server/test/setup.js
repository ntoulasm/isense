const path = require('path');

// Setup global test configuration
global.TEST_ROOT = __dirname;
global.SERVER_ROOT = path.join(__dirname, '..', 'src');

// Mock vscode-languageserver for testing
jest.mock('vscode-languageserver', () => ({
    createConnection: jest.fn(() => ({
        onInitialize: jest.fn(),
        onInitialized: jest.fn(),
        onDidChangeConfiguration: jest.fn(),
        onDidChangeWatchedFiles: jest.fn(),
        onDidOpenTextDocument: jest.fn(),
        onDidChangeTextDocument: jest.fn(),
        onDidCloseTextDocument: jest.fn(),
        onHover: jest.fn(),
        onCompletion: jest.fn(),
        onCompletionResolve: jest.fn(),
        onSignatureHelp: jest.fn(),
        onDefinition: jest.fn(),
        onDocumentSymbol: jest.fn(),
        onCodeAction: jest.fn(),
        listen: jest.fn(),
        console: {
            log: jest.fn(),
            error: jest.fn(),
        },
        client: {
            register: jest.fn(),
        },
        workspace: {
            onDidChangeWorkspaceFolders: jest.fn(),
        },
    })),
    ProposedFeatures: {
        all: {},
    },
    TextDocumentSyncKind: {
        Incremental: 2,
    },
    DidChangeConfigurationNotification: {
        type: 'workspace/didChangeConfiguration',
    },
    CompletionItemKind: {
        Text: 1,
        Method: 2,
        Function: 3,
        Constructor: 4,
        Field: 5,
        Variable: 6,
        Class: 7,
        Interface: 8,
        Module: 9,
        Property: 10,
        Unit: 11,
        Value: 12,
        Enum: 13,
        Keyword: 14,
        Snippet: 15,
        Color: 16,
        File: 17,
        Reference: 18,
    },
    DiagnosticSeverity: {
        Error: 1,
        Warning: 2,
        Information: 3,
        Hint: 4,
    },
    DiagnosticTag: {
        Unnecessary: 1,
        Deprecated: 2,
    },
    ParameterInformation: {
        create: (label, documentation) => ({ label, documentation }),
    },
    SignatureInformation: {
        create: (label, documentation, ...parameters) => ({
            label,
            documentation,
            parameters,
        }),
    },
    CodeAction: {
        create: (title, kind) => ({ title, kind }),
    },
    CodeActionKind: {
        QuickFix: 'quickfix',
        Refactor: 'refactor',
        RefactorExtract: 'refactor.extract',
        RefactorInline: 'refactor.inline',
        RefactorRewrite: 'refactor.rewrite',
        Source: 'source',
        SourceOrganizeImports: 'source.organizeImports',
        SourceFixAll: 'source.fixAll',
    },
    TextEdit: {
        replace: (range, newText) => ({ range, newText }),
        insert: (position, newText) => ({
            range: { start: position, end: position },
            newText,
        }),
        del: range => ({ range, newText: '' }),
    },
    Range: {
        create: (start, end) => ({ start, end }),
    },
    Position: {
        create: (line, character) => ({ line, character }),
    },
    Location: {
        create: (uri, range) => ({ uri, range }),
    },
    SymbolKind: {
        File: 1,
        Module: 2,
        Namespace: 3,
        Package: 4,
        Class: 5,
        Method: 6,
        Property: 7,
        Field: 8,
        Constructor: 9,
        Enum: 10,
        Interface: 11,
        Function: 12,
        Variable: 13,
        Constant: 14,
        String: 15,
        Number: 16,
        Boolean: 17,
        Array: 18,
        Object: 19,
        Key: 20,
        Null: 21,
        EnumMember: 22,
        Struct: 23,
        Event: 24,
        Operator: 25,
        TypeParameter: 26,
    },
    DocumentSymbol: {
        create: (name, detail, kind, range, selectionRange, children) => ({
            name,
            detail,
            kind,
            range,
            selectionRange,
            children,
        }),
    },
    Diagnostic: {
        create: (
            range,
            message,
            severity,
            code,
            source,
            relatedInformation
        ) => ({
            range,
            message,
            severity,
            code,
            source,
            relatedInformation,
        }),
    },
}));

// Mock typescript for testing
const typescript = require('typescript');
global.ts = typescript;

// Test timeout
jest.setTimeout(10000);
