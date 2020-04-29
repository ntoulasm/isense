const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol_table');
const TypeCarrier = require('../utility/type_carrier');
const Ast = require('../ast/ast');
const AnalyzeDiagnostic = require('./analyze_diagnostic');
const DiagnosticMessages = require('./diagnostic-messages');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------


const FunctionAnalyzer = {};

/**
 * @param {ts.FunctionDeclaration} func
 */
FunctionAnalyzer.analyze = (func) => {

    func._original = func;
    func.freeVariables = new Set();
    func.typeVariables = new Set();

    if(!func.body) { return; }

    const inferParameterTypes = (node) => {
        if(node.parent && node.parent.unreachable) {
            node.unreachable = true;
        }
        switch(node.kind) {
            case ts.SyntaxKind.VariableDeclaration: {
                ts.forEachChild(node, inferParameterTypes);
                if(!node.initializer) { break; }
                const symbol = Ast.lookUp(node, node.name.getText());
                const rvalueTypes = getTypeVariable(node.initializer);
                if(rvalueTypes) {
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(symbol, rvalueTypes));
                }
                break;
            }
            case ts.SyntaxKind.BinaryExpression: {
                ts.forEachChild(node, inferParameterTypes);
                if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                    const lvalue = Ast.stripOutParenthesizedExpressions(node.left);
                    if(lvalue.kind === ts.SyntaxKind.Identifier) {
                        const symbol = Ast.lookUp(node, lvalue.getText());
                        const rvalueTypes = getTypeVariable(node.right);  
                        Ast.addTypeCarrierToExpression(node, TypeCarrier.create(symbol, rvalueTypes || [TypeCarrier.createUndefined()]));
                    } 
                }
                break;
            }
            // case ts.SyntaxKind.PropertyAccessExpression: {
            //     if(node.expression.kind === ts.SyntaxKind.Identifier) {
            //         const types = TypeDeducer.deduceTypes(node.expression);
            //         if(types.length === 1 && types[0].id === TypeCarrier.Type.TypeVariable) {
            //             Ast.addTypeCarrierToExpression(node, TypeCarrier.create(types[0].value, [{id: TypeCarrier.Type.Object}]));
            //         }
            //     }
            //     break;
            // }
            case ts.SyntaxKind.ReturnStatement: {
                if(!node.unreachable) {
                    markUnreachableStatements(Ast.findRightSiblings(node));
                }
                ts.forEachChild(node, inferParameterTypes);
                break;
            }
            case ts.SyntaxKind.Identifier: {
                if(Ast.isNameOfPropertyAccessExpression(node)) { break; }
                let parent = node.parent;
                const symbol = Ast.lookUp(node, node.text);
                if(!symbol) { break; }
                updateFreeVariables(func, node, symbol);
                const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
                if(!typeCarrier) { break; }
                const types = typeCarrier.getTypes();
                if(types.length === 1 && types[0].id !== TypeCarrier.Type.TypeVariable) { break; }
                const typeVariableSymbol = types[0].value;
                // if(!isParameterOfFunction(symbol, func)) { break; }
                // const declaration = symbol.declaration;
                node = Ast.findTopLevelParenthesizedExpression(node);
                parent = node.parent;
                if(parent.kind === ts.SyntaxKind.PropertyAccessExpression && parent.expression === node) {
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, [{id: TypeCarrier.Type.Object}]));
                } else if(parent.kind === ts.SyntaxKind.ElementAccessExpression && parent.expression === node) { 
                    const types = [
                        { id: TypeCarrier.Type.Array },
                        { id: TypeCarrier.Type.Object }
                    ];
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, types));
                } else if(parent.kind === ts.SyntaxKind.CallExpression && parent.expression && parent.expression === node) {
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, {id: TypeCarrier.Type.Function})); 
                } else if(parent.kind === ts.SyntaxKind.NewExpression && parent.expression && parent.expression === node) {
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, [{id: TypeCarrier.Type.Function}, {id: TypeCarrier.Type.Class}])); 
                } else if(parent.kind === ts.SyntaxKind.PrefixUnaryExpression && parent.operator !== ts.SyntaxKind.ExclamationToken) {
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, {id: TypeCarrier.Type.Number}));
                } else if(parent.kind === ts.SyntaxKind.PostfixUnaryExpression) {
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, {id: TypeCarrier.Type.Number}));
                } else if(parent.kind === ts.SyntaxKind.BinaryExpression) {
                    if(parent.operatorToken.kind === ts.SyntaxKind.PlusToken) {
                        const types = [
                            {id: TypeCarrier.Type.Number}, 
                            {id: TypeCarrier.Type.String}
                        ];
                        Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, types));
                    } else if(Ast.isArithmeticOperator(parent.operatorToken)) {
                        Ast.addTypeCarrierToExpression(node, TypeCarrier.create(typeVariableSymbol, {id: TypeCarrier.Type.Number}));
                    }
                }
                break;
            }
            case ts.SyntaxKind.Block: {
                ts.forEachChild(node, inferParameterTypes);
                Ast.copyTypeCarriersFromBlockToNextStatement(node);
                break;
            }
            default: {
                ts.forEachChild(node, inferParameterTypes);
            }
        }
    }

    declareParameters(func);
    ts.forEachChild(func.body, inferParameterTypes);

    for(const {symbol, type} of func.typeVariables) {
        const solution = Ast.findLastTypeCarrier(func.body, type.value);
        const typeCarrier = TypeCarrier.create(
            symbol, 
            solution ? solution.getTypes() : TypeCarrier.createAny()
        );
        Ast.addTypeCarrier(symbol.declaration, typeCarrier);
    }

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
            const type = TypeCarrier.createTypeVariable();
            Ast.addTypeCarrier(node, TypeCarrier.create(symbol, [type]));
            func.typeVariables.add({symbol, type});
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
    
    for(const stmt of stmts) {
        stmt.unreachable = true;
        Ast.addAnalyzeDiagnostic(
            stmt.getSourceFile(), 
            AnalyzeDiagnostic.create(stmt, DiagnosticMessages.unreachableStatement)
        );
    }

}

function getTypeVariable(node) {
    if(node.kind !== ts.SyntaxKind.Identifier) { return ; }
    const symbol = Ast.lookUp(node, node.getText());
    if(!symbol) { return ; }
    const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
    if(!typeCarrier) { return ; }
    const types = typeCarrier.getTypes();
    if(types.length === 1 && /* should not check this */ types[0] && types[0].id === TypeCarrier.Type.TypeVariable) {
        return types;
    }
}

module.exports = FunctionAnalyzer;