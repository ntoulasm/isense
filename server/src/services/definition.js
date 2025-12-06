const {
	getAst,
	createRange,
	getSymbolOfIdentifier,
	findFocusedNode,
} = require('./utility');
const es5LibAst = require('../utility/es5-lib');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Definition = {};

// ----------------------------------------------------------------------------

/**
 *
 * @param {vscodeLanguageServer.DefinitionParams} info
 */
Definition.onDefinition = info => {
	const ast = getAst(info);
	const node = findFocusedNode(ast, info.position);

	if (!node) {
		return null;
	}

	switch (node.kind) {
		case ts.SyntaxKind.Identifier: {
			const symbol = getSymbolOfIdentifier(node);
			if (!symbol || !symbol.declaration) {
				return;
			}
			const sourceFile = symbol.declaration.getSourceFile();
			if (sourceFile === es5LibAst) {
				return;
			}
			const uri = sourceFile.fileName;
			const range = createRange(symbol);
			const location = vscodeLanguageServer.Location.create(uri, range);
			return location;
		}
		default:
			return null;
	}
};

// ----------------------------------------------------------------------------

module.exports = Definition;
