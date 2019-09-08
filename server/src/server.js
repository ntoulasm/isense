const Utility = require('./utility/utility');
const Symbol = require('./utility/symbol');
const SymbolTable = require('./utility/symbol_table');
const Analyzer = require('./analyzer/analyzer');

const vscodeLanguageServer = require('vscode-languageserver');
const ts = require('typescript');

const connection = vscodeLanguageServer.createConnection(vscodeLanguageServer.ProposedFeatures.all);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
const asts = {};
const symbolTables = {};


connection.onInitialize((params) => {

	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	return {
		capabilities: {
			textDocumentSync: vscodeLanguageServer.TextDocumentSyncKind.Incremental,
			hoverProvider: "true",
			signatureHelpProvider: {
				triggerCharacters: ['(', ',']
			},
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.']
			},
			documentSymbolProvider: true
		}
	};

});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(vscodeLanguageServer.DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;

const documentSettings = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = (change.settings.languageServerExample || defaultSettings);
	}
});

function getDocumentSettings(resource) {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

/**
 * @param {ts.SourceFile} ast 
 */
async function clearDiagnostics(ast) {
	connection.sendDiagnostics({
		uri: ast.fileName,
		diagnostics: []
	});
}

/**
 * @param {ts.SourceFile} ast
 */
async function provideDiagnostics(ast) {

	const diagnostics = [];

	ast.parseDiagnostics.forEach(error => {
		const start = ast.getLineAndCharacterOfPosition(error.start);
		const end = ast.getLineAndCharacterOfPosition(error.start + error.length);
		const range = vscodeLanguageServer.Range.create(
			vscodeLanguageServer.Position.create(start.line, start.character),
			vscodeLanguageServer.Position.create(end.line, end.character)
		);
		const diagnostic = vscodeLanguageServer.Diagnostic.create(
			range, 
			error.messageText, 
			Utility.typescriptDiagnosticCategoryToVSCodeDiagnosticSeverity(error.category)
		);
		diagnostics.push(diagnostic);
	});

	connection.sendDiagnostics({
		uri: ast.fileName,
		diagnostics 
	});

}

connection.onDidChangeWatchedFiles(change => {
	connection.console.log('We received an file change event');
});

connection.onHover((info) => {
	return {
		contents: ["Hover example 1", "Hover example 2"]
	};
});

connection.onDocumentSymbol((info) => {

	const fileName = info.textDocument.uri;
	const ast = asts[fileName];
	const symbolTable = symbolTables[fileName];
	const symbols = [];

	function populateSymbols(symbolTable) {

		const symbolTableSymbols = symbolTable.getSymbols();

		for(const symbolName in symbolTableSymbols) {

			if(!symbolTableSymbols.hasOwnProperty(symbolName)) { continue; }
			
			const symbol = symbolTableSymbols[symbolName];
			const description = "";
			const startPosition = ast.getLineAndCharacterOfPosition(symbol.start);
			const endPosition = ast.getLineAndCharacterOfPosition(symbol.end);
			const range = vscodeLanguageServer.Range.create(
				vscodeLanguageServer.Position.create(startPosition.line, startPosition.character), 
				vscodeLanguageServer.Position.create(endPosition.line, endPosition.character)
			);
			const selectionRange = vscodeLanguageServer.Range.create(
				vscodeLanguageServer.Position.create(startPosition.line, startPosition.character), 
				vscodeLanguageServer.Position.create(endPosition.line, endPosition.character)
			);
		
			symbols.push(vscodeLanguageServer.DocumentSymbol.create(
				symbolName,
				description,
				Symbol.symbolTypeToVSCodeSymbolKind(symbol.symbolType),
				range,
				selectionRange
			));
		
		}
		
		for(const innerSymbolTable of symbolTable.getInner()) {
			populateSymbols(innerSymbolTable);
		}

	}

	populateSymbols(symbolTable);
	return symbols;

});

connection.onSignatureHelp((info) => {
	return [];
});

connection.onCompletion((info) => {
	return [];
});

connection.onCompletionResolve((item) => {
	if (item.data === 1) {
		item.detail = 'TypeScript details';
		item.documentation = 'TypeScript documentation';
	} else if (item.data === 2) {
		item.detail = 'JavaScript details';
		item.documentation = 'JavaScript documentation';
	}
	return item;
});

connection.onDidOpenTextDocument((params) => {
	const document = params.textDocument;
	const fileName = document.uri;
	const text = document.text;
	const ast = asts[fileName] = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
	clearDiagnostics(ast);
	symbolTables[fileName] = SymbolTable.createSymbolTable();
	if(Utility.hasParseError(ast)) { 
		provideDiagnostics(ast);
		return; 
	}
	symbolTables[fileName] = Analyzer.analyze(ast);
});

connection.onDidChangeTextDocument((params) => {

	const document = params.textDocument;
	const fileName = document.uri;
	let ast = asts[fileName];
	let text = ast.getFullText();

	clearDiagnostics(ast);

	for(const change of params.contentChanges) {
		const changeOffset = ast.getPositionOfLineAndCharacter(change.range.start.line, change.range.start.character);
		const span = ts.createTextSpan(changeOffset, change.rangeLength);
		const changeRange = ts.createTextChangeRange(span, change.text.length);
		const newText = text.slice(0, changeOffset) + change.text + text.slice(changeOffset + change.rangeLength);
		ast = asts[fileName] = ts.updateSourceFile(ast, newText, changeRange);
		text = newText;
	}

	if(Utility.hasParseError(ast)) {
		provideDiagnostics(ast);
		return; 
	}

	try{
		symbolTables[fileName] = Analyzer.analyze(ast);
	} catch (e) {
		console.log(e);
	}

	console.log("---------------");
	symbolTables[fileName].print();
	console.log("---------------");

});

connection.onDidCloseTextDocument((params) => {});

connection.listen();
