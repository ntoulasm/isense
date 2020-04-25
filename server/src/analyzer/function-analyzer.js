const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol_table');
const TypeCarrier = require('../utility/type_carrier');
const Ast = require('../ast/ast');

const ts = require('typescript');


const FunctionAnalyzer = {};

/**
 * @param {ts.FunctionDeclaration} func
 */
FunctionAnalyzer.analyze = (func) => {

    func._original = func;
    func.freeVariables = new Set();

    const inferParameterTypes = (node) => {
        if(node.parent && node.parent.unreachable) {
            node.unreachable = true;
        }
        switch(node.kind) {
            case ts.SyntaxKind.ReturnStatement: {
                if(node.unreachable) { break; }
                markUnreachableStatements(Ast.findRightSiblings(node));
                break;
            }
            case ts.SyntaxKind.Identifier: {
                if(Ast.isNameOfPropertyAccessExpression(node)) { break; }
                let parent = node.parent;
                const symbol = Ast.lookUp(node, node.text);
                if(symbol) { updateFreeVariables(func, node, symbol); }
                if(!isParameterOfFunction(symbol, func)) { break; }
                const declaration = symbol.declaration;
                node = Ast.findTopLevelParenthesizedExpression(node);
                parent = node.parent;
                if(parent.kind === ts.SyntaxKind.PropertyAccessExpression && parent.expression === node) {
                    Ast.addTypeCarrier(declaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Object}));
                } else if(parent.kind === ts.SyntaxKind.ElementAccessExpression && parent.expression === node) { 
                    const types = [
                        { id: TypeCarrier.Type.Array },
                        { id: TypeCarrier.Type.Object }
                    ];
                    Ast.addTypeCarrier(declaration, TypeCarrier.create(symbol, types));
                } else if(parent.kind === ts.SyntaxKind.PrefixUnaryExpression && parent.operator !== ts.SyntaxKind.ExclamationToken) {
                    Ast.addTypeCarrier(declaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Number}));
                } else if(parent.kind === ts.SyntaxKind.PostfixUnaryExpression) {
                    Ast.addTypeCarrier(declaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Number}));
                } else if(parent.kind === ts.SyntaxKind.BinaryExpression) {
                    if(parent.operatorToken.kind === ts.SyntaxKind.PlusToken) {
                        const types = [
                            {id: TypeCarrier.Type.Number}, 
                            {id: TypeCarrier.Type.String}
                        ];
                        Ast.addTypeCarrier(declaration, TypeCarrier.create(symbol, types));
                    } else if(Ast.isArithmeticOperator(parent.operatorToken)) {
                        Ast.addTypeCarrier(declaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Number}));
                    }
                }
                break;
            }
            default: {
                ts.forEachChild(node, inferParameterTypes);
            }
        }
    }

    declareParameters(func);
    ts.forEachChild(func.body, inferParameterTypes);

};

/**
 * 
 * @param {ts.Node} func 
 */
function updateFreeVariables(func, node, symbol) {
    if(!Ast.isDeclaredInFunction(node, symbol, func)) {
        func.freeVariables.add(symbol);
    }
}

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
            Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            node.symbols.insert(symbol);
        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
            // visitDestructuringDeclerations(node.name, (name, start, end) => {
            //     const symbol = Symbol.create(name, start, end);
            //     Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            //     node.symbols.insert(symbol);
            // });
        } else {
            console.assert(false);
        }
    }

}

/**
 * @param {isense.symbol} symbol 
 * @param {ts.Node} func
 * 
 * @returns {Boolean} 
 */
function isParameterOfFunction(symbol, func) {
    if(!symbol) { return false; }
    return symbol.declaration && symbol.declaration.kind === ts.SyntaxKind.Parameter && Ast.findAncestorFunction(symbol.declaration) === func
}


/**
 * @param {Array<ts.Node>} stmts
 */
function markUnreachableStatements(stmts) {

    if(!stmts.length) { return ; }
    const ast = stmts[0].getSourceFile();
    
    for(const stmt of stmts) {
        stmt.unreachable = true;
    }

}

module.exports = FunctionAnalyzer;