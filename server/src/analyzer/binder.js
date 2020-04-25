const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const TypeCarrier = require('../utility/type_carrier');
const TypeDeducer = require('../type-deducer/type_deducer');
const FunctionAnalyzer = require('./function-analyzer');

const ts = require('typescript');

//-----------------------------------------------------------------------------

const Binder = {};

const bindFunctionScopedDeclarationsFunctions = {};
const bindBlockScopedDeclarationsFunctions = {};
const noOp = () => {};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} body
 */
Binder.bindFunctionScopedDeclarations = body => {

    const bindFunctionScopedDeclarationsInternal = node => {
        if(bindFunctionScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
            bindFunctionScopedDeclarationsFunctions[node.kind](node, body);
        } else {
            ts.forEachChild(node, bindFunctionScopedDeclarationsInternal);
        }
    };
    
    ts.forEachChild(body, bindFunctionScopedDeclarationsInternal);

};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} block
 */
Binder.bindBlockScopedDeclarations = block => {

    const bindBlockScopedDeclarationsInternal = node => {
        if(bindBlockScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
            bindBlockScopedDeclarationsFunctions[node.kind](node, block);
        } else {
            ts.forEachChild(node, bindBlockScopedDeclarationsInternal);
        }
    };
    
    ts.forEachChild(block, bindBlockScopedDeclarationsInternal);

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

bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ImportClause] = (node, body) => {

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
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (node, body) => {
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
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] = (node, body) => {
    declareFunction(node, body);
    FunctionAnalyzer.analyze(node);
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, body) => {
    if(Ast.findAncestor(node, [ts.SyntaxKind.Block, ts.SyntaxKind.SourceFile]) !== body) { 
        return; 
    }
    declareClass(node, body);
};

bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassExpression] = 
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ForStatement] =
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ForOfStatement] =
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ForInStatement] = noOp;

//-----------------------------------------------------------------------------

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (node, block) => {
    if(Ast.isVarDeclaration(node.parent)) { return ; }
    declareBlockScopedVariable(node, block);
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, block) => {
    declareClass(node, block);
};

bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.Block] = 
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassExpression] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForStatement] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForOfStatement] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForInStatement] = noOp

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
 * import {x, y as z} ...
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
        bindBindingPatternDeclarations(node.name, (node, name, start, end) => {
            const symbol = Symbol.create(name, start, end, false, block.getStart());
            Ast.addTypeCarrier(block, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            block.symbols.insert(symbol);
        });
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
        if(Ast.lookUp(node, name)) { return; }
        const start = node.name.getStart();
        const end = node.name.end;
        const symbol = Symbol.create(name, start, end, isConst);

        block.symbols.insert(symbol);

    } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
        bindBindingPatternDeclarations(node.name, (node, name, start, end) => {
            const symbol = Symbol.create(name, start, end, isConst, node.name.getStart());
            block.symbols.insert(symbol);
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(symbol, [TypeCarrier.createUndefined()]))
        });
    } else {
        console.assert(false);
    }

}

//-----------------------------------------------------------------------------

/**
 * @param {ts.ArrayBindingPattern | ts.ObjectBindingPattern} node 
 * @param {(name: String, start: Number, end: Number) => void} declare 
 */
function bindBindingPatternDeclarations(node, declareSymbol) {

    const bindBindingPatternDeclarationsInternal = node => {
        switch(node.kind) {
            case ts.SyntaxKind.BindingElement: {
    
                if(node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.text;
                    const start = node.name.getStart();
                    const end = node.name.end;
                    declareSymbol(node, name, start, end);
                }
    
                ts.forEachChild(node, bindBindingPatternDeclarationsInternal);
                break;
    
            }
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.ClassExpression: {
                break;
            }
            default: {
                ts.forEachChild(node, bindBindingPatternDeclarationsInternal);
                break;
            }
        }
    };

    ts.forEachChild(node, bindBindingPatternDeclarationsInternal);

}

//-----------------------------------------------------------------------------

module.exports = Binder;