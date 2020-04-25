const path = require('path');
const vscode = require('vscode');
const vscodeLanguageClient = require('vscode-languageclient');

let client;
/**
 * @type {vscode.StatusBarItem}
 */
let offsetStatusBarItem;

/**
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {

	let serverModule = context.asAbsolutePath(
		path.join('server', 'src', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let serverOptions = {
		run: { module: serverModule, transport: vscodeLanguageClient.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: vscodeLanguageClient.TransportKind.ipc,
			options: debugOptions
		}
	};

	let clientOptions = {
		documentSelector: [{ scheme: 'file', language: 'javascript' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	client = new vscodeLanguageClient.LanguageClient(
		'languageServer',
		'Language Server',
		serverOptions,
		clientOptions
	);

	
	// This will also launch the server
	client.start();

	offsetStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	offsetStatusBarItem.command = 'extension.goToOffset';
	context.subscriptions.push(offsetStatusBarItem);
	
	vscode.window.onDidChangeTextEditorSelection((params) => {
		if(params.textEditor.document.languageId === "javascript") {
			const length = params.selections.length;
			const start = params.selections[0].start;
			const end = params.selections[0].end;
			if(length === 1 && start.line === end.line && start.character === end.character) {
				client.sendNotification('custom/focusChanged', {
					fileName: params.textEditor.document.uri.toString(),
					position: start
				});
				client.onNotification('custom/pickCallSite', ({callSites}) => {
					const quickPick = vscode.window.showQuickPick(callSites);
					quickPick.then(callSite => {
						client.sendNotification('custom/selectCallSite', callSites.indexOf(callSite));
					});
				});
			}		
			updateOffsetStatusBarItem(offsetStatusBarItem, )
		}
	});

	vscode.commands.registerTextEditorCommand('extension.goToOffset', (textEditor) => {

		if(!textEditor) { return ; }
		const text = textEditor.document.getText();
		const end = text.length;
		vscode.window.showInputBox({
			valueSelection: [0, end],
			placeHolder: 'Type offset to go',
			validateInput: text => {
				if(isNaN(text)) {
					return 'Type a number you moron';
				}
				return (text > 0 && text < end) ? null : 'Offset out of range';
			}
		}).then((text) => {
			const position = textEditor.document.positionAt(text);
			textEditor.selections = [
				new vscode.Selection(position.line, position.character, position.line, position.character)
			];
		});

	});

	// ------------------------------------------------------------------------

	client.onReady().then(() => {

		updateOffsetStatusBarItem();

		// ------------------------------------------------------------------------
		// const openUris = uris => {
		// 	uris.forEach(uri => {
		// 		vscode.workspace.openTextDocument(uri);
		// 	});
		// }
		// vscode.workspace.findFiles(`*.js`).then(uris => { openUris(uris) });
		// vscode.workspace.findFiles('**/*.js', '**/node_modules/**').then(uris => { openUris(uris); });
		
	});

}

function deactivate() {
	return client ? client.stop() : undefined;
}

/**
 * @param {vscode.TextEditor} textEditor
 */
function computeOffset(textEditor = vscode.window.activeTextEditor) {
	return textEditor.document.offsetAt(textEditor.selection.active);
}

function updateOffsetStatusBarItem() {
	offsetStatusBarItem.text = `Offset: ${computeOffset()}`;
	offsetStatusBarItem.show();
}

module.exports = {
	activate,
	deactivate
};