const Utility = require('./utility/utility');
const Analyzer = require('./analyzer/analyzer');
const Ast = require('./ast/ast');
const TypeCarrier = require('./utility/type_carrier');
const SignatureFinder = require('./utility/signature-finder');
const TypeDeducer = require('./type-deducer/type_deducer');
const NumberMethods = require('./primitive-type-info/number-methods');
const DotGenerator = require('./ast/dot-generator');

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
		// TODO: do i care about this?
		// case ts.SyntaxKind.VariableDeclarationList: {
		// 	return {
		// 		contents: {
		// 			language: "typescript",
		// 			value: Ast.isLetDeclaration(node) ? "let keyword" : Ast.isConstDeclaration(node) ? "const keyword" : "var keyword"
		// 		}
		// 	};
		// }
		case ts.SyntaxKind.Constructor: {
			const parentName = node.parent.name ? node.parent.name.getText() : '';
			return {
				contents: {
					language: "typescript",
					value: `${parentName} constructor`
				}
			};
		}
		case ts.SyntaxKind.Identifier: {
			if(node.parent.kind === ts.SyntaxKind.PropertyAccessExpression && node.parent.name === node) {
				// TODO: a.x
				return { 
					contents: {
						language: 'typescript',
						value: `property ${node.text}`
					}
				};
			}
			const symbol = Ast.lookUp(node, node.text);
			if(symbol === undefined) { return { contents: [] }; }
			const closestTypeCarrier = Ast.findClosestTypeCarrier(node, symbol);
			if(closestTypeCarrier === undefined) { return { contents: [] }; }
			return {
				contents: {
					language: "typescript",
					value: SignatureFinder.computeSignature(node, closestTypeCarrier)
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

/**
 * @param {ts.Node} callee
 */
const computeParametersSignature = (callee) => {
	// TODO: Adjust for destructuring pattern
	const computeParameterSignature = p => {
		const parameterName = p.name.getText();
		const symbol = Ast.lookUp(
			Ast.findLastParameter(callee),
			parameterName
		);
		const closestTypeCarrier = symbol && Ast.findClosestTypeCarrier(symbol.declaration, symbol);
		let signature = parameterName;
		if(closestTypeCarrier) {
			let firstTime = true;
			for(const type of closestTypeCarrier.getTypes()) {
				if(firstTime) { 
					signature += ':';
					firstTime = false; 
				} else { 
					signature += ' ||' 
				}
				signature += ` ${TypeCarrier.typeToString(type)}`;
			}
		}

		return signature;
	}

	return callee.parameters.map(computeParameterSignature);

};

/**
 * @param {ts.Node} callee
 * @param {ts.Node} call 
 */
const computeFunctionSignature = (callee, call) => {
	let signature = '';
	if(callee.name !== undefined) {
		signature += callee.name.getText();
	} else {
		// TODO: check if this is fine
		// refinement: it probably is 
		//		eg: x()() -> x()()
		signature += call.expression.getText();
	}
	const parametersSignature = computeParametersSignature(callee);
	signature += `(${parametersSignature.join(', ')})`;
	return {
		documentation: '',
		label: signature,
		parameters: parametersSignature.map(p => vscodeLanguageServer.ParameterInformation.create(p, /* parameter documentation */))
	};
};

/**
 * @param {ts.Node} call 
 * @param {Number} offset 
 */
const computeActiveParameter = (call, offset) => {

	const callChildren = call.getChildren();
	const leftParenthesisToken = callChildren[1];
	const leftParenthesisOffset = leftParenthesisToken.end - 1;
	const cursorOffset = offset - leftParenthesisOffset;
	const parenthesizedExpression = ts.createSourceFile('', call.getSourceFile().getText().substring(leftParenthesisOffset, call.end));
	let activeParameter = 0;

	const countCommas = (node) => {
		if(node.kind === ts.SyntaxKind.BinaryExpression && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
			countCommas(node.left);
			if(node.operatorToken.end - 1 <= cursorOffset) {
				activeParameter++;
			}
		} 
	};
	countCommas(parenthesizedExpression.statements[0].expression.expression);

	return activeParameter;

};

connection.onSignatureHelp((info) => {

	const document = info.textDocument;
	const fileName = document.uri;
	const ast = asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character) - 1;
	const call = Ast.findInnermostNode(ast, offset, ts.SyntaxKind.CallExpression);
	// const text = ast.getFullText();

	if(call === undefined) { return; }
	// const activeParameter = Utility.computeActiveParameter(text, offset, call.getStart());
	// if(activeParameter < 0) { return null; }
	const activeParameter = computeActiveParameter(call, offset);
	const callees = TypeDeducer.deduceTypes(call.expression).filter(t => t.id === TypeCarrier.Type.Function).map(t => t.node);
	const signatures = callees.map(callee => computeFunctionSignature(callee, call))

	return {
		activeParameter,
		activeSignature: 0,
		signatures
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

		Analyzer.analyze(ast);
		const node = Ast.findInnermostNode(ast, offset - 1, ts.SyntaxKind.PropertyAccessExpression);
		const expressionTypes = TypeDeducer.deduceTypes(node.name.escapedText == "" ? node.expression : node);

		for(const type of expressionTypes) {
			if(type.id === TypeCarrier.Type.Number) {
				for(const m of NumberMethods) {
					completionItems.push({
						label: m.name,
						kind: vscodeLanguageServer.CompletionItemKind.Variable
					});
				}
			}
			if(type.id === TypeCarrier.Type.Object) {
				for(const [,property] of Object.entries(type.properties.getSymbols())) {
					const propertyName = property.name.split('.')[1];
					const propertyTypeCarrier = Ast.findClosestTypeCarrier(node, property);
					const kind = propertyTypeCarrier.hasUniqueType() ?
						TypeCarrier.typeToVSCodeCompletionItemKind(propertyTypeCarrier.getTypes()[0].id) :
						vscodeLanguageServer.CompletionItemKind.Variable;
					const signature = SignatureFinder.computeSignature(node, propertyTypeCarrier);
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
								const signature = SignatureFinder.computeSignature(node, propertyTypeCarrier);
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
						if(closestTypeCarrier === undefined) { return ; }
						const kind = closestTypeCarrier.hasUniqueType() ?
							TypeCarrier.typeToVSCodeCompletionItemKind(closestTypeCarrier.getTypes()[0].id) : 
							vscodeLanguageServer.CompletionItemKind.Variable;
						const signature = SignatureFinder.computeSignature(node, closestTypeCarrier);
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
	item.detail = item.data && item.data.signature;
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
		ast.analyzeDiagnostics = previousAst.analyzeDiagnostics;
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

const last = function(array) {
	return array[array.length - 1];
};

connection.onNotification('custom/generateDot', (params) => {
	const dotUri = params.fileName.replace('.js', '.dot');
	const dotFileName = last(dotUri.split('/'));
	DotGenerator.generate(asts[params.fileName], dotFileName);
	connection.sendNotification('custom/generateDotFinish', { dotUri });
});

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

connection.listen();
