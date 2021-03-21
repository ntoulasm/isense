const Utility = require('../utility/utility');
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
Ast.hasParseError = ast =>
    ast.parseDiagnostics.find(d => d.category === ts.DiagnosticCategory.Error);

// ----------------------------------------------------------------------------

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
Ast.findSiblings = node => {
    if(!node.parent) { return [ node ]; }
    return Ast.findChildren(node.parent);
};

/**
 * @param {ts.Node} node
 * 
 * @returns {ts.Node}
 */
Ast.findLeftSibling = (node) => {
    const siblings = Ast.findSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    return nodeIndex && siblings[nodeIndex - 1];
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
 * @returns {Array<ts.Node>}
 */
Ast.findRightSiblings = node => {
    const siblings = Ast.findSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    console.assert(nodeIndex !== -1);
    return siblings.slice(nodeIndex + 1);
};

/**
 * 
 * @param {ts.Node} node 
 */
Ast.findRightMostDescendant = node => {
    const children = Ast.findChildren(node).filter(n => !ts.isFunctionLike(n));
    const total = children.length;
    return total ? Ast.findRightMostDescendant(children[total - 1]) : node;
};

// ----------------------------------------------------------------------------

Ast.findInnerMostNodeWithPredicate = (ast, offset, predicate) => {
    function findInnermostNodeInternal(node) {
        if(node.getFullStart(ast) <= offset && node.end >= offset) {
            if(predicate(node)) {
                const innermostNode = ts.forEachChild(node, findInnermostNodeInternal);
                return innermostNode || node;
            }
            return ts.forEachChild(node, findInnermostNodeInternal);
        }
    }
    return ts.forEachChild(ast, findInnermostNodeInternal);
};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 * @param {number} kind
 * 
 * @returns {ts.Node}
 */
Ast.findInnermostNode = (ast, offset, kind) => {
    function findInnermostNodeInternal(node) {
        if(node.getFullStart(ast) <= offset && node.end >= offset) {
            if(node.kind === kind) {
                const innermostNode = ts.forEachChild(node, findInnermostNodeInternal);
                return innermostNode || node;
            }
            return ts.forEachChild(node, findInnermostNodeInternal);
        }
    }
    return ts.forEachChild(ast, findInnermostNodeInternal);
};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 * 
 * @returns {ts.Node}
 */
Ast.findInnermostNodeOfAnyKind = (ast, offset) => {
    function findInnermostNodeOfAnyKindInternal(node) {
        if(node.getStart(ast) <= offset && node.end >= offset) {
            const innermostNode = ts.forEachChild(node, findInnermostNodeOfAnyKindInternal);
            return innermostNode || node; 
        }
    }
    return ts.forEachChild(ast, findInnermostNodeOfAnyKindInternal);
};

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 * @param {isense.TypeBinder} binder
 */
Ast.addTypeBinder = (node, binder) => {
    binder.setParentNode(node);
    node.binders.push(binder);
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
    callee._original.callSites.push(call);
};

// ----------------------------------------------------------------------------

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

Ast.findActiveTypeBindersInLeftSibling = (node, symbol, startNode, stopNode) => {
    if(node === stopNode) { return; }
    return Ast.findActiveTypeBindersInStatement(node, symbol, startNode, stopNode) || 
        Ast.findActiveTypeBinders(node, symbol, startNode, stopNode);
}

/**
 * @param {ts.Node} node
 * @param {object} symbol
 */
Ast.findActiveTypeBindersInParent = (node, symbol, startNode, stopNode) => {

    if(node === stopNode) { return; }

    const parent = node.parent;

    if(ts.isCallLikeExpression(node) && node.callee && node.callee.body && !Ast.isInner(node, startNode)) {
        // If parent is call expression and the search started in the call,
        // do not search in callee. 
        // let x = 2;
        // function f() { x = 5; }
        // f(x);
        // When the developer hovers over x in f(x);, x should be 2.
        // But if we search inside f we would find 5.
        return findActiveTypeBindersInCallExpression(node, symbol, startNode, stopNode);
    } else if(ts.isFunctionLike(node) && node.call) {
       return findActiveTypeBindersInCallSite(node, symbol, startNode, stopNode);
    } else if(Ast.isInRightPartOfAssignmentLike(node, startNode)) {
        return findActiveTypeBindersInAssignmentLike(parent, symbol, startNode, stopNode);
    } else if(Ast.isCaseClause(node)) {
        return Ast.findActiveTypeBinders(node.parent, symbol, startNode, stopNode);
    } else if(parent && parent.kind === ts.SyntaxKind.IfStatement && parent != stopNode) {
        return findActiveTypeBindersOutOfIfStatement([ parent.expression ], symbol, startNode);
    } else if(parent && parent.kind === ts.SyntaxKind.ForStatement && node === parent.statement) {
        return findActiveTypeBindersOutOfForStatement(parent, symbol, startNode);
    } else if(parent && parent.kind === ts.SyntaxKind.DoStatement && node === parent.statement) {
        return findActiveTypeBindersOutOfDoStatement(parent, symbol, startNode);
    }

    return Ast.findActiveTypeBinders(node, symbol, startNode, stopNode);
    
};

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
            return findActiveTypeBindersInForStatement(node, symbol, startNode);
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
            return findActiveTypeBindersInLoop(node, symbol, startNode);
        case ts.SyntaxKind.DoStatement:
            return findActiveTypeBindersInDoStatement(node, symbol, startNode);
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
    const conditionsToSearch = new Set();
    
    for(const statement of statements) {
        const statementBinders = Ast.findActiveTypeBindersInStatement(statement, symbol, startNode);
        if(statementBinders) {
            binders.push(...statementBinders);
        } else {
            conditionsToSearch.add(statement.parent.expression)
        }
    }

    if(!hasElse(node)) {
        conditionsToSearch.add(statements[statements.length - 1].parent.expression);
    }

    if(conditionsToSearch.size) {
        const outerBinders = findActiveTypeBindersOutOfIfStatement(
            [ ...conditionsToSearch ], symbol, startNode
        );
        binders.push(...outerBinders);
    }

    return binders;

}

