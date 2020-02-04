const path = require('path');
const vscode = require('vscode');
const vscodeLanguageClient = require('vscode-languageclient');

let client;

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
		}
	});

	client.onReady().then(() => {
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

module.exports = {
	activate,
	deactivate
};