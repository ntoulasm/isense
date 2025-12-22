const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const Ast = require('../ast/ast');

// ----------------------------------------------------------------------------

const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Utility = {};

// ----------------------------------------------------------------------------

Utility.getAst = info => {
    const uri = info.textDocument.uri;
    return Ast.asts[uri];
};

Utility.createRange = symbol => {
    const declaration = symbol.declaration;
    console.assert(declaration);
    const ast = declaration.getSourceFile();
    const startPosition = ast.getLineAndCharacterOfPosition(
        declaration.getStart(ast)
    );
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
    for (const typeInfo of objectTypeInfo) {
        switch (typeInfo.type) {
            case TypeInfo.Type.Object: {
                if (!typeInfo.hasValue) {
                    break;
                }
                properties.push(
                    ...Object.values(typeInfo.properties.getSymbols())
                );
            }
        }
    }
    return properties;
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Identifier} node
 */
Utility.getSymbolOfIdentifier = node => {
    if (Ast.isNameOfPropertyAccessExpression(node)) {
        const propertyName = node.getText();
        const properties = Utility.getPropertySymbols(node.parent);
        return properties.find(p => p.name === propertyName);
    } else {
        return Ast.lookUp(node, node.text);
    }
};

// ----------------------------------------------------------------------------

Utility.findFocusedNode = (ast, position) => {
    if (!ast || typeof ast.getPositionOfLineAndCharacter !== 'function') {
        throw new Error('AST must implement getPositionOfLineAndCharacter');
    }
    const offset = ast.getPositionOfLineAndCharacter(
        position.line,
        position.character
    );
    return Ast.findInnermostNodeOfAnyKind(ast, offset);
};

// ----------------------------------------------------------------------------

module.exports = Utility;
