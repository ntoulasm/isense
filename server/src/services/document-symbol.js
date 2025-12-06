const Ast = require('../ast/ast');
const { createRange } = require('./utility');

// ----------------------------------------------------------------------------

const vscodeLanguageServer = require('vscode-languageserver');
const ts = require('typescript');

// ----------------------------------------------------------------------------

const DocumentSymbol = {};

// ----------------------------------------------------------------------------

DocumentSymbol.onDocumentSymbol = info => {
	const fileName = info.textDocument.uri;
	const ast = Ast.asts[fileName];

	return createDocumentSymbols(ast);
};

// ----------------------------------------------------------------------------

function createDocumentSymbols(node) {
	const symbols = [];

	if (!node.symbols) {
		return symbols;
	}

	for (const symbol of Object.values(node.symbols.getSymbols())) {
		if (!symbol.declaration) {
			continue;
		}
		symbols.push(createDocumentSymbol(symbol));
	}

	const createSymbolsInBlock = node => {
		switch (node.kind) {
			case ts.SyntaxKind.Block:
				symbols.push(...createDocumentSymbols(node));
				break;
			case ts.SyntaxKind.ForStatement:
			case ts.SyntaxKind.ForInStatement:
			case ts.SyntaxKind.ForOfStatement:
				symbols.push(...createDocumentSymbols(node));
				break;
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.ClassExpression:
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.FunctionExpression:
			case ts.SyntaxKind.ArrowFunction:
			case ts.SyntaxKind.Constructor:
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.SetAccessor:
			case ts.SyntaxKind.GetAccessor:
				break;
			default:
				ts.forEachChild(node, createSymbolsInBlock);
				break;
		}
	};
	ts.forEachChild(node, createSymbolsInBlock);

	return symbols;
}

function createDocumentSymbol(symbol) {
	const description = '';
	const range = createRange(symbol);
	const kind = getSymbolKind(symbol);
	let children = [];

	if (ts.isFunctionLike(symbol.declaration) && symbol.declaration.body) {
		children = createDocumentSymbols(symbol.declaration.body);
	}

	if (ts.isClassLike(symbol.declaration)) {
		children = createDocumentSymbols(symbol.declaration);
	}

	return vscodeLanguageServer.DocumentSymbol.create(
		symbol.name,
		description,
		kind,
		range,
		range,
		children
	);
}

// ----------------------------------------------------------------------------

function getSymbolKind(symbol) {
	const kind = vscodeLanguageServer.SymbolKind;

	switch (symbol.declaration.kind) {
		case ts.SyntaxKind.ClassDeclaration:
		case ts.SyntaxKind.ClassExpression:
			return kind.Class;
		case ts.SyntaxKind.FunctionDeclaration:
		case ts.SyntaxKind.FunctionExpression:
		case ts.SyntaxKind.ArrowFunction:
			return kind.Function;
		case ts.SyntaxKind.MethodDeclaration:
			return kind.Method;
		case ts.SyntaxKind.Constructor:
			return kind.Constructor;
		case ts.SyntaxKind.SetAccessor:
		case ts.SyntaxKind.GetAccessor:
		case ts.SyntaxKind.PropertyDeclaration:
			return kind.Property;
		default:
			return kind.Variable;
	}
}

// ----------------------------------------------------------------------------

module.exports = DocumentSymbol;
