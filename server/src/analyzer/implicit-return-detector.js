const ts = require("typescript");

// ----------------------------------------------------------------------------

function doesReturnOnAllControlPaths(node) {
    return ts.forEachChild(node, doesReturnOnAllControlPathsInternal);
}

/**
 * 
 * @param {ts.Node} node 
 * @returns 
 */
function doesReturnOnAllControlPathsInternal(node) {

    if(!node || node.unreachable) { return false; } 
    
    switch(node.kind) {
        case ts.SyntaxKind.IfStatement:
            if(doesReturnOnAllControlPaths(node.thenStatement) &&
                doesReturnOnAllControlPaths(node.elseStatement)) {
                return true;
            }
            break;
        case ts.SyntaxKind.Block:
            if(doesReturnOnAllControlPaths(node)) {
                return true;
            }
            break;
        case ts.SyntaxKind.SwitchStatement: {
            const clauses = node.caseBlock.clauses;
            if(!clauses.length || !hasDefaultClase(node)) { return false; }
            for(const clause of clauses) {
                if(!doesReturnOnAllControlPaths(clause) && (doesNotFallThrough(clause) || clause == clauses[clauses.length - 1])) {
                    return false;
                }
            }
            return true;
        }
        case ts.SyntaxKind.BreakStatement:
        case ts.SyntaxKind.ContinueStatement:
            return false;
        case ts.SyntaxKind.ReturnStatement:
            return true;
        default:
            break;
    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.CaseClause} node 
 */
function doesNotFallThrough(node) {
    return ts.forEachChild(node, doesNotFallThroughInternal);
}

function doesNotFallThroughInternal(node) {
    if(!node) { return; }
    switch(node.kind) {
        case ts.SyntaxKind.IfStatement:
            if(doesNotFallThrough(node.thenStatement) &&
                doesNotFallThrough(node.elseStatement)) {
                    return true;
            }
            break;
        case ts.SyntaxKind.Block:
            if(doesNotFallThrough(node)) {
                return true;
            }
            break;
        case ts.SyntaxKind.BreakStatement:
        case ts.SyntaxKind.ReturnStatement:
        case ts.SyntaxKind.ThrowStatement:
            return true;
        default: break;
    }
}

/**
 * @param {ts.SwitchStatement} node
 */
function hasDefaultClase(node) {
    return node.caseBlock.clauses.find(c => 
        c.kind === ts.SyntaxKind.DefaultClause
    );
}

// ----------------------------------------------------------------------------

module.exports = {
    doesNotFallThrough,
    doesReturnOnAllControlPaths
};