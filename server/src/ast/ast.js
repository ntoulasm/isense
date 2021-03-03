const Utility = require('../utility/utility');
// const TypeInfo = require('../utility/type-info');
const es5LibAst = require('../utility/es5-lib');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

const Ast = {};

// ----------------------------------------------------------------------------

Ast.asts = {};

// ----------------------------------------------------------------------------

const nodesWithInnerScope = [
    ts.SyntaxKind.Block,
    ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.ClassExpression,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.ForInStatement,
];

const conditionalNodes = [
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.CaseClause,
    ts.SyntaxKind.DefaultClause,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.WhileStatement
];

// ----------------------------------------------------------------------------

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
        if(Ast.isNodeOfInterest(child)) {
            children.push(child);
        }
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
    if(parent === undefined) { return [ node ]; }
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
 */
Ast.isNodeOfInterest = node =>
    node.kind > ts.SyntaxKind.LastToken ||
    node.kind === ts.SyntaxKind.Identifier;

/**
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
 */
Ast.findLeftSiblingWithoutInnerScope = node => {

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
Ast.findInnermostNode = (ast, offset, kind) => {
    function findInnermostNode(node) {
        if(node.getFullStart(ast) <= offset && node.end >= offset) {
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
        if(node.getStart(ast) <= offset && node.end >= offset) {
            const innermostNode = ts.forEachChild(node, findInnermostNodeOfAnyKind);
            return innermostNode || node; 
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
Ast.lookUp = (node, name) =>
    Ast.visitVisibleSymbols(node, s => s.name === name);

/**
 * @param {ts.Node} node 
 * @param {Function} callback 
 */
Ast.visitVisibleSymbols = (node, callback) => {

    function visitVisibleSymbolsInternal(node) {
        while(node) {
            if(node.symbols) { 
                for(const symbol of Object.values(node.symbols.getSymbols())) {
                    if(callback(symbol)) { return symbol; }
                }
            }
            node = Ast.findLeftSiblingWithoutInnerScope(node) || node.parent;
        }
    }

    return visitVisibleSymbolsInternal(node) || visitVisibleSymbolsInternal(es5LibAst);

};

/**
 * @param {ts.Node} node
 * 
 * @returns {Array<isense.symbol>}
 */
Ast.findVisibleSymbols = node => {

    const symbols = [];
    
    Ast.visitVisibleSymbols(node, s => {
        symbols.push(s);
        return false;
    });
    
    return symbols;

};

/**
 * @param {ts.Node} node
 * @param {isense.TypeBinder} binder
 */
Ast.addTypeBinder = (node, binder) => {
    binder.setParentNode(node);
    node.binders.push(binder);
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
 */
Ast.findRightMostDescendant = node => {
    const children = Ast.findChildren(node);
    const total = children.length;
    return total ? Ast.findRightMostDescendant(children[total - 1]) : node;
};

/**
 * @param {ts.IfStatement} node 
 */
Ast.findThenElseStatements = node => {

    const statements = [];

    /**
     * @param {ts.IfStatement} node 
     */
    const findThenElseStatementsInternal = node => {
        console.assert(node.kind === ts.SyntaxKind.IfStatement);
        statements.push(node.thenStatement);
        if(!node.elseStatement) { return; }
        if(node.elseStatement.kind === ts.SyntaxKind.IfStatement) {
            findThenElseStatementsInternal(node.elseStatement);
        } else {
            statements.push(node.elseStatement);
        }
    }

    findThenElseStatementsInternal(node);
    return statements;

};

Ast.findActiveTypeBindersInLeftSibling = (node, symbol, startNode, stopNode) => {
    if(node === stopNode) { return; }
    return Ast.findActiveTypeBindersInStatement(node, symbol, startNode, stopNode) || 
        Ast.findActiveTypeBinders(node, symbol, startNode, stopNode);
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol
 * @param {ts.Node} stopNode  
 */
Ast.findActiveTypeBindersInStatement = (node, symbol, startNode, stopNode) => {

    if(ts.isFunctionLike(node) || ts.isClassLike(node)) { return ; }

    switch(node.kind) {
        case ts.SyntaxKind.Block:
            return findActiveTypeBindersInBlock(node, symbol, startNode);
        case ts.SyntaxKind.IfStatement:
            return findActiveTypeBindersInIfStatement(node, symbol, startNode);
        case ts.SyntaxKind.SwitchStatement: 
            return findActiveTypeBindersInSwitchStatement(node, symbol, startNode);
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
            return findActiveTypeBindersInLoop(node, symbol, startNode);
        default: {
            const rightMostDescendant = Ast.findRightMostDescendant(node);
            return Ast.findActiveTypeBinders(rightMostDescendant, symbol, startNode, stopNode || node);
        }
    }

};

/**
 * Note: Search is starting from the lastStatement and not from the rightmost descendant.
 * This is to search in blocks / if-statements inside blocks.
 * 
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} startNode 
 */
function findActiveTypeBindersInBlock(node, symbol, startNode) {
    const lastStatement = Ast.findLastStatement(node);
    if(!lastStatement) { return ; }
    return Ast.findActiveTypeBindersInStatement(lastStatement, symbol, startNode, node);
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} startNode
 */
function findActiveTypeBindersInIfStatement(node, symbol, startNode) {

    const binders = [];
    const statements = Ast.findThenElseStatements(node);
    let hasEveryStatementABinder = true;
    
    for(const statement of statements) {
        const statementBinders = Ast.findActiveTypeBindersInStatement(statement, symbol, startNode);
        if(statementBinders) {
            binders.push(...statementBinders);
        } else {
            hasEveryStatementABinder = false;
        }
    }

    if(!hasElse(node) || !binders.length || !hasEveryStatementABinder) {
        let outerBinders = findActiveTypeBindersOutOfConditional(node, symbol, startNode);
        binders.push(...outerBinders);
    }

    return binders;

}

/**
 * When the search reaches a conditional node which is nested to another one, 
 * and the search began out of them, we stop the search when the outer node is reached.
 * The outer conditional will search in these nodes and we would end up searching the
 * same binders multiple times.
 * 
 * let x = 0;
 * if(a) {
 *     if(b) {
 *         x = 5;
 *     }
 * }
 * // Search active binders of x
 * 
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} startNode 
 */
function findActiveTypeBindersOutOfConditional(node, symbol, startNode) {
    const stopNode = findStopNodeOutOfConditional(node, startNode);
    return Ast.findActiveTypeBinders(node, symbol, startNode, stopNode) || [];
}

function findStopNodeOutOfConditional(node, startNode) {
    const parentConditionalStatement = Ast.findAncestor(node.parent, conditionalNodes);
    if(parentConditionalStatement && !Ast.isInner(parentConditionalStatement, startNode)) {
        return parentConditionalStatement;
    } 
}

/**
 * @param {ts.IfStatement} node 
 */
function hasElse(node) {
    if(!node.elseStatement) { return false; }
    if(node.elseStatement.kind !== ts.SyntaxKind.IfStatement) { return true; }
    return hasElse(node.elseStatement);
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} startNode
 */
function findActiveTypeBindersInSwitchStatement(node, symbol, startNode) {

    const clauses = node.caseBlock.clauses;
    const binders = clauses.flatMap(c => findActiveTypeBindersInBlock(c, symbol, startNode) || [])
    // TODO: Could this be more accurate?
    // It is more complicated than if-statements, because case clauses might fall-through.
    binders.push(...findActiveTypeBindersOutOfConditional(node, symbol, startNode));

    return binders;
    
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} startNode
 */
function findActiveTypeBindersInLoop(node, symbol, startNode) {
    const statement = node.statement;
    const binders = Ast.findActiveTypeBindersInStatement(statement, symbol, startNode) || [];
    binders.push(...findActiveTypeBindersOutOfConditional(node, symbol, startNode));
    return binders;
}

/**
 * e.g let point = createPoint(x, y);
 * On hover of point, its properties will be resolved.
 * But their binders exist inside createPoint. 
 * To reach them we need to search in the right sub-tree of the 'assignment' node.
 * So, the node which the search for active binders starts, is adjusted to start from the right sub-tree.
 * 
 * @param {ts.Identifier} node 
 */
Ast.AdjustObjectPropertyStartingSearchNode = node => {
    const isLeftPartOfAssignmentLike = Ast.isLeftPartOfAssignmentLike(node);
    return isLeftPartOfAssignmentLike || node;
};

Ast.isInner = (outer, inner) => 
    outer.pos <= inner.pos && inner.end <= outer.end;

Ast.isLeftPartOfAssignmentLike = node => {
    let currentNode = node;
    while(currentNode) {
        switch(currentNode.kind) {
            case ts.SyntaxKind.VariableDeclaration:
                if(Ast.isInner(currentNode.name, node)) {
                    return currentNode;
                }
                return false;
            case ts.SyntaxKind.BinaryExpression:
                if(currentNode.operatorToken.kind === ts.SyntaxKind.EqualsToken && 
                    Ast.isInner(currentNode.left, node)) {
                    return currentNode;
                }
                return false;
            default:
                currentNode = currentNode.parent;
                break;
        }
    }
    return false;
};

/**
 * @param {ts.Node} node
 * @param {object} symbol
 */
Ast.findActiveTypeBindersInParent = (node, symbol, startNode, stopNode) => {

    const parent = node.parent;

    // if(parent && parent.kind === ts.SyntaxKind.IfStatement) {
    //     const ifStatement = Ast.findTopLevelIfStatement(parent);
    //     return Ast.findActiveTypeBinders(ifStatement, symbol, startNode, stopNode);
    // }

    if(ts.isCallLikeExpression(node) && node.callee && node.callee.body) {
        const callee = node.callee;
        const binders = Ast.findActiveTypeBindersInStatement(
            callee.body,
            symbol,
            startNode,
            stopNode
        );
        if(binders) { return binders; }
    }

    if(ts.isFunctionLike(node) && node.call) {
        if(Ast.isClassMember(node)) {
            const classNode = node.parent;
            const binders = Ast.findActiveTypeBinders(node, symbol, startNode, classNode);
            if(binders && binders.length) { return binders; }
        } else {
            const binders = Ast.findActiveTypeBinders(node, symbol, startNode, node);
            if(binders) { return binders; }
        }
        return Ast.findActiveTypeBinders(node.call, symbol, startNode, stopNode);
    }

    // if the starting node of the search is child of assign expression, 
    // ignore the binder of the assign expression. 
    // e.g  let x = 2;
    //      x = x + 3;
    //      x on x + 3 needs to evaluate to 2.
    // Otherwise it is stack overflow
    //      evaluate(x + 3) -> evaluate(x) -> evaluate(x + 3) -> evaluate(x) -> ...
    if(Ast.isRightPartOfAssignment(node)) {
        const startNodeOffset = startNode.getStart();
        if(parent.getStart() <= startNodeOffset && startNodeOffset <= parent.getEnd()) {
            return Ast.findActiveTypeBinders(
                Ast.findLeftSibling(parent) || parent.parent,
                symbol,
                startNode,
                stopNode
            );
        }
    }

    return Ast.findActiveTypeBinders(node, symbol, startNode, stopNode);

};

Ast.isClassMember = node => 
    node.kind === ts.SyntaxKind.MethodDeclaration ||
    node.kind === ts.SyntaxKind.Constructor ||
    node.kind === ts.SyntaxKind.GetAccessor ||
    node.kind === ts.SyntaxKind.SetAccessor;

Ast.isAssignment = node =>
    node.kind === ts.SyntaxKind.BinaryExpression && 
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken;

Ast.isRightPartOfAssignment = node => 
    node.parent && Ast.isAssignment(node.parent) && node.parent.left !== node;

/**
 * @param {ts.Node} node
 * @param {object} symbol
 * @param {ts.Node} stopNode
 */
Ast.findActiveTypeBinders = (node, symbol, startNode = node, stopNode = undefined) => {

    const binder = getBinder(node, symbol);
    if(binder) { return [ binder ]; }

    if(node === stopNode) { return; }

    const parent = node.parent;
    const leftSibling = Ast.findLeftSibling(node);

    if(leftSibling) {
        return Ast.findActiveTypeBindersInLeftSibling(leftSibling, symbol, startNode, stopNode);
    } else if(parent) {
        return Ast.findActiveTypeBindersInParent(parent, symbol, startNode, stopNode);
    } else if(node !== es5LibAst) {
        return Ast.findActiveTypeBindersInParent(es5LibAst, symbol, startNode, stopNode);
    }

    return [];

};

function getBinder(node, symbol) {
    if(node.hasOwnProperty("binders")) {
        for(const binder of node.binders) {
            if(binder.symbol === symbol) {
                return binder;
            }
        }
    }
}

/**
 * @param {ts.Node} node
 */
Ast.findPreviousNode = node => {
    const leftSibling = Ast.findLeftSibling(node);
    return leftSibling ? leftSibling : node.parent;
};

/**
 * @param {ts.SourceFile} ast
 */
Ast.addAnalyzeDiagnostic = (ast, diagnostic) => {
    ast.analyzeDiagnostics.push(diagnostic);
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
Ast.isStatement = node =>
    node.kind >= ts.SyntaxKind.FirstStatement && 
    node.kind <= ts.SyntaxKind.LastStatement;

Ast.findStatementAncestor = node => {
    let currentNode = node
    while(currentNode) {
        if(Ast.isStatement(currentNode)) { return currentNode; }
        currentNode = currentNode.parent;
    }
    return node;
}

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
 * @param {ts.Node} node
 */
Ast.findNextStatement = node => {
    while(!node.parent.hasOwnProperty('statements')) {
        node = node.parent;
    }
    return Ast.findRightSibling(node);
};

/**
 * @param {ts.Identifier} node 
 */
Ast.isVariableDeclarationName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.VariableDeclaration && node.parent.name === node;
};

/**
 * @param {ts.Identifier} node
 */
Ast.isFunctionName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.FunctionDeclaration && node.parent.name === node;
};

/**
 * @param {ts.Identifier} node 
 */
Ast.isParameterName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.Parameter && node.parent.name === node;
    // TODO: handle destructuring pattern
};

/**
 * @param {ts.Identifier} node 
 */
Ast.isClassName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.ClassDeclaration && node.parent.name === node;
};

/**
 * @param {ts.Identifier} node 
 */
Ast.isPropertyName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.PropertyDeclaration && node.parent.name === node;
};

/**
 * @param {ts.Identifier} node 
 */
Ast.isMethodName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.MethodDeclaration && node.parent.name === node;
};

/**
 * @param {ts.Identifier} node 
 */
Ast.isGetterName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.GetAccessor && node.parent.name === node;
};

Ast.isSetterName = node => {
    return node.parent && node.parent.kind === ts.SyntaxKind.SetAccessor && node.parent.name === node;
};

/**
 * @param {ts.Node} node 
 */
Ast.isDeclarationName = node => {
    return Ast.isVariableDeclarationName(node) || 
        Ast.isFunctionName(node) ||
        Ast.isParameterName(node) ||
        Ast.isClassName(node) ||
        Ast.isPropertyName(node) ||
        Ast.isMethodName(node) ||
        Ast.isGetterName(node) ||
        Ast.isSetterName(node);
};

// ----------------------------------------------------------------------------

module.exports = Ast;