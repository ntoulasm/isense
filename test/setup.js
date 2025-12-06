const path = require('path');

// Setup global test configuration
global.TEST_ROOT = __dirname;
global.SERVER_ROOT = path.join(__dirname, '..', 'server', 'src');

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
}));

// Mock typescript for testing
const typescript = require('typescript');
global.ts = typescript;

// Test timeout
jest.setTimeout(10000);
