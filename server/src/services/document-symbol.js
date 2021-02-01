const Ast = require('../ast/ast');
const { createRange } = require('./utility');

// ----------------------------------------------------------------------------

const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const DocumentSymbol = {};

// ----------------------------------------------------------------------------

DocumentSymbol.onDocumentSymbol = (info) => {

	const fileName = info.textDocument.uri;
	const ast = Ast.asts[fileName];
	const symbols = [];

	Ast.findAllSymbols(ast).forEach(symbol => {

        if(!symbol.declaration) { return ; }

		const description = '';
		const range = createRange(symbol);
	
		symbols.push(vscodeLanguageServer.DocumentSymbol.create(
			symbol.name,
			description,
			vscodeLanguageServer.SymbolKind.Variable,
			range,
			range
		));

	});

	return symbols;

}

// ----------------------------------------------------------------------------

module.exports = DocumentSymbol;