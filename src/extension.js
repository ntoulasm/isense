const Utility = require('./utility/utility.js');
const Symbol = require('./utility/symbol.js');
const SymbolTable = require('./utility/symbol_table.js');
const Analyzer = require('./analyzer/analyzer.js');

const vscode = require('vscode');
const ts = require('typescript');

const asts = {};
const symbolTables = {};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('isense activated');

	vscode.workspace.onDidChangeTextDocument(function(params) {

		const document = params.document;
		if(!Utility.isJavaScriptDocument(document)) { return; }
		
		const fileName = document.fileName;
		const newText = document.getText();

		if(Utility.isUndefined(asts[fileName])) {
			asts[fileName] = ts.createSourceFile(fileName, newText);
			symbolTables[filename] = SymbolTable.createSymbolTable();
		} else {
			let oldText = asts[fileName].getFullText();
			for(const change of params.contentChanges) {
				const span = ts.createTextSpan(change.rangeOffset, change.rangeLength);
				const changeRange = ts.createTextChangeRange(span, change.text.length);
				const newText = oldText.slice(0, change.rangeOffset) + change.text + oldText.slice(change.rangeOffset + change.rangeLength);
				asts[fileName] = ts.updateSourceFile(asts[fileName], newText, changeRange);
				oldText = newText;
			}
		}

		if(Utility.hasParseError(asts[fileName])) { return; }

		symbolTables[fileName] = Analyzer.analyze(asts[fileName]);
		console.log("---------------");
		symbolTables[fileName].print();
		console.log("---------------");

	});

	const disposable = vscode.commands.registerCommand('extension.isense', function () {
		vscode.window.showInformationMessage('Extension isense says Hello World!');
	});
	context.subscriptions.push(disposable);

	const hover = vscode.languages.registerHoverProvider(Utility.javaScriptDocumentScheme, {
		provideHover(document, position, token) {
		  return {
			contents: ['aaaaa']
		  };
		}
	});
	context.subscriptions.push(hover);

	const code_completion = vscode.languages.registerCompletionItemProvider(Utility.javaScriptDocumentScheme, {
		provideCompletionItems(document, position, token, context) {
			const ast = asts[document.fileName];
			const offset = document.offsetAt(position);
			console.log(context.triggerKind);
			if(context.triggerCharacter === '.') {
				console.log("Get property: ", Utility.getNodeAtOffset(ast, offset, ts.SyntaxKind.PropertyAccessExpression));
			} else {
				console.log("Id: ", Utility.getInnermostNodeAtOffset(ast, offset, ts.SyntaxKind.Identifier));
			}
			return [{
				detail: "detail",
				kind: vscode.CompletionItemKind.Class,
				filterText: "a",
				insertText: "blablabla",
				label: "hahahah"
			}];
		}
	}, ['.']);
	context.subscriptions.push(code_completion);

	const signature_helper = vscode.languages.registerSignatureHelpProvider(Utility.javaScriptDocumentScheme, {
		provideSignatureHelp(document, position, token, context) {
			const ast = asts[document.fileName];
			const offset = document.offsetAt(position) - 1;
			const callExpression = Utility.getInnermostNodeAtOffset(ast, offset, ts.SyntaxKind.CallExpression);
			console.log("Call: ", callExpression);
			return {
				activeParameter: Utility.computeActiveParameter(document.getText(), offset),
				activeSignature: 0,
				signatures: [
					{
						documentation: "documentation for signature1",
						label: "function(a, b, c)",
						parameters: [
							new vscode.ParameterInformation("a", "documentation of parameter a"), 
							new vscode.ParameterInformation("b", "documentation of parameter b"),
							new vscode.ParameterInformation("c", "documentation of parameter c")
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
		}
	}, ["(", ","]);
	context.subscriptions.push(signature_helper);

	const symbolProvider = vscode.languages.registerDocumentSymbolProvider(Utility.javaScriptDocumentScheme, {
		provideDocumentSymbols(document, token) {

			const ast = asts[document.fileName];
			const symbolTable = symbolTables[document.fileName];
			const symbols = [];

			function populateSymbols(symbolTable) {

				const symbolTableSymbols = symbolTable.getSymbols();

				for(const symbolName in symbolTableSymbols) {

					if(!symbolTableSymbols.hasOwnProperty(symbolName)) { continue; }
					
					const symbol = symbolTableSymbols[symbolName];
					const description = "";
					const startPosition = ast.getLineAndCharacterOfPosition(symbol.start);
					const endPosition = ast.getLineAndCharacterOfPosition(symbol.end);
					const range = new vscode.Range(
						new vscode.Position(startPosition.line, startPosition.character), 
						new vscode.Position(endPosition.line, endPosition.character)
					);
					const selectionRange = new vscode.Range(
						new vscode.Position(startPosition.line, startPosition.character), 
						new vscode.Position(endPosition.line, endPosition.character)
					);
				
					symbols.push(new vscode.DocumentSymbol(
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

		}
	});
	context.subscriptions.push(symbolProvider);

}

exports.activate = activate;

function deactivate() {
	console.log("isense deactivated");
}

module.exports = {
	activate,
	deactivate
}
