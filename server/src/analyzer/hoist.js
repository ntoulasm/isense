const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const TypeCarrier = require('../utility/type_carrier');
const TypeDeducer = require('../type-deducer/type_deducer');

const ts = require('typescript');

//-----------------------------------------------------------------------------

const Hoist = {};

const hoistFunctionScopedDeclarationsFunctions = {};
const hoistBlockScopedDeclarationsFunctions = {};
const noOp = () => {};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} body
 */
Hoist.hoistFunctionScopedDeclarations = body => {

    const hoistFunctionScopedDeclarationsInternal = node => {
        if(hoistFunctionScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
            hoistFunctionScopedDeclarationsFunctions[node.kind](node, body);
        } else {
            ts.forEachChild(node, hoistFunctionScopedDeclarationsInternal);
        }
    };
    
    ts.forEachChild(body, hoistFunctionScopedDeclarationsInternal);

};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} block
 */
Hoist.hoistBlockScopedDeclarations = block => {

    const hoistBlockScopedDeclarationsInternal = node => {
        if(hoistBlockScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
            hoistBlockScopedDeclarationsFunctions[node.kind](node, block);
        } else {
            ts.forEachChild(node, hoistBlockScopedDeclarationsInternal);
        }
    };
    
    ts.forEachChild(block, hoistBlockScopedDeclarationsInternal);

};

//-----------------------------------------------------------------------------

/** 
 * import x ...
 * import {x, y as ...} ...
 * import x, {x, ...} ...
 * import * as x...
 * import ..., * as x
 * 
 * @param {ts.ImportClause} node
 * @param {ts.Block} body
 */

hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ImportClause] = (node, body) => {

    if(node.hasOwnProperty('name') && node.name.kind === ts.SyntaxKind.Identifier) {
        declareImportClause(node, body);
    }
    
    if(node.hasOwnProperty('namedBindings')) {
        switch(node.namedBindings.kind) {
            case ts.SyntaxKind.NamedImports: {
                node.namedBindings.elements.forEach(e => { declareImportSpecifier(e, body); });
                break;
            }
            case ts.SyntaxKind.NamespaceImport: {
                declareNamespaceImport(node.namedBindings, body);
                break;
            }
            default: {
                console.assert(false, '');
                break;
            }
        }
    }  

}

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (node, body) => {
    if(Ast.isVarDeclaration(node.parent)) {
        declareFunctionScopedVariable(node, body);
    } else if(Ast.findAncestor(node, [ts.SyntaxKind.Block, ts.SyntaxKind.SourceFile]) === body) {
        declareBlockScopedVariable(node, body);
    }
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] = (node, body) => {
    declareFunction(node, body);
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, body) => {
    if(Ast.findAncestor(node, [ts.SyntaxKind.Block, ts.SyntaxKind.SourceFile]) !== body) { 
        return; 
    }
    declareClass(node, body);
};

hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassExpression] = noOp;

//-----------------------------------------------------------------------------

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (node, block) => {
    if(Ast.isVarDeclaration(node.parent)) { return ; }
    declareBlockScopedVariable(node, block);
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, block) => {
    declareClass(node, block);
};

hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.Block] = 
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] =
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassExpression] =
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForStatement] =
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForOfStatement] =
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForInStatement] = noOp

//-----------------------------------------------------------------------------

/**    
 * import x, ...
 * 
 * @param {ts.ImportClause} node
 * @param {ts.Block} block
 */
function declareImportClause(node, block) {

    const name = node.name.escapedText;
    const start = node.name.getStart();
    const end = node.name.end;
    const symbol = Symbol.create(name, start, end);

    block.symbols.insert(symbol);
    Ast.addTypeCarrier(block, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));    // TODO: Fixme

}

/**
 * import {x, ...} ...
 * 
 * @param {ts.ImportSpecifier} node 
 * @param {ts.Block} block 
 */
function declareImportSpecifier(node, block) {

    const name = node.name.text;
    const start = node.name.getStart();
    const end = node.name.end;
    const symbol = Symbol.create(name, start, end);

    block.symbols.insert(symbol);
    Ast.addTypeCarrier(block, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined})); // TODO: Fixme

}

/**
 * import * as ...
 * import ..., * as ...
 * 
 * @param {ts.NamespaceImport} node 
 * @param {ts.Block} block 
 */
function declareNamespaceImport(node, block) {

    const name = node.name.text;
    const start = node.name.getStart();
    const end = node.name.end;
    const symbol = Symbol.create(name, start, end);

    block.symbols.insert(symbol);
    Ast.addTypeCarrier(block, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));    // TODO: Fixme

}

/**
 * @param {ts.FunctionDeclaration} node
 * @param {ts.Block} block
 */
function declareFunction(node, block) {

    const name = node.name.text;
    const start = node.getStart();
    const end = node.end;
    const symbol = Symbol.create(name, start, end, false, block.getStart());

    block.symbols.insert(symbol);
    Ast.addTypeCarrier(block, TypeCarrier.create(symbol, TypeDeducer.deduceTypes(node)));

}

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
function declareFunctionScopedVariable(node, block) {

    if(node.name.kind === ts.SyntaxKind.Identifier) {

        const name = node.name.text;
        const start = node.name.getStart();
        const end = node.name.end;
        const symbol = Symbol.create(name, start, end, false, block.getStart());

        block.symbols.insert(symbol);
        Ast.addTypeCarrier(block, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));

    } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
        // visitDestructuringDeclerations(node.name, (name, start, end) => {
        //     const symbol = Symbol.create(name, start, end, false, body.getStart());
        //     Ast.addTypeCarrier(body, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
        //     // Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
        //     body.symbols.insert(symbol);
        // });
    } else {
        console.assert(false);
    }

}

/**
 * @param {ts.ClassDeclaration} node
 * @param {ts.Block} block
 */
function declareClass(node, block) {

    const name = node.name.text;
    const start = node.getStart();
    const end = node.end;
    const symbol = Symbol.create(name, start, end);

    block.symbols.insert(symbol);
    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, TypeDeducer.deduceTypes(node)));

}

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
function declareBlockScopedVariable(node, block) {

    const isConst = Ast.isConstDeclaration(node.parent);

    if(node.name.kind === ts.SyntaxKind.Identifier) {

        const name = node.name.text;
        const start = node.name.getStart();
        const end = node.name.end;
        const symbol = Symbol.create(name, start, end, isConst);

        block.symbols.insert(symbol);

    } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
        // visitDestructuringDeclerations(node.name, (name, start, end) => {
        //     const symbol = Symbol.create(name, start, end, isConst, node.name.getStart());
        //     // Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
        //     block.symbols.insert(symbol);
        // });
    } else {
        console.assert(false);
    }

}

//-----------------------------------------------------------------------------

module.exports = Hoist;