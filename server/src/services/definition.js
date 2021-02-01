const Ast = require('../ast/ast');
const { createRange } = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Definition = {};

// ----------------------------------------------------------------------------

Definition.onDefinition = info => {

	const document = info.textDocument;
	const fileName = document.uri;
	const ast = Ast.asts[fileName];
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	const node = Ast.findInnermostNodeOfAnyKind(ast, offset);

	switch(node.kind) {
		case ts.SyntaxKind.Identifier: {
			// TODO: Handle definition in different files.
			const symbol = Ast.lookUp(node, node.getText());
			const range = createRange(symbol);
			const location = vscodeLanguageServer.Location.create(fileName, range);
			return location;
		}
		default: return null;
	}

};

// ----------------------------------------------------------------------------

module.exports = Definition;