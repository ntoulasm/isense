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
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (node, body) => {

    if(Ast.isVarDeclaration(node.parent)) {
        if(node.name.kind === ts.SyntaxKind.Identifier) {
            const name = node.name.text;
            const start = node.name.getStart();
            const end = node.name.end;
            const symbol = Symbol.create(name, start, end, false, body.getStart());
            Ast.addTypeCarrier(body, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            body.symbols.insert(symbol);
        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
            // visitDestructuringDeclerations(node.name, (name, start, end) => {
            //     const symbol = Symbol.create(name, start, end, false, body.getStart());
            //     Ast.addTypeCarrier(body, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            //     // Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            //     body.symbols.insert(symbol);
            // });
        }
    } else if(Ast.findAncestor(node, [ts.SyntaxKind.Block, ts.SyntaxKind.SourceFile]) === body) {

        const isConst = Ast.isConstDeclaration(node.parent);
        if(node.name.kind === ts.SyntaxKind.Identifier) {
            const name = node.name.text;
            const start = node.name.getStart();
            const end = node.name.end;
            const symbol = Symbol.create(name, start, end, isConst);
            body.symbols.insert(symbol);
        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
            // visitDestructuringDeclerations(node.name, (name, start, end) => {
            //     const symbol = Symbol.create(name, start, end, isConst, node.name.getStart());
            //     // Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            //     body.symbols.insert(symbol);
            // });
        }

    }

};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] = (node, body) => {

    const name = node.name.text;
    const start = node.getStart();
    const end = node.end;
    const symbol = Symbol.create(name, start, end, false, body.getStart());

    body.symbols.insert(symbol);
    Ast.addTypeCarrier(body, TypeCarrier.create(symbol, TypeDeducer.deduceTypes(node)));

};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
hoistFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, body) => {

    if(Ast.findAncestor(node, [ts.SyntaxKind.Block, ts.SyntaxKind.SourceFile]) !== body) { return; }
    
    const name = node.name.text;
    const start = node.getStart();
    const end = node.end;
    const symbol = Symbol.create(name, start, end);
    
    body.symbols.insert(symbol);
    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, TypeDeducer.deduceTypes(node)));

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

    if(!Ast.isVarDeclaration(node.parent)) {
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

};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
hoistBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] = (node, block) => {
    const name = node.name.text;
    const start = node.getStart();
    const end = node.end;
    const symbol = Symbol.create(name, start, end);
    block.symbols.insert(symbol);
    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, TypeDeducer.deduceTypes(node)));
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

module.exports = Hoist;