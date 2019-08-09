const vscode = require('vscode');
const ts = require('typescript');
const utility = require('./utility/utility.js');

const asts = {};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('isense activated');

	vscode.workspace.onDidChangeTextDocument(function(params) {

		if(!utility.isJavaScriptDocument(params.document)) { return; }
		
		const document = params.document;
		const fileName = document.fileName;
		const newText = document.getText();

		if(asts[fileName] === undefined) {
			asts[fileName] = ts.createSourceFile(fileName, newText);
		} else {
			for(const change of params.contentChanges) {
				const span = ts.createTextSpan(change.rangeOffset, change.rangeLength);
				const changeRange = ts.createTextChangeRange(span, change.text.length);
				asts[fileName] = ts.updateSourceFile(asts[fileName], newText, changeRange);
			}
			console.log(asts[fileName]);
		}

	});

	const disposable = vscode.commands.registerCommand('extension.isense', function () {
		vscode.window.showInformationMessage('Extension isense says Hello World!');
	});
	context.subscriptions.push(disposable);

	const hover = vscode.languages.registerHoverProvider(utility.javaScriptDocumentScheme, {
		provideHover(document, position, token) {
		  return {
			contents: ['aaaaa']
		  };
		}
	});
	context.subscriptions.push(hover);

	const code_completion = vscode.languages.registerCompletionItemProvider(utility.javaScriptDocumentScheme, {
		provideCompletionItems(document, position, token) {
			return [{
				detail: "sample",
				kind: vscode.CompletionItemKind.Class,
				filterText: "h",
				insertText: "blablabla",
				label: "hahahah"
			}];
		}
	}, ['.']);
	context.subscriptions.push(code_completion);

	const signature_helper = vscode.languages.registerSignatureHelpProvider(utility.javaScriptDocumentScheme, {
		provideSignatureHelp(document, position, token) {
			return {
				activeParameter: 0,
				activeSignature: 0,
				signatures: [
					{
						documentation: "aaaa",
						label: "function1",
						parameters: [new vscode.ParameterInformation("a", "aaa"), {label: "b", documentation: "bbb"}, {label: "c", documentation: "ccc"}]
					},
					{
						documentation: "bbbbb",
						label: "function2",
						parameters: [new vscode.ParameterInformation("a", "aaa")]
					}
				]
			}
		}
	}, ["(", ","]);
	context.subscriptions.push(signature_helper);

	const symbolProvider = vscode.languages.registerDocumentSymbolProvider(utility.javaScriptDocumentScheme, {
		provideDocumentSymbols(document, token) {
			return [
				new vscode.DocumentSymbol(
					"symbol_name", 
					"TODO: add details", 
					vscode.SymbolKind.Boolean, 
					new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
					new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
				)
			];
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
