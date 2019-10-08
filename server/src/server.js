const Utility = require('./utility/utility');
const Analyzer = require('./analyzer/analyzer');
const Ast = require('./utility/ast');
const TypeCarrier = require('./utility/type_carrier');

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
async function provideParseDiagnostics(ast) {

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

/**
 * @param {ts.SourceFile} ast 
 */
async function provideAnalyzeDiagnostics(ast) {
	connection.sendDiagnostics({
		uri: ast.fileName,
		diagnostics: ast.analyzeDiagnostics
	})
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
	const id = Ast.findInnermostNode(ast, offset, ts.SyntaxKind.Identifier);
	if(id === undefined) { return { contents: [] }; }
	const symbol = Ast.lookUp(id, id.text);
	if(symbol === undefined) { return {contents: [] }; }
	return {
		contents: [Ast.findClosestTypeCarrier(id, symbol).getSignature()]
	};

});

connection.onDocumentSymbol((info) => {

	const fileName = info.textDocument.uri;
	const ast = asts[fileName];
	const symbols = [];

	Ast.findAllSymbols(ast).forEach(symbol => {

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
			vscodeLanguageServer.SymbolKind.Variable,
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
	const call = Ast.findInnermostNode(ast, offset, ts.SyntaxKind.CallExpression);
	const text = ast.getFullText();

	if(call === undefined) { return; }
	const activeParameter = Utility.computeActiveParameter(text, offset, call.getStart());
	if(activeParameter < 0) {
		return null;
	}
	return {
		activeParameter,
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
		console.log("Get property: ", Ast.findNode(ast, offset, ts.SyntaxKind.PropertyAccessExpression));
	} else {
		const node = Ast.findInnermostNode(ast, offset, ts.SyntaxKind.Identifier);
		console.assert(node);
		Ast.findVisibleSymbols(node).forEach(symbol => {
			const closestTypeCarrier = Ast.findClosestTypeCarrier(node, symbol);
			const kind = closestTypeCarrier.hasUniqueType() ?
				TypeCarrier.typeToVSCodeCompletionItemKind(closestTypeCarrier.getTypes()[0].type) : 
				vscodeLanguageServer.CompletionItemKind.Variable;
			const signature = closestTypeCarrier.getSignature();
			completionItems.push({
				label: symbol.name, 
				kind,
				data: { signature }
			});
		});
	}

	return completionItems;

});

connection.onCompletionResolve(item => {
	item.detail = item.data.signature;
	return item;
});

connection.onDidOpenTextDocument((params) => {

	const document = params.textDocument;
	const fileName = document.uri;
	const text = document.text;
	const ast = asts[fileName] = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	
	clearDiagnostics(ast);
	if(Ast.hasParseError(ast)) { 
		provideParseDiagnostics(ast);
		return; 
	}
	
	try {
		Analyzer.analyze(ast);
		provideAnalyzeDiagnostics(ast);
	} catch(e) {
		console.log(e);
	}

});

connection.onDidChangeTextDocument((params) => {

	const document = params.textDocument;
	const fileName = document.uri;
	let ast = asts[fileName];
	let text = ast.getFullText();

	for(const change of params.contentChanges) {
		const changeOffset = ast.getPositionOfLineAndCharacter(change.range.start.line, change.range.start.character);
		const span = ts.createTextSpan(changeOffset, change.rangeLength);
		const changeRange = ts.createTextChangeRange(span, change.text.length);
		const newText = text.slice(0, changeOffset) + change.text + text.slice(changeOffset + change.rangeLength);
		ast = asts[fileName] = ts.updateSourceFile(ast, newText, changeRange);
		text = newText;
	}

	clearDiagnostics(ast);
	if(Ast.hasParseError(ast)) { 
		provideParseDiagnostics(ast);
		return; 
	}
	
	try {
		Analyzer.analyze(ast);
		provideAnalyzeDiagnostics(ast);
	} catch(e) {
		console.log(e);
	}

});

connection.onDidCloseTextDocument((params) => {});

connection.listen();
