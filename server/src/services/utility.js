const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
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

/**
 * @param {ts.PropertyAccessExpression} node 
 */
Utility.getPropertySymbols = node => {
	const properties = [];
	const objectTypeInfo = TypeCarrier.evaluate(node.expression.carrier);
	for(const typeInfo of objectTypeInfo) {
        switch(typeInfo.type) {
            case TypeInfo.Type.Object: {
                if(!typeInfo.hasValue) { break; }
                properties.push(...Object.values(typeInfo.properties.getSymbols()));
            }
        }
	}
	return properties;
}

// ----------------------------------------------------------------------------

module.exports = Utility;