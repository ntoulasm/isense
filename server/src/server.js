const Utility = require('./utility/utility');
const Analyzer = require('./analyzer/analyzer');
const Ast = require('./utility/ast');
const TypeCarrier = require('./utility/type_carrier');
const TypeDeducer = require('./type-deducer/type_deducer');
const NumberMethods = require('./primitive-type-info/number-methods');

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
			hoverProvider: true,
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
	});
}

connection.onDidChangeWatchedFiles(change => {
	connection.console.log('We received a file change event');
});

connection.onHover(info => {

	const document = info.textDocument;
	const fileName = document.uri;
	const ast = asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	const node = Ast.findInnermostNodeOfAnyKind(ast, offset);

	if(node === undefined) { return { contents: [] }; }

	switch(node.kind) {
		case ts.SyntaxKind.VariableDeclarationList: {
			return {
				contents: {
					language: "typescript",
					value: Ast.isLetDeclaration(node) ? "let keyword" : Ast.isConstDeclaration(node) ? "const keyword" : "var keyword"
				}
			};
		}
		case ts.SyntaxKind.Identifier: {
			const symbol = Ast.lookUp(node, node.text);
			if(symbol === undefined) { return { contents: [] }; }
			const closestTypeCarrier = Ast.findClosestTypeCarrier(node, symbol);
			if(closestTypeCarrier === undefined) { return { contents: [] }; }
			return {
				contents: {
					language: "typescript",
					value: computeSignature(node, closestTypeCarrier)
				}
			};
		}
		default: {
			return { contents: [] };
		}
	}
	
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

const computeFunctionSignature = (node, call) => `${node.name !== undefined ? node.name.getText() : call.expression.getText()}(${node.parameters.map(p => p.name.getText()).join(',')})`;

connection.onSignatureHelp((info) => {

	const signatures = [];
	const document = info.textDocument;
	const fileName = document.uri;
	const ast = asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character) - 1;
	const call = Ast.findInnermostNode(ast, offset, ts.SyntaxKind.CallExpression);
	const text = ast.getFullText();

	if(call === undefined) { return; }
	const activeParameter = Utility.computeActiveParameter(text, offset, call.getStart());
	if(activeParameter < 0) { return null; }
	const callees = TypeDeducer.deduceTypes(call.expression).filter(t => t.id === TypeCarrier.Type.Function).map(t => t.node);

	for(const callee of callees) {
		const signature = {};
		signature.documentation = "Function Documentation?";
		signature.label = computeFunctionSignature(callee, call);
		signature.parameters = [];
		for(const parameter of callee.parameters) {
			signature.parameters.push(vscodeLanguageServer.ParameterInformation.create(parameter.name.getText(), "Parameter Documentation?"));
		}
		signatures.push(signature);
	}

	return {
		activeParameter,
		activeSignature: 0,
		signatures
	};

	// return {
	// 	activeParameter,
	// 	activeSignature: 0,
	// 	signatures: [
	// 		{
	// 			documentation: "documentation for signature1",
	// 			label: "function(a, b, c)",
	// 			parameters: [
	// 				vscodeLanguageServer.ParameterInformation.create("a", "documentation of parameter a"), 
	// 				vscodeLanguageServer.ParameterInformation.create("b", "documentation of parameter b"),
	// 				vscodeLanguageServer.ParameterInformation.create("c", "documentation of parameter c")
	// 			]
	// 		},
	// 		{
	// 			documentation: "documentation for signature2",
	// 			label: "function2",
	// 			parameters: [{
	// 				label: "a", 
	// 				documentation: "documentation of parameter a"
	// 			}]
	// 		}
	// 	]
	// };

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

		const node = Ast.findInnermostNode(ast, offset - 1, ts.SyntaxKind.PropertyAccessExpression);
		const expressionTypes = TypeDeducer.deduceTypes(node.name.escapedText == "" ? node.expression : node);

		for(const type of expressionTypes) {
			if(type.id === TypeCarrier.Type.Object) {
				for(const [,property] of Object.entries(type.properties.getSymbols())) {
					const propertyName = property.name.split('.')[1];
					const propertyTypeCarrier = Ast.findClosestTypeCarrier(node, property);
					const kind = propertyTypeCarrier.hasUniqueType() ?
						TypeCarrier.typeToVSCodeCompletionItemKind(propertyTypeCarrier.getTypes()[0].id) :
						vscodeLanguageServer.CompletionItemKind.Variable;
					const signature = computeSignature(node, propertyTypeCarrier);
					completionItems.push({
						label: propertyName,
						kind,
						data: {signature}
					});
				}
			}
		}

	} else {
		const node = Ast.findInnermostNodeOfAnyKind(ast, offset);
		switch(node.kind) {
			case ts.SyntaxKind.Identifier: {
				if(node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {

					const expressionTypes = TypeDeducer.deduceTypes(node.parent.expression);

					for(const type of expressionTypes) {
						if(type.id === TypeCarrier.Type.Object) {
							for(const [,property] of Object.entries(type.properties.getSymbols())) {
								const propertyName = property.name.split('.')[1];
								const propertyTypeCarrier = Ast.findClosestTypeCarrier(node, property);
								const kind = propertyTypeCarrier.hasUniqueType() ?
									TypeCarrier.typeToVSCodeCompletionItemKind(propertyTypeCarrier.getTypes()[0].id) :
									vscodeLanguageServer.CompletionItemKind.Variable;
								const signature = computeSignature(node, propertyTypeCarrier);
								completionItems.push({
									label: propertyName,
									kind,
									data: {signature}
								});
							}
						}
					}				
					
				} else {
					Ast.findVisibleSymbols(node).forEach(symbol => {
						const closestTypeCarrier = Ast.findClosestTypeCarrier(node, symbol);
						const kind = closestTypeCarrier.hasUniqueType() ?
							TypeCarrier.typeToVSCodeCompletionItemKind(closestTypeCarrier.getTypes()[0].id) : 
							vscodeLanguageServer.CompletionItemKind.Variable;
						const signature = computeSignature(node, closestTypeCarrier);
						completionItems.push({
							label: symbol.name, 
							kind,
							data: { signature }
						});
					});
				}
			}
		}
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
		const previousAst = ast;
		ast = asts[fileName] = ts.updateSourceFile(ast, newText, changeRange);
		ast.symbols = previousAst.symbols;
		ast.typeCarriers = previousAst.typeCarriers;
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

let objectNesting = 0;
const computeSpaces = () => {
    let spaces = "";
    for(let i = 0; i < objectNesting; ++i) {
        spaces += "    ";
    }
    return spaces;
};

const typeToString = type => {

	switch(type.id) {
		case TypeCarrier.Type.Object: {
			return type.hasOwnProperty('constructorName') ? type.constructorName : 'Object';
		}
		default: {
			return Object.keys(TypeCarrier.Type)[type.id];
		}
	}

}

function computeSignature(node, typeCarrier) {

	const symbol = typeCarrier.getSymbol();
	let firstTime = true;
	let signature = symbol.isConst ? 'const ' : '';

	function computeSignatureValue(type) {

		switch(type.id) {
			case TypeCarrier.Type.Number:
			case TypeCarrier.Type.Boolean: {
				return type.hasOwnProperty("value") ? `= ${String(type.value)}` : '';
			}
			case TypeCarrier.Type.String: {
				return type.hasOwnProperty("value") ? `= \"${String(type.value)}\"` : '';
			}
			case TypeCarrier.Type.Array: {
				return '';
			}
			case TypeCarrier.Type.Object: {

				if(type.properties.getSymbols().length === 0) {
					return '';
				}

				++objectNesting;
				let comma = false;
				let value = `= {\n`;

				for(const [,property] of Object.entries(type.properties.getSymbols())) {
					if(comma) { value += ',\n'; }
					comma = true;
					value += computeSpaces();
					value += computeSignature(node, Ast.findClosestTypeCarrier(node, property));
				}
	
				--objectNesting;
				value += `\n${computeSpaces()}}`;
				return value;

			}
			case TypeCarrier.Type.Function:
			case TypeCarrier.Type.Class: {
				return type.node ? '' : `= ${type.node.text}`;
			}
			case TypeCarrier.Type.Null:
			case TypeCarrier.Type.Undefined: {
				return '';
			}
			default: {
				console.assert(false);
			}
		}
	}

	for(const type of typeCarrier.getTypes()) {
		if(firstTime) { 
			firstTime = false;
		} else {
			signature += ' || '
		}
		const name = symbol.name[0] == "@" ? symbol.name.split('.')[1] : symbol.name;
		signature += `${name}: ${typeToString(type)} `;
		signature += computeSignatureValue(type);
	}

    return signature;
}

connection.listen();
