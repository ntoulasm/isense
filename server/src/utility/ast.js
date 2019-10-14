const TypeCarrier = require('./type_carrier');

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
 * @param {ts.SourceFile} ast
 * @param {number} offset
 */
Ast.findInnermostNodeOfAnyKind = (ast, offset) => {
    function findInnermostNodeOfAnyKind(node) {
        if(node.getStart() <= offset && node.end >= offset) {
            const innermostNode = ts.forEachChild(node, findInnermostNodeOfAnyKind);
            return (innermostNode) ? innermostNode : node; 
        }
    }
    return ts.forEachChild(ast, findInnermostNodeOfAnyKind);
};

/**
 * @param {ts.Node} node 
 * @param {string} name 
 * 
 * @returns {isense.symbol}
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
            return [{type: TypeCarrier.Type.Function, node}];
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
        default: {
            return [{type: TypeCarrier.Type.Undefined}];
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

/**
 * @param {ts.Node} node
 * @param {isense.typeCarrier} typeCarrier
 */
Ast.addTypeCarrierToClosestStatement = (node, typeCarrier) => { 
    const statements = [
        ts.SyntaxKind.VariableStatement,
        ts.SyntaxKind.ExpressionStatement,
        ts.SyntaxKind.ForStatement,
        ts.SyntaxKind.ForOfStatement,
        ts.SyntaxKind.ForInStatement,
        ts.SyntaxKind.ThrowStatement,
        ts.SyntaxKind.ReturnStatement,
        ts.SyntaxKind.SwitchStatement
    ];

    while (statements.indexOf(node.kind) === -1) {
        console.assert(node.parent !== undefined);
        node = node.parent;
    }

    Ast.addTypeCarrier(node, typeCarrier);

};

/**
 * @param {ts.Node} node
 * @param {isense.typeCarrier} typeCarrier
 */
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
    console.assert(node !== undefined, "Can not find closest type carrier for " + symbol.name);
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

    function findAllTypeCarriers(node) {
        if(node.hasOwnProperty("typeCarriers")) {
            typeCarriers.push(...node.typeCarriers);
        }
        ts.forEachChild(node, findAllTypeCarriers);
    }
    findAllTypeCarriers(node);

    return typeCarriers;

};

/**
 * @param {ts.SourceFile} ast
 */
Ast.addAnalyzeDiagnostic = (ast, diagnostic) => {
    ast.analyzeDiagnostics.push(diagnostic);
};

/**
 * @param {ts.Node} call
 * @param {string} calleeName
 */
Ast.findCallee = (call, calleeName) => {
    const symbol = Ast.lookUp(call, calleeName);
    if(symbol === undefined) { return undefined; }
    const typeCarrier = Ast.findClosestTypeCarrier(call, symbol);
    if(!typeCarrier.hasUniqueType()) { return undefined; }
    const type = typeCarrier.getTypes()[0];
    return type.type === TypeCarrier.Type.Function ? type.node : undefined;
};

/**
 * @param {ts.Node} callee
 * @param {ts.Node} call
 */
Ast.addCallSite = (callee, call) => {
    {
        const calleePosition = callee.getSourceFile().getLineAndCharacterOfPosition(callee.getStart());
        const callPosition = call.getSourceFile().getLineAndCharacterOfPosition(call.getStart());
        console.log(`call at line ${callPosition.line + 1} is a call site of function declared at line ${calleePosition.line + 1}`);
    }
    callee.callSites.push(call);
};

/**
 * @param {ts.Node} node
 */
Ast.isFunction = node => {
    const kind = node.kind;
    return kind === ts.SyntaxKind.FunctionDeclaration || kind === ts.SyntaxKind.FunctionExpression || kind === ts.SyntaxKind.ArrowFunction;
};

/**
 * @param {ts.Node} node
 */
Ast.findAncestorFunction = node => {
    while(node !== undefined) {
        if(Ast.isFunction(node)) {
            return node;
        }
        node = node.parent;
    }
    return undefined;
};

/**
 * @param {ts.Node} node
 * @param {isense.symbol} symbol
 * @param {ts.Node} functionNode
 */
Ast.isDeclaredInFunction = (node, symbol, functionNode) => {
    if(node.hasOwnProperty("symbols") && node.symbols.hasSymbol(symbol)) {
        return true;
    }
    if(node === functionNode) {
        return false;
    }
    console.assert(node.parent !== undefined, "isDeclaredInFunction");
    const leftSibling = Ast.findLeftSibling(node);
    return leftSibling !== undefined ? 
        Ast.isDeclaredInFunction(leftSibling, symbol, functionNode) : 
        Ast.isDeclaredInFunction(node.parent, symbol, functionNode);
};

/**
 * @param {ts.Node} node
 * @param {isense.typeCarrier} typeCarrier
 */
Ast.addTypeCarrierToNonPureFunction = (func, typeCarrier) => {
    if(!func.hasOwnProperty("affectedOutOfScopeSymbols")) {
        func.affectedOutOfScopeSymbols = [];
    }
    func.affectedOutOfScopeSymbols.push(typeCarrier);
};

module.exports = Ast;