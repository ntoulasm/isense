const TypeCarrier = require('../utility/type_carrier');
const Utility = require('../utility/utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------


const Ast = {};

/**
 * @param {ts.SourceFile} ast
 * 
 * @returns {Boolean}
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
 * 
 * @returns {Boolean}
 */
Ast.isConstDeclaration = function(variableDeclarationList) {
    return (variableDeclarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const;
};

/**
 * @param {ts.Node} variableDeclarationList
 * 
 * @returns {Boolean}
 */
Ast.isLetDeclaration = function(variableDeclarationList) {
    return (variableDeclarationList.flags & ts.NodeFlags.Let) === ts.NodeFlags.Let;
};

/**
 * @param {ts.Node} variableDeclarationList
 * 
 * @returns {Boolean}
 */
Ast.isVarDeclaration = function(variableDeclarationList) {
    return !Ast.isConstDeclaration(variableDeclarationList) && !Ast.isLetDeclaration(variableDeclarationList); 
};

/**
 * @param {ts.Node} node
 * 
 * @returns {Array<ts.Node>}
 */
Ast.findChildren = node => {
    const children = [];
    ts.forEachChild(node, child => {
        children.push(child);
    });
    return children;
};

/**
 * @param {ts.Node} node
 * 
 * @returns {Array<ts.Node>} 
 */
Ast.findSiblings = function(node) {
    const parent = node.parent;
    if(parent === undefined) { return [node]; }
    return Ast.findChildren(parent);
};

/**
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
 */
Ast.findLeftSibling = node => {
    const siblings = Ast.findSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    return nodeIndex === 0 ? undefined : siblings[nodeIndex - 1];
};

/**
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
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
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
 */
Ast.findRightSibling = node => {
    const siblings = Ast.findSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    return nodeIndex === siblings.length - 1 ? undefined : siblings[nodeIndex + 1];
};

/**
 * @param {ts.Node} node
 * 
 * @returns {Array<ts.Node>}
 */
Ast.findRightSiblings = node => {
    const siblings = Ast.findSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    console.assert(nodeIndex !== -1);
    return siblings.slice(nodeIndex + 1);
};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 * @param {number} kind
 * 
 * @returns {ts.Node}
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
 * 
 * @returns {ts.Node}
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
 * 
 * @returns {ts.Node}
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
 * 
 * @returns {Array<isense.symbol>}
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
 * @param {object} typeCarrier
 */
Ast.addTypeCarrier = (node, typeCarrier) => {
    console.assert(node.hasOwnProperty("typeCarriers"), "Trying to add typeCarrier to node without property typeCarriers");
    typeCarrier.parent = node;
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
        ts.SyntaxKind.SwitchStatement,
        ts.SyntaxKind.FunctionDeclaration,
        ts.SyntaxKind.ClassDeclaration,
        ts.SyntaxKind.EmptyStatement
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
    Ast.addTypeCarrierToClosestStatement(node, TypeCarrier.copyTypeCarrier(typeCarrier));
};

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
    if(!node.hasOwnProperty("typeCarriers")) {
        const previousNode = Ast.findPreviousNode(node);
        return previousNode ? Ast.findClosestTypeCarrier(previousNode, symbol) : undefined;
    }
    for(const typeCarrier of node.typeCarriers) {
        if(typeCarrier.getSymbol() === symbol) {
            return typeCarrier;
        }
    }
    const previousNode = Ast.findPreviousNode(node);
    return previousNode ? Ast.findClosestTypeCarrier(previousNode, symbol) : undefined;
};

/**
 * @param {ts.Node} node
 */
Ast.findPreviousNode = node => {
    const leftSibling = Ast.findLeftSibling(node);
    return leftSibling ? leftSibling : node.parent;
};

/**
 * @param {ts.Node} node
 */
Ast.findAllTypeCarriers = node => {

    const typeCarriers = [];

    function findAllTypeCarriers(node) {
        console.assert(node.hasOwnProperty("typeCarriers"));
        const symbols = typeCarriers.map(c => { return c.getSymbol(); });
        for(const newCarrier of node.typeCarriers) {
            const index = symbols.indexOf(newCarrier.getSymbol());
            if(index !== -1) { typeCarriers.splice(index, 1); }
            typeCarriers.push(newCarrier);
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
 */
Ast.findCallees = (call) => {

    const callees = [];
    const calleeName = call.expression.getText();
    const symbol = Ast.lookUp(call, calleeName);

    if(symbol === undefined) { return undefined; }
    
    const typeCarrier = Ast.findClosestTypeCarrier(call, symbol);

    for(const type of typeCarrier.getTypes()) {
        if(type.id === TypeCarrier.Type.Function) {
            callees.push(type.node);
        }
    }

    return callees;

};

/**
 * @param {ts.Node} callee
 * @param {ts.Node} call
 */
Ast.addCallSite = (callee, call) => {
    if(!callee._original.hasOwnProperty("callSites")) {
        callee._original.callSites = [];
    }
    callee._original.callSites.push(call);
};

/**
 * @param {ts.Node} node
 */
Ast.findAncestorFunction = node => {
    while(node !== undefined) {
        if(ts.isFunctionLike(node)) {
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
    return Ast.isDeclaredInFunction(leftSibling || node.parent, symbol, functionNode);
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

/**
 * @param {ts.Node} node
 */
Ast.operatorTokenToString = node => {
    switch(node.kind) {
        case ts.SyntaxKind.PlusPlusToken: {
            return '++';
        }
        case ts.SyntaxKind.MinusMinusToken: {
            return '--';
        }
        case ts.SyntaxKind.ExclamationToken: {
            return '!';
        }
        case ts.SyntaxKind.TildeToken: {
            return '~';
        }
        case ts.SyntaxKind.PlusToken: {
            return '+';
        }
        case ts.SyntaxKind.MinusToken: {
            return '-';
        }
        case ts.SyntaxKind.AsteriskToken: {
            return '*';
        }
        case ts.SyntaxKind.SlashToken: {
            return '/';
        }
        case ts.SyntaxKind.PercentToken: {
            return '%';
        }
        case ts.SyntaxKind.AsteriskAsteriskToken: {
            return '**';
        }
        case ts.SyntaxKind.PlusEqualsToken: {
            return '+=';
        }
        case ts.SyntaxKind.MinusEqualsToken: {
            return '-=';
        }
        case ts.SyntaxKind.AsteriskEqualsToken: {
            return '*=';
        }
        case ts.SyntaxKind.SlashEqualsToken: {
            return '/=';
        }
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken: {
            return '**=';
        }
        case ts.SyntaxKind.AmpersandToken: {
            return "&";
        }
        case ts.SyntaxKind.BarToken: {
            return "|";
        }
        case ts.SyntaxKind.CaretToken: {
            return "^";
        }
        case ts.SyntaxKind.LessThanLessThanToken: {
            return "<<";
        }
        case ts.SyntaxKind.GreaterThanGreaterThanToken: {
            return ">>";
        }
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken: {
            return ">>>";
        }
        case ts.SyntaxKind.AmpersandAmpersandToken: {
            return '&&';
        }
        case ts.SyntaxKind.BarBarToken: {
            return '||';
        }
        case ts.SyntaxKind.LessThanToken: {
            return '<';
        }
        case ts.SyntaxKind.LessThanEqualsToken: {
            return '<=';
        }
        case ts.SyntaxKind.GreaterThanToken: {
            return '>';
        }
        case ts.SyntaxKind.GreaterThanEqualsToken: {
            return '>=';
        }
        case ts.SyntaxKind.EqualsEqualsToken: {
            return '==';
        }
        case ts.SyntaxKind.EqualsEqualsEqualsToken: {
            return '===';
        }
        case ts.SyntaxKind.ExclamationEqualsToken: {
            return '!=';
        }
        case ts.SyntaxKind.ExclamationEqualsEqualsToken: {
            return '!==';
        }
        default: {
            console.assert(false, "Unknown operator " + node.kind);
            break;
        }
    }
};

/**
 * @param {ts.Node} node
 */
Ast.findTopLevelIfStatement = node => {
    while(node.parent.kind === ts.SyntaxKind.IfStatement) { 
        node = node.parent;
    }
    return node;
};

/**
 * @param {ts.Node} node
 */
Ast.findConstructor = node => {
    console.assert(node.kind === ts.SyntaxKind.ClassDeclaration || ts.SyntaxKind.ClassExpression);
    for(const member of node.members) {
        if(member.kind === ts.SyntaxKind.Constructor) {
            return member;
        }
    }
};

/**
 * @param {ts.Node} node
 * @param {ts.SyntaxKind} kind
 */
Ast.findAncestor = (node, kind) => {

    kind = Utility.toArray(kind);
    
    while(node !== undefined) {
        if(kind.indexOf(node.kind) != -1) {
            return node;
        }
        node = node.parent;
    }

    return undefined;

};

/**
 * @param {ts.Node} node
 */
Ast.copy = (node, parent) => {

    const copy = {};

    for(const [key, value] of Object.entries(node)) {
        if(key === 'parent') {
            copy.parent = parent;
        } else if(Utility.isObject(value)) {
            Ast.copy(value, copy);
        } else if(Utility.isArray(value)) {
            copy[key] = [];
            for(const n of value) {
                copy[key].push(Ast.copy(n, copy));
            }
        } else {
            copy[key] = value;
        }
    }

    return copy;

};

/**
 * @param {ts.Token} operator
 */
Ast.isArithmeticOperator = (operator) => {
    switch(operator.kind) {
        case ts.SyntaxKind.PlusToken:
        case ts.SyntaxKind.MinusToken:
        case ts.SyntaxKind.AsteriskToken:
        case ts.SyntaxKind.SlashToken:
        case ts.SyntaxKind.PercentToken: {
            return true;
        }
        default: {
            return false;
        }
    }
};

/**
 * @param {ts.Node} node
 * @param {String} arrayName
 */
Ast.findLastNodeOfArray = (node, arrayName) => {
    console.assert(node.hasOwnProperty(arrayName), 'Failed to find last node');
    const array = node[arrayName];
    const arrayLength = array.length;
    return arrayLength ? array[arrayLength - 1] : undefined;
};

/**
 * @param {ts.Node} node
 */
Ast.findLastStatement = node => {
    return Ast.findLastNodeOfArray(node, 'statements');
};

/**
 * @param {ts.Node} node
 */
Ast.findLastParameter = node => {
    return Ast.findLastNodeOfArray(node, 'parameters');
};

/**
 * @param {ts.Identifier} id
 */
Ast.isNameOfPropertyAccessExpression = id => {
    console.assert(id.kind === ts.SyntaxKind.Identifier);
    const parent = id.parent;
    return parent.kind === ts.SyntaxKind.PropertyAccessExpression && parent.name === id;
};

/**
 * @param {ts.Node} node
 */
Ast.nodeKindToString = node => {
    switch(node.kind) {
        case ts.SyntaxKind.FirstAssignment: {
            return "EqualsToken";
        }
        case ts.SyntaxKind.LastAssignment: {
            return 'CaretEqualsToken';
        }
        case ts.SyntaxKind.FirstCompoundAssignment: {
            return 'PlusEqualsToken';   
        }
        case ts.SyntaxKind.LastCompoundAssignment: {
            return 'CaretEqualsToken';
        }
        case ts.SyntaxKind.FirstReservedWord: {
            return 'BreakKeyword';
        }
        case ts.SyntaxKind.LastReservedWord: {
            return 'WithKeyword';
        }
        case ts.SyntaxKind.FirstKeyword: {
            return 'BreakKeyword';
        }
        case ts.SyntaxKind.LastKeyword: {
            return 'OfKeyword';
        }
        case ts.SyntaxKind.FirstFutureReservedWord: {
            return 'ImplementsKeyword';
        }
        case ts.SyntaxKind.LastFutureReservedWord: {
            return 'YieldKeyword';
        }
        case ts.SyntaxKind.FirstTypeNode: {
            return 'TypePredicate';
        }
        case ts.SyntaxKind.LastTypeNode: {
            return 'ImportType';
        }
        case ts.SyntaxKind.FirstPunctuation: {
            return 'OpenBraceToken';
        }
        case ts.SyntaxKind.LastPunctuation: {
            return 'CaretEqualsToken';
        }
        case ts.SyntaxKind.FirstToken: {
            return 'Unknown';
        }
        case ts.SyntaxKind.LastToken: {
            return 'OfKeyword';
        }
        case ts.SyntaxKind.FirstTriviaToken: {
            return 'SingleLineCommentTrivia';
        }
        case ts.SyntaxKind.LastTriviaToken: {
            return 'ConflictMarkerTrivia';
        }
        case ts.SyntaxKind.FirstLiteralToken: {
            return 'NumericLiteral';
        }
        case ts.SyntaxKind.LastLiteralToken: {
            return 'NoSubstitutionTemplateLiteral';
        }
        case ts.SyntaxKind.FirstTemplateToken: {
            return 'NoSubstitutionTemplateLiteral';
        }
        case ts.SyntaxKind.LastTemplateToken: {
            return 'TemplateTail';
        }
        case ts.SyntaxKind.FirstBinaryOperator: {
            return 'LessThanToken';
        }
        case ts.SyntaxKind.LastBinaryOperator: {
            return 'CaretEqualsToken';
        }
        case ts.SyntaxKind.FirstStatement: {
            return "VariableStatement";
        }
        case ts.SyntaxKind.LastStatement: {
            return 'DebuggerStatement';
        }
        case ts.SyntaxKind.FirstNode: {
            return 'QualifiedName';
        }
        case ts.SyntaxKind.FirstJSDocNode: {
            return 'JSDocTypeExpression';
        }
        case ts.SyntaxKind.LastJSDocNode: {
            return 'JSDocPropertyTag';
        }
        case ts.SyntaxKind.FirstJSDocTagNode: {
            return 'JSDocTag';
        }
        case ts.SyntaxKind.LastJSDocTagNode: {
            return 'JSDocPropertyTag';
        }
        default: {
            return Object.values(ts.SyntaxKind)[node.kind];
        }
    }
};

/**
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
 */
Ast.stripOutParenthesizedExpressions = node => {
    while(node.kind === ts.SyntaxKind.ParenthesizedExpression) {
        node = node.expression;
    } 
    return node;
};

/**
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
 */
Ast.findTopLevelParenthesizedExpression = node => {
    while(node.parent && node.parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
        node = node.parent;
    }
    return node;
};

/**
 * @param {ts.Block} node
 */
Ast.findNextStatementOfBlock = node => {
    if(node.parent.kind === ts.SyntaxKind.IfStatement) {
        node = Ast.findTopLevelIfStatement(node.parent);
    }
    return Ast.findRightSibling(node);
};

module.exports = Ast;