/**
 * 
 * @param {Array} conditions 
 * @param {*} symbol 
 * @param {*} startNode 
 * @param {*} stopNode 
 * @returns 
 */
function findActiveTypeBindersOutOfIfStatement(conditions, symbol, startNode) {

    let condition = conditions[conditions.length - 1];
    let binders = [];
    
    while(condition) {
        const conditionBinders = Ast.findActiveTypeBindersInLeftSibling(condition, symbol, startNode, condition.parent);
        if(conditionBinders) {
            binders.push(...conditionBinders);
            condition = findNextConditionToSearch(condition, conditions);
        } else {
            condition = findPreviousCondition(condition);
        }
    }

    if(conditions.length) {
        const ifStatement = Ast.findTopLevelIfStatement(conditions[0].parent);
        binders.push(...findActiveTypeBindersOutOfConditional(ifStatement, symbol, startNode));
    }

    return binders;

}

function isPrior(node1, node2) {
    return node2 && node1.end <= node2.end;
}

function findPreviousCondition(node) {
    const ifStatement = node.parent;
    if(ifStatement.parent.kind === ts.SyntaxKind.IfStatement) {
        return ifStatement.parent.expression;
    }
}

function findNextConditionToSearch(current, conditions) {
    while(isPrior(current, conditions[conditions.length - 1])) { 
        conditions.splice(conditions.length - 1, 1);
    }
    return conditions[conditions.length - 1];
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
 * 
 * @param {ts.ForStatement} node 
 * @param {*} symbol 
 * @param {ts.Node} startNode 
 * @returns 
 */
function findActiveTypeBindersInForStatement(node, symbol, startNode) {
    const statement = node.statement;
    const statementBinders = Ast.findActiveTypeBindersInStatement(statement, symbol, startNode) || [];
    const outerBinders = findActiveTypeBindersOutOfForStatement(node, symbol, startNode);
    return [ ...statementBinders, ...outerBinders ];
}

function findActiveTypeBindersOutOfForStatement(node, symbol, startNode) {

    let initializerBinders;
    let conditionBinders;
    const initializer = node.initializer;
    const condition = node.condition;
    const incrementor = node.incrementor;
    const binders = [];

    if(incrementor) {
        const incrementorBinders = Ast.findActiveTypeBindersInLeftSibling(
            incrementor, symbol, startNode, condition || node
        ) || [];
        binders.push(...incrementorBinders);
    }

    if(condition && (conditionBinders = Ast.findActiveTypeBindersInLeftSibling(condition, symbol, startNode, node))) {
        binders.push(...conditionBinders);
    } else if(initializer && (initializerBinders = Ast.findActiveTypeBindersInLeftSibling(initializer, symbol, startNode, node))) {
        binders.push(...initializerBinders);
    } else {
        binders.push(...findActiveTypeBindersOutOfConditional(node, symbol, startNode));
    }

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
    binders.push(...findActiveTypeBindersOutOfLoop(node, symbol, startNode));
    return binders;
}

function findActiveTypeBindersOutOfLoop(node, symbol, startNode) {

    let conditionBinders;
    let initializerBinders;
    const condition = node.expression;
    const initializer = node.initializer;

    if(condition && (conditionBinders = Ast.findActiveTypeBindersInLeftSibling(condition, symbol, startNode, node))) {
        return conditionBinders;
    } else if(initializer && (initializerBinders = Ast.findActiveTypeBindersInLeftSibling(initializer, symbol, startNode, node))) {
        return initializerBinders
    }

    return findActiveTypeBindersOutOfConditional(node, symbol, startNode);

}

function findActiveTypeBindersInDoStatement(node, symbol, startNode) {
    const statement = node.statement;
    const binders = Ast.findActiveTypeBindersInStatement(statement, symbol, startNode) || [];
    binders.push(...findActiveTypeBindersOutOfDoStatement(node, symbol, startNode));
    return binders;
}

function findActiveTypeBindersOutOfDoStatement(node, symbol, startNode) {
    let conditionBinders;
    const condition = node.expression;
    if(condition && (conditionBinders = Ast.findActiveTypeBindersInLeftSibling(condition, symbol, startNode, node.statement))) {
        return conditionBinders;
    }
    return findActiveTypeBindersOutOfConditional(node, symbol, startNode);
}

function getBinder(node, symbol) {
    return node.binders && node.binders.find(b => b.symbol === symbol);
}

// ----------------------------------------------------------------------------

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
 * But when a function is in between of the two conditionals, 
 * and the search started out of them, we came there from a call,
 * and not from the outer conditional.
 * 
 * let x = 0;
 * let f;
 * 
 * if(a) {
 *     x = 1;
 *     f = () => {
 *        if(b) {
 *            x = 2;
 *        }
 *     }
 * }
 * 
 * f();
 * // Search for active type binders of 'x' starting here.
 * // x: number = 1 || number = 2
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
    if(parentConditionalStatement && !Ast.isInner(parentConditionalStatement, startNode) && !isFunctionBetween(node, parentConditionalStatement)) {
        return parentConditionalStatement;
    } 
}

function isFunctionBetween(inner, outer) {
    let current = inner;
    while(current != outer) {
        if(ts.isFunctionLike(current)) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

function findActiveTypeBindersInCallExpression(node, symbol, startNode, stopNode) {
    return Ast.findActiveTypeBindersInStatement(node.callee.body, symbol, startNode, stopNode) ||
        ts.isClassLike(node.callee.parent) && findActiveTypeBindersInMembers(node.callee.parent, symbol) ||
        Ast.findActiveTypeBinders(node, symbol, startNode, stopNode);
}

function findActiveTypeBindersInMembers(classNode, symbol) {
    for(const m of classNode.members) {
        const binder = getBinder(m, symbol);
        if(binder) { return [ binder ]; }
    }
}

function findActiveTypeBindersInCallSite(node, symbol, startNode, stopNode) {
    const localStopNode = Ast.isClassMember(node) ? node.parent : node;
    return Ast.findActiveTypeBinders(node, symbol, startNode, localStopNode) ||
        Ast.findActiveTypeBinders(node.call, symbol, startNode, stopNode);
}

/**
 * Note: if the starting node of the search is child of assign expression, 
 * ignore the binder of the assign expression. 
 * e.g  let x = 2;
 * x = x + 3;
 * x on x + 3 should evaluate to 2.
 * Otherwise it is stack overflow
 * evaluate(x + 3) -> evaluate(x) -> evaluate(x + 3) -> evaluate(x) -> ...
 */
function findActiveTypeBindersInAssignmentLike(node, symbol, startNode, stopNode) {
    const leftSibling = Ast.findLeftSibling(node);
    if(leftSibling) {
        return Ast.findActiveTypeBindersInLeftSibling(leftSibling, symbol, startNode, stopNode);
    }
    return Ast.findActiveTypeBindersInParent(node.parent, symbol, startNode, stopNode);
}

// ----------------------------------------------------------------------------

/**
 * @param {ts.IfStatement} node 
 */
function hasElse(node) {
    if(!node.elseStatement) { return false; }
    if(node.elseStatement.kind !== ts.SyntaxKind.IfStatement) { return true; }
    return hasElse(node.elseStatement);
}

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

/**
 * @param {ts.Node} node
 */
Ast.findTopLevelIfStatement = node => {
    while(node.parent.kind === ts.SyntaxKind.IfStatement) { 
        node = node.parent;
    }
    return node;
};

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

Ast.isInner = (outer, inner) => 
    outer.pos <= inner.pos && inner.end <= outer.end;

Ast.isInRightPartOfAssignmentLike = (node, checkNode) => {
    switch(node.kind) {
        case ts.SyntaxKind.VariableDeclaration:
            return node.initializer && Ast.isInner(node.initializer, checkNode);
        case ts.SyntaxKind.BinaryExpression:
            return node.operatorToken.kind === ts.SyntaxKind.EqualsToken && 
                node.right && Ast.isInner(node.right, checkNode);
    }
}

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
 */
Ast.findAncestorFunction = node => {
    while(node) {
        if(ts.isFunctionLike(node)) {
            return node;
        }
        node = node.parent;
    }
};

/**
 * @param {ts.Node} node
 * @param {isense.symbol} symbol
 * @param {ts.Node} functionNode
 */
Ast.isDeclaredInFunction = (node, symbol, functionNode) => {
    if(node.symbols && node.symbols.hasSymbol(symbol)) {
        return true;
    }
    if(node === functionNode) {
        return false;
    }
    const leftSibling = Ast.findLeftSibling(node);
    return Ast.isDeclaredInFunction(leftSibling || node.parent, symbol, functionNode);
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 */
Ast.findConstructor = node =>
    node.members.find(m => m.kind === ts.SyntaxKind.Constructor);

/**
 * @param {ts.Node} node
 * @param {ts.SyntaxKind} kind
 */
Ast.findAncestor = (node, kind) => {

    kind = Utility.toArray(kind);
    
    while(node) {
        if(kind.indexOf(node.kind) != -1) {
            return node;
        }
        node = node.parent;
    }

};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 * @param {String} arrayName
 */
Ast.findLastNodeOfArray = (node, arrayName) => {
    const array = node[arrayName];
    return array[array.length - 1];
};

/**
 * @param {ts.Node} node
 */
Ast.findLastStatement = node =>
    Ast.findLastNodeOfArray(node, 'statements');

/**
 * @param {ts.Node} node
 */
Ast.findLastParameter = node =>
    Ast.findLastNodeOfArray(node, 'parameters');

// ----------------------------------------------------------------------------

Ast.findStatementAncestor = node => {
    let currentNode = node
    while(currentNode) {
        if(Ast.isStatement(currentNode)) { return currentNode; }
        currentNode = currentNode.parent;
    }
    return node;
}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 */
Ast.operatorTokenToString = node => {
    switch(node.kind) {
        case ts.SyntaxKind.PlusPlusToken:
            return '++';
        case ts.SyntaxKind.MinusMinusToken:
            return '--';
        case ts.SyntaxKind.ExclamationToken:
            return '!';
        case ts.SyntaxKind.TildeToken:
            return '~';
        case ts.SyntaxKind.PlusToken:
            return '+';
        case ts.SyntaxKind.MinusToken:
            return '-';
        case ts.SyntaxKind.AsteriskToken:
            return '*';
        case ts.SyntaxKind.SlashToken:
            return '/';
        case ts.SyntaxKind.PercentToken:
            return '%';
        case ts.SyntaxKind.AsteriskAsteriskToken:
            return '**';
        case ts.SyntaxKind.PlusEqualsToken:
            return '+=';
        case ts.SyntaxKind.MinusEqualsToken:
            return '-=';
        case ts.SyntaxKind.AsteriskEqualsToken:
            return '*=';
        case ts.SyntaxKind.SlashEqualsToken:
            return '/=';
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
            return '**=';
        case ts.SyntaxKind.AmpersandToken:
            return "&";
        case ts.SyntaxKind.BarToken:
            return "|";
        case ts.SyntaxKind.CaretToken:
            return "^";
        case ts.SyntaxKind.LessThanLessThanToken:
            return "<<";
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
            return ">>";
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
            return ">>>";
        case ts.SyntaxKind.AmpersandAmpersandToken:
            return '&&';
        case ts.SyntaxKind.BarBarToken:
            return '||';
        case ts.SyntaxKind.LessThanToken:
            return '<';
        case ts.SyntaxKind.LessThanEqualsToken:
            return '<=';
        case ts.SyntaxKind.GreaterThanToken:
            return '>';
        case ts.SyntaxKind.GreaterThanEqualsToken:
            return '>=';
        case ts.SyntaxKind.EqualsEqualsToken:
            return '==';
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
            return '===';
        case ts.SyntaxKind.ExclamationEqualsToken:
            return '!=';
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            return '!==';
        default:
            console.assert(false, "Unknown operator " + node.kind);
            break;
    }
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 */
Ast.nodeKindToString = node => {
    switch(node.kind) {
        case ts.SyntaxKind.FirstAssignment:
            return "EqualsToken";
        case ts.SyntaxKind.LastAssignment:
            return 'CaretEqualsToken';
        case ts.SyntaxKind.FirstCompoundAssignment:
            return 'PlusEqualsToken';
        case ts.SyntaxKind.LastCompoundAssignment:
            return 'CaretEqualsToken';
        case ts.SyntaxKind.FirstReservedWord:
            return 'BreakKeyword';
        case ts.SyntaxKind.LastReservedWord:
            return 'WithKeyword';
        case ts.SyntaxKind.FirstKeyword:
            return 'BreakKeyword';
        case ts.SyntaxKind.LastKeyword:
            return 'OfKeyword';
        case ts.SyntaxKind.FirstFutureReservedWord:
            return 'ImplementsKeyword';
        case ts.SyntaxKind.LastFutureReservedWord:
            return 'YieldKeyword';
        case ts.SyntaxKind.FirstTypeNode:
            return 'TypePredicate';
        case ts.SyntaxKind.LastTypeNode:
            return 'ImportType';
        case ts.SyntaxKind.FirstPunctuation:
            return 'OpenBraceToken';
        case ts.SyntaxKind.LastPunctuation:
            return 'CaretEqualsToken';
        case ts.SyntaxKind.FirstToken:
            return 'Unknown';
        case ts.SyntaxKind.LastToken:
            return 'OfKeyword';
        case ts.SyntaxKind.FirstTriviaToken:
            return 'SingleLineCommentTrivia';
        case ts.SyntaxKind.LastTriviaToken:
            return 'ConflictMarkerTrivia';
        case ts.SyntaxKind.FirstLiteralToken:
            return 'NumericLiteral';
        case ts.SyntaxKind.LastLiteralToken:
            return 'NoSubstitutionTemplateLiteral';
        case ts.SyntaxKind.FirstTemplateToken:
            return 'NoSubstitutionTemplateLiteral';
        case ts.SyntaxKind.LastTemplateToken:
            return 'TemplateTail';
        case ts.SyntaxKind.FirstBinaryOperator:
            return 'LessThanToken';
        case ts.SyntaxKind.LastBinaryOperator:
            return 'CaretEqualsToken';
        case ts.SyntaxKind.FirstStatement:
            return "VariableStatement";
        case ts.SyntaxKind.LastStatement:
            return 'DebuggerStatement';
        case ts.SyntaxKind.FirstNode:
            return 'QualifiedName';
        case ts.SyntaxKind.FirstJSDocNode:
            return 'JSDocTypeExpression';
        case ts.SyntaxKind.LastJSDocNode:
            return 'JSDocPropertyTag';
        case ts.SyntaxKind.FirstJSDocTagNode:
            return 'JSDocTag';
        case ts.SyntaxKind.LastJSDocTagNode:
            return 'JSDocPropertyTag';
        default:
            return Object.values(ts.SyntaxKind)[node.kind];
    }
};

// ----------------------------------------------------------------------------

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
    while(node.parent.kind === ts.SyntaxKind.ParenthesizedExpression) {
        node = node.parent;
    }
    return node;
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node 
 */
Ast.isDeclarationName = node =>
    Ast.isVariableDeclarationName(node) || 
    Ast.isFunctionName(node) ||
    Ast.isParameterName(node) ||
    Ast.isClassName(node) ||
    Ast.isPropertyName(node) ||
    Ast.isMethodName(node) ||
    Ast.isGetterName(node) ||
    Ast.isSetterName(node);

/**
 * @param {ts.Identifier} node 
 */
Ast.isVariableDeclarationName = node =>
    node.parent.kind === ts.SyntaxKind.VariableDeclaration && 
    node.parent.name === node;

/**
 * @param {ts.Identifier} node
 */
Ast.isFunctionName = node =>
    node.parent.kind === ts.SyntaxKind.FunctionDeclaration && 
    node.parent.name === node;

/**
 * @param {ts.Identifier} node 
 */
Ast.isParameterName = node =>
    node.parent.kind === ts.SyntaxKind.Parameter && 
    node.parent.name === node;
    // TODO: handle destructuring pattern

/**
 * @param {ts.Identifier} node 
 */
Ast.isClassName = node =>
    node.parent.kind === ts.SyntaxKind.ClassDeclaration && 
    node.parent.name === node;

/**
 * @param {ts.Identifier} node 
 */
Ast.isPropertyName = node =>
    node.parent.kind === ts.SyntaxKind.PropertyDeclaration && 
    node.parent.name === node;

/**
 * @param {ts.Identifier} node 
 */
Ast.isMethodName = node =>
    node.parent.kind === ts.SyntaxKind.MethodDeclaration && 
    node.parent.name === node;

/**
 * @param {ts.Identifier} node 
 */
Ast.isGetterName = node =>
    node.parent.kind === ts.SyntaxKind.GetAccessor && 
    node.parent.name === node;

/**
 * @param {ts.Identifier} node 
 */
Ast.isSetterName = node =>
    node.parent.kind === ts.SyntaxKind.SetAccessor && 
    node.parent.name === node;

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} variableDeclarationList
 * 
 * @returns {Boolean}
 */
Ast.isConstDeclaration = variableDeclarationList => 
    (variableDeclarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const;

/**
 * @param {ts.Node} variableDeclarationList
 * 
 * @returns {Boolean}
 */
Ast.isLetDeclaration = variableDeclarationList =>
    (variableDeclarationList.flags & ts.NodeFlags.Let) === ts.NodeFlags.Let;

/**
 * @param {ts.Node} variableDeclarationList
 * 
 * @returns {Boolean}
 */
Ast.isVarDeclaration = variableDeclarationList =>
    !Ast.isConstDeclaration(variableDeclarationList) && 
    !Ast.isLetDeclaration(variableDeclarationList);

// ----------------------------------------------------------------------------

/**
 * @param {ts.Identifier} id
 */
Ast.isNameOfPropertyAccessExpression = id =>
    id.parent.kind === ts.SyntaxKind.PropertyAccessExpression && 
    id.parent.name === id;

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node 
 */
Ast.isStatement = node =>
    node.kind >= ts.SyntaxKind.FirstStatement && 
    node.kind <= ts.SyntaxKind.LastStatement;

Ast.isClassMember = node => 
    node.parent && ts.isClassLike(node.parent);

Ast.isAssignment = node =>
    node.kind === ts.SyntaxKind.BinaryExpression && 
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken;

Ast.isCaseClause = node =>
    node.kind === ts.SyntaxKind.CaseClause || 
    node.kind === ts.SyntaxKind.DefaultClause;
    
// ----------------------------------------------------------------------------

module.exports = Ast;