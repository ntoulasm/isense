const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	const jsScheme = { language: 'javascript', scheme: 'file' };

	console.log('isense activated');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.isense', function () {
		vscode.window.showInformationMessage('Extension isense says Hello World!');
	});
	context.subscriptions.push(disposable);

	let hover = vscode.languages.registerHoverProvider(jsScheme, {
		provideHover(document, position, token) {
		  return {
			contents: ['aaaaa']
		  };
		}
	});
	context.subscriptions.push(hover);

	let code_completion = vscode.languages.registerCompletionItemProvider(jsScheme, {
		provideCompletionItems(document, position, token) {
			console.log(document.getText());
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
	
	let signature_helper = vscode.languages.registerSignatureHelpProvider(jsScheme, {
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

}

exports.activate = activate;

function deactivate() {
	console.log("isense deactivated");
}

module.exports = {
	activate,
	deactivate
}
