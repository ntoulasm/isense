const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('isense activated');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.isense', function () {
		vscode.window.showInformationMessage('Extension isense says Hello World!');
	});
	context.subscriptions.push(disposable);

	let hover = vscode.languages.registerHoverProvider('javascript', {
		provideHover(document, position, token) {
		  return {
			contents: ['aaaaa']
		  };
		}
	});
	context.subscriptions.push(hover);

	let code_completion = vscode.languages.registerCompletionItemProvider('javascript', {
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
	


}

exports.activate = activate;

function deactivate() {
	console.log("isense deactivated");
}

module.exports = {
	activate,
	deactivate
}
