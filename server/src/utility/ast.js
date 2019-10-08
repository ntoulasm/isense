const TypeCarrier = require('./type_carrier.js');

const ts = require('typescript');

const Ast = {};

/**
 * @param {ts.SourceFile} ast
 */
Ast.hasParseError = ast => {
    for(const parseDiagnostic of ast.parseDiagnostics) {
        if(parseDiagnostic.category === ts.DiagnosticCategory.Error) {
            return true;
        }
    }
    return false;
};

/**
 * @param {ts.Node} variableDeclarationList
 */
Ast.isConstDeclaration = function(variableDeclarationList) {
    return (variableDeclarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const;
};

/**
 * @param {ts.Node} variableDeclarationList
 */
Ast.isLetDeclaration = function(variableDeclarationList) {
    return (variableDeclarationList.flags & ts.NodeFlags.Let) === ts.NodeFlags.Let;
};

/**
 * @param {ts.Node} variableDeclarationList
 */
Ast.isVarDeclaration = function(variableDeclarationList) {
    return !Ast.isConstDeclaration(variableDeclarationList) && !Ast.isLetDeclaration(variableDeclarationList); 
};

/**
 * @param {ts.Node} node
 */
Ast.computeChildren = node => {
    const children = [];
    ts.forEachChild(node, child => {
        children.push(child);
    });
    return children;
};

/**
 * @param {ts.Node} node
 */
Ast.computeSiblings = function(node) {
    const parent = node.parent;
    if(parent === undefined) { return [node]; }
    return Ast.computeChildren(parent);
};

/**
 * @param {ts.Node} node
 */
Ast.findLeftSibling = node => {
    const siblings = Ast.computeSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    return nodeIndex === 0 ? undefined : siblings[nodeIndex - 1];
};

/**
 * @param {ts.Node} node
 */
Ast.findLeftSiblingWithoutInnerScope = node => {

    let nodesWithInnerScope = [
        ts.SyntaxKind.Block,
        ts.SyntaxKind.ClassDeclaration,
        ts.SyntaxKind.ClassExpression,
        ts.SyntaxKind.ForStatement,
        ts.SyntaxKind.ForOfStatement,
        ts.SyntaxKind.ForInStatement,
    ];

    while(node = Ast.findLeftSibling(node)) {
        if(nodesWithInnerScope.indexOf(node.kind) == -1) {
            break;
        }
    }

    return node;

};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 * @param {number} kind
 */
Ast.findNode = (ast, offset, kind) => {
    function findNode(node) {
        if(node.getStart() <= offset && node.end >= offset) {
            if(node.kind === kind) { return node; }
            return ts.forEachChild(node, findNode);
        }
    }
    return ts.forEachChild(ast, findNode);
};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 * @param {number} kind
 */
Ast.findInnermostNode = (ast, offset, kind) => {
    function findInnermostNode(node) {
        if(node.getStart() <= offset && node.end >= offset) {
            if(node.kind === kind) {
                const innermostNode = ts.forEachChild(node, findInnermostNode);
                return (innermostNode) ? innermostNode : node; 
            }
            return ts.forEachChild(node, findInnermostNode);
        }
    }
    return ts.forEachChild(ast, findInnermostNode);
};

/**
 * @param {ts.Node} node 
 * @param {string} name 
 */
Ast.lookUp = (node, name) => {
    const visibleSymbols = Ast.findVisibleSymbols(node);
    for(const symbol of visibleSymbols) {
        if(symbol.name === name) {
            return symbol;
        }
    }
};

/**
 * @param {ts.Node} node
 */
Ast.findVisibleSymbols = node => {

    const symbols = [];
    const offset = node.end;

    function findVisibleSymbols(node) {
        if(node.symbols) { 
            for(const [, symbol] of Object.entries(node.symbols.getSymbols())) {
                if(offset > symbol.visibleOffset) {
                    symbols.push(symbol);
                }
            }
        }
        if(node.parent === undefined) { return; }
        let leftSibling = Ast.findLeftSiblingWithoutInnerScope(node);
        leftSibling ? findVisibleSymbols(leftSibling) : findVisibleSymbols(node.parent);
    }
    findVisibleSymbols(node);
    
    return symbols;

};

/**
 * @param {ts.Node} node
 */
Ast.findAllSymbols = node => {

    const symbols = [];

    function findAllSymbols(node) {
        if(node.symbols) {
            for(const [, symbol] of Object.entries(node.symbols.getSymbols())) {
                symbols.push(symbol);
            }
        }
        ts.forEachChild(node, findAllSymbols);
    };
    findAllSymbols(node);

    return symbols;

};

/**
 * @param {ts.Node} node
 */
Ast.deduceTypes = node => {
    if(node === undefined) {
        return [{type: TypeCarrier.Type.Undefined}];
    }
    switch(node.kind) {
        case ts.SyntaxKind.NumericLiteral: {
            return [{type: TypeCarrier.Type.Number, value: node.text}];
        }
        case ts.SyntaxKind.StringLiteral: {
            return [{type: TypeCarrier.Type.String, value: '"' + node.text + '"'}];
        }
        case ts.SyntaxKind.TrueKeyword: {
            return [{type: TypeCarrier.Type.Boolean, value: true}];
        }
        case ts.SyntaxKind.FalseKeyword: {
            return [{type: TypeCarrier.Type.Boolean, value: false}];
        }
        case ts.SyntaxKind.ArrayLiteralExpression: {
            return [{type: TypeCarrier.Type.Array}];
        }
        case ts.SyntaxKind.ObjectLiteralExpression: {
            return [{type: TypeCarrier.Type.Object}];
        }
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction: {
            return [{type: TypeCarrier.Type.Function}];
        }
        case ts.SyntaxKind.ClassExpression : {
            return [{type: TypeCarrier.Type.Class}];
        }
        case ts.SyntaxKind.NullKeyword: {
            return [{type: TypeCarrier.Type.Null}];
        }
        case ts.SyntaxKind.UndefinedKeyword: {
            return [{type: TypeCarrier.Type.Undefined}];
        }
        case ts.SyntaxKind.Identifier: {
            if(node.escapedText === "undefined") {
                return [{type: TypeCarrier.Type.Undefined}];
            } else {
                const symbol = Ast.lookUp(node, node.escapedText);
                const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
                return typeCarrier.getTypes();
            }
        }
    }
};

/**
 * @param {ts.Node} node
 * @param {object} typeCarrier
 */
Ast.addTypeCarrier = (node, typeCarrier) => {
    if(!node.hasOwnProperty("typeCarriers")) {
        node.typeCarriers = [];
    }
    for(const c of node.typeCarriers) {
        if(c.getSymbol() === typeCarrier.getSymbol()) {
            c.setTypes(typeCarrier.getTypes());
            return;
        }
    }
    node.typeCarriers.push(typeCarrier);
};

Ast.addTypeCarrierToClosestStatement = (node, typeCarrier) => {
    
    const statements = [
        ts.SyntaxKind.VariableStatement,
        ts.SyntaxKind.ExpressionStatement,
        ts.SyntaxKind.ForStatement,
        ts.SyntaxKind.ForOfStatement,
        ts.SyntaxKind.ForInStatement,
        ts.SyntaxKind.ThrowStatement,
        ts.SyntaxKind.ReturnStatement,
        ts.SyntaxKind.SwitchStatement,
        ts.SyntaxKind.Parameter
    ];

    while (statements.indexOf(node.kind) === -1) {
        console.assert(node.parent !== undefined);
        node = node.parent;
    }

    Ast.addTypeCarrier(node, typeCarrier);

};

Ast.addTypeCarrierToExpression = (node, typeCarrier) => {
    Ast.findBinaryExpressionAncestors(node).forEach(node => {
        Ast.addTypeCarrier(node, TypeCarrier.copyTypeCarrier(typeCarrier));
    });
    const expressionStatement = Ast.findExpressionStatementAncestor(node.parent);
    Ast.addTypeCarrier(expressionStatement, TypeCarrier.copyTypeCarrier(typeCarrier));
};

/**
 * @param {ts.Node} node
 */
Ast.findExpressionStatementAncestor = node => {
    while(node !== undefined) {
        if(node.kind === ts.SyntaxKind.ExpressionStatement) {
            return node;
        }
        node = node.parent;
    }
    return undefined;
}

/**
 * @param {ts.Node} node
 */
Ast.findBinaryExpressionAncestors = node => {
    const exprs = []
    while(node !== undefined && node.kind !== ts.SyntaxKind.ExpressionStatement) {
        if(node.parent !== undefined && node.parent.kind === ts.SyntaxKind.BinaryExpression) {
            exprs.push(node);
        }
        node = node.parent;
    }
    return exprs;
};

/**
 * @param {ts.Node} node
 * @param {object} symbol
 */
Ast.findClosestTypeCarrier = (node, symbol) => {
    if(node.hasOwnProperty("typeCarriers")) {
        for(const typeCarrier of node.typeCarriers) {
            if(typeCarrier.getSymbol() === symbol) {
                return typeCarrier;
            }
        }
    }
    console.assert(node.parent !== undefined);
    const leftSibling = Ast.findLeftSibling(node);
    return leftSibling !== undefined ? 
        Ast.findClosestTypeCarrier(leftSibling, symbol) : 
        Ast.findClosestTypeCarrier(node.parent, symbol);
};

/**
 * @param {ts.Node} node
 */
Ast.findAllTypeCarriers = node => {

    const typeCarriers = [];

    function findAlltypeCarriers(node) {
        if(node.hasOwnProperty("typeCarriers")) {
            typeCarriers.push(...node.typeCarriers);
        }
        ts.forEachChild(node, findAlltypeCarriers);
    }
    findAlltypeCarriers(node);

    return typeCarriers;

};

module.exports = Ast;