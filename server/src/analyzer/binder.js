const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol-table');
const TypeInfo = require('../utility/type-info');
const TypeBinder = require('../utility/type-binder');

// ----------------------------------------------------------------------------

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

    if(!body) { return ; }

    body.symbols = SymbolTable.create();

    const bindFunctionScopedDeclarationsInternal = node => {
        let iterateChildren = true;
        if(bindFunctionScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
            iterateChildren = !!bindFunctionScopedDeclarationsFunctions[node.kind](node, body);
        }
        if(iterateChildren) {
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

    block.symbols = SymbolTable.create();

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
    return true;
};

/**
 * @param {ts.FunctionDeclaration} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] = (node, body) => {
    declareFunction(node, body);
    node._original = node;
    node.freeVariables = new Set();
    declareParameters(node);
    Binder.bindFunctionScopedDeclarations(node.body);
};

/**
 * @param {ts.ClassDeclaration} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, body) => {
    if(Ast.findAncestor(node, [ts.SyntaxKind.Block, ts.SyntaxKind.SourceFile]) !== body) { 
        return; 
    }
    declareClass(node, body);
};

/**
 * @param {ts.Node} node
 * @param {ts.Block} body 
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] = (node, body) => {
    node._original = node;
    node.freeVariables = new Set();
    declareParameters(node);
    Binder.bindFunctionScopedDeclarations(node.body);
}

/**
 * @param {ts.Block} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.Block] = (node, body) => {
    Binder.bindBlockScopedDeclarations(node);
    return true;
};

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

/**
 * @param {ts.Block} node
 * @param {ts.Block} block
 */
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.Block] = (node, block) => {
    Binder.bindBlockScopedDeclarations(node);
};

bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] =
// bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.Block] = 
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
    Ast.addTypeBinder(block, TypeBinder.create(symbol, TypeInfo.createUndefined()));    // TODO: Fixme

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
    Ast.addTypeBinder(block, TypeBinder.create(symbol, TypeInfo.createAny)); // TODO: Fixme

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
    Ast.addTypeBinder(block, TypeBinder.create(symbol, TypeInfo.createAny()));    // TODO: Fixme

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
    Ast.addTypeBinder(block, TypeBinder.create(symbol, TypeInfo.createFunction(node)));

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
        Ast.addTypeBinder(block, TypeBinder.create(symbol, TypeInfo.createUndefined()));

    } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
        bindBindingPatternDeclarations(node.name, (node, name, start, end) => {
            const symbol = Symbol.create(name, start, end, false, block.getStart());
            Ast.addTypeBinder(block, TypeBinder.create(symbol, TypeInfo.createUndefined()));
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
    Ast.addTypeBinder(node, TypeBinder.create(symbol, TypeInfo.createClass(node)));

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
            Ast.addTypeBinderToExpression(node, TypeBinder.create(symbol, [TypeInfo.createUndefined()]))
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

/**
 * @param {ts.Node} func
 */
function declareParameters(func) {

    console.assert(func.parameters);

    for(const node of func.parameters) {
        node.symbols = SymbolTable.create();
        if(node.name.kind === ts.SyntaxKind.Identifier) {
            const name = node.name.text;
            // const start = node.name.getStart();
            // const end = node.name.end;
            const symbol = Symbol.createDeclaration(name, node);
            const type = TypeInfo.createAny();
            Ast.addTypeBinder(node, TypeBinder.create(symbol, [type]));
            node.symbols.insert(symbol);
        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
            // visitDestructuringDeclerations(node.name, (name, start, end) => {
            //     const symbol = Symbol.create(name, start, end);
            //     Ast.addTypeBinder(node, TypeBinder.create(symbol, TypeInfo.createUndefined()));
            //     node.symbols.insert(symbol);
            // });
        } else {
            console.assert(false);
        }
    }

}

//-----------------------------------------------------------------------------

module.exports = Binder;