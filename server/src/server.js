const Utility = require('./utility/utility');
const Analyzer = require('./analyzer/analyzer');

const vscodeLanguageServer = require('vscode-languageserver');
const ts = require('typescript');

const connection = vscodeLanguageServer.createConnection(vscodeLanguageServer.ProposedFeatures.all);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
const asts = {};

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

	const document = info.textDocument;
	const fileName = document.uri;
	const ast = asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	const id = Utility.getInnermostNodeAtOffset(ast, offset, ts.SyntaxKind.Identifier);

	if(id === undefined) { return { contents: [] }; }
	const symbol = Utility.lookUp(id, id.text);
	if(symbol === undefined) { return {contents: [] }; }
	return {
		contents: [Utility.computeSymbolDetail(symbol, offset)]
	};

});

connection.onDocumentSymbol((info) => {

	const fileName = info.textDocument.uri;
	const ast = asts[fileName];
	const symbols = [];

	Utility.forEachSymbol(ast, symbol => {

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
			symbol.name,
			description,
			Utility.computeSymbolKind(symbol, ast.end),
			range,
			selectionRange
		));

	});

	return symbols;

});

connection.onSignatureHelp((info) => {

	const document = info.textDocument;
	const fileName = document.uri;
	const ast = asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character) - 1;
	const callExpression = Utility.getInnermostNodeAtOffset(ast, offset, ts.SyntaxKind.CallExpression);
	const text = ast.getFullText();

	console.log("Call: ", callExpression);
	if(callExpression === undefined) { return; }
	return {
		activeParameter: Utility.computeActiveParameter(text, offset),
		activeSignature: 0,
		signatures: [
			{
				documentation: "documentation for signature1",
				label: "function(a, b, c)",
				parameters: [
					vscodeLanguageServer.ParameterInformation.create("a", "documentation of parameter a"), 
					vscodeLanguageServer.ParameterInformation.create("b", "documentation of parameter b"),
					vscodeLanguageServer.ParameterInformation.create("c", "documentation of parameter c")
				]
			},
			{
				documentation: "documentation for signature2",
				label: "function2",
				parameters: [{
					label: "a", 
					documentation: "documentation of parameter a"
				}]
			}
		]
	};

});

connection.onCompletion((info) => {
	
	const document = info.textDocument;
	const fileName = document.uri;
	const ast = asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	const completionItems = [];
	const triggerCharacter = info.context.triggerCharacter;

	if(triggerCharacter === '.') {
		console.log("Get property: ", Utility.getNodeAtOffset(ast, offset, ts.SyntaxKind.PropertyAccessExpression));
	} else {
		const currentNode = Utility.getInnermostNodeAtOffset(ast, offset, ts.SyntaxKind.Identifier);
		console.assert(currentNode);
		Utility.forEachSymbolReversed(currentNode, symbol => {
			if(symbol.isInitialized || offset > symbol.start) {
				completionItems.push({
					label: symbol.name, 
					kind: Utility.computeCompletionItemKind(symbol, offset),
					data: {
						symbol,
						offset
					}
				});
			}
		});
	}

	return completionItems;
});

connection.onCompletionResolve(item => {
	item.detail = Utility.computeSymbolDetail(item.data.symbol, item.data.offset);
	return item;
});

connection.onDidOpenTextDocument((params) => {

	const document = params.textDocument;
	const fileName = document.uri;
	const text = document.text;
	const ast = asts[fileName] = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
	
	clearDiagnostics(ast);
	if(Utility.hasParseError(ast)) { 
		provideDiagnostics(ast);
		return; 
	}
	try {
		Analyzer.analyze(ast);
	} catch(e) {
		console.log(e);
	}

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
		Analyzer.analyze(ast);
	} catch (e) {
		console.log(e);
	}

});

connection.onDidCloseTextDocument((params) => {});

connection.listen();
