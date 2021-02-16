const TypeInfo = require('../utility/type-info');
const Ast = require('../ast/ast');

// ----------------------------------------------------------------------------

const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Utility = {};

// ----------------------------------------------------------------------------

Utility.getAst = info => {
	const document = info.textDocument;
	const fileName = document.uri;
	return Ast.asts[fileName];
};

Utility.createRange = symbol => {
    const declaration = symbol.declaration;
	console.assert(declaration);
	const ast = declaration.getSourceFile();
	const startPosition = ast.getLineAndCharacterOfPosition(declaration.getStart());
	const endPosition = ast.getLineAndCharacterOfPosition(declaration.end);
	const range = vscodeLanguageServer.Range.create(startPosition, endPosition);
	return range;
};

// ----------------------------------------------------------------------------

Utility.getCompletionItemKind = type => {
    switch (type) {
        case TypeInfo.Type.Class: {
            return vscodeLanguageServer.CompletionItemKind.Class;
        }
        case TypeInfo.Type.Function: {
            return vscodeLanguageServer.CompletionItemKind.Function;
        }
        default: {
            return vscodeLanguageServer.CompletionItemKind.Variable;
        }
    }
};

// ----------------------------------------------------------------------------

module.exports = Utility;