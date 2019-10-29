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
}

function deactivate() {
	return client ? client.stop() : undefined;
}

module.exports = {
	activate,
	deactivate
};