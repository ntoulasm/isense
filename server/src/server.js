const Analyzer = require('./analyzer/analyzer');
const Ast = require('./ast/ast');
const Utility = require('./utility/utility');

const IstDotGenerator = require('./ast/ist-dot-generator');
const AstDotGenerator = require('./ast/ast-dot-generator');

const DocumentSymbol = require('./services/document-symbol');
const Hover = require('./services/hover');
const Completion = require('./services/completion');
const SignatureHelp = require('./services/signature-help');
const Definition = require('./services/definition');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------


const connection = vscodeLanguageServer.createConnection(vscodeLanguageServer.ProposedFeatures.all);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
const asts = Ast.asts;

// ----------------------------------------------------------------------------

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
			hoverProvider: true,
			documentSymbolProvider: true,
			definitionProvider: true,
			signatureHelpProvider: {
				triggerCharacters: ['(', ',']
			},
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.']
			}
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

// ----------------------------------------------------------------------------

const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;

const documentSettings = new Map();

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

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
	});
}

// ----------------------------------------------------------------------------

connection.onDidChangeWatchedFiles(change => {
	connection.console.log('We received a file change event');
});

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

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
		const previousAst = ast;
		ast = asts[fileName] = ts.updateSourceFile(ast, newText, changeRange);
		ast.symbols = previousAst.symbols;
		ast.binders = previousAst.binders;
		ast.analyzeDiagnostics = previousAst.analyzeDiagnostics;
		text = newText;
	}

	clearDiagnostics(ast);
	if(Ast.hasParseError(ast)) { 
		provideParseDiagnostics(ast);
		return; 
	}

	// TODO: remove temporary try catch;
	try {
		Analyzer.analyze(ast);
		provideAnalyzeDiagnostics(ast);
	} catch(e) {
		console.log(e);
	}

});

// ----------------------------------------------------------------------------

connection.onDidCloseTextDocument(params => {});

// ----------------------------------------------------------------------------

connection.onHover(Hover.onHover);

// ----------------------------------------------------------------------------

connection.onDocumentSymbol(DocumentSymbol.onDocumentSymbol);

// ----------------------------------------------------------------------------

connection.onSignatureHelp(SignatureHelp.onSignatureHelp);

// ----------------------------------------------------------------------------

connection.onCompletion(Completion.onCompletion);
connection.onCompletionResolve(Completion.onCompletionResolve);

// ----------------------------------------------------------------------------

connection.onDefinition(Definition.onDefinition);

// ----------------------------------------------------------------------------

const last = function(array) {
	return array[array.length - 1];
};

connection.onNotification('custom/generateDot', (params) => {
	const dotUri = params.fileName.replace('.js', '.dot');
	const dotFileName = last(dotUri.split('/'));
	AstDotGenerator.generate(asts[params.fileName], dotFileName);
	connection.sendNotification('custom/generateDotFinish', { dotUri });
});

// ----------------------------------------------------------------------------

connection.onNotification('custom/generateISenseDot', params => {
	const dotUri = params.fileName.replace('.js', '.dot');
	const dotFileName = last(dotUri.split('/'));
	IstDotGenerator.generate(asts[params.fileName], dotFileName);
	connection.sendNotification('custom/generateISenseDotFinish', { dotUri });
});

// ----------------------------------------------------------------------------

// connection.onNotification('custom/focusChanged', (params) => {

// 	const ast = asts[params.fileName];
// 	const offset = ast.getPositionOfLineAndCharacter(params.position.line, params.position.character); 
// 	const node = Ast.findInnermostNodeOfAnyKind(ast, offset);
// 	const func = Ast.findAncestorFunction(node);
// 	if(func === undefined) { return ; }
// 	const callSites = [];
// 	func.callSites.forEach(callSite => {
// 		const position = ast.getLineAndCharacterOfPosition(callSite.getStart());
// 		callSites.push(`${callSite.getText()}:${position.line + 1}:${position.character + 1}`);
// 	});
// 	if(callSites.length === 0) { return ; }
// 	if(callSites.length === 1) {
// 		// TODO: add logic;
// 		return ;
// 	}
// 	connection.sendNotification('custom/pickCallSite', {callSites});
// });

// ----------------------------------------------------------------------------

connection.listen();
