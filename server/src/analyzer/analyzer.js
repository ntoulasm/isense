const Ast = require('../utility/ast');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol_table');
const Stack = require('../utility/stack');
const TypeCarrier = require('../utility/type_carrier');
const AnalyzeDiagnostic = require('./analyze_diagnostic');

const ts = require('typescript');

const Analyzer = {};

/**
 * @param {ts.SourceFile} ast 
 */
Analyzer.analyze = function(ast) {
    
    const classStack = Stack.create();
    const functionStack = Stack.create();
    const nonPureFunctions = new Set();

    ast.analyzeDiagnostics = [];
    ast.symbols = SymbolTable.create();

    /**
     * @param {ts.SourceFile} node 
     * @param {symbolTable} symbolTable 
     * @param {boolean} isConst 
     */
    function visitDestructuringDeclerations(node, createSymbol) {
        function visitDestructuringDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.BindingElement: {

                    if(node.name.kind === ts.SyntaxKind.Identifier) {
                        const name = node.name.text;
                        const start = node.name.getStart();
                        const end = node.name.end;
                        createSymbol(name, start, end);
                    }

                    ts.forEachChild(node, visitDestructuringDeclarations);
                    break;

                }
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.ClassExpression: {
                    break;
                }
                default: {
                    ts.forEachChild(node, visitDestructuringDeclarations);
                    break;
                }
            }
        }
        ts.forEachChild(node, visitDestructuringDeclarations);
    }

    /**
     * @param {ts.Node} func
     */
    function hoistFunctionScopedDeclarations(func) {

        function hoistFunctionScopedDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    if(Ast.isVarDeclaration(node.parent)) {
                        if(node.name.kind === ts.SyntaxKind.Identifier) {
                            const name = node.name.text;
                            const start = node.name.getStart();
                            const end = node.name.end;
                            const symbol = Symbol.create(name, start, end, false, func.getStart());
                            Ast.addTypeCarrier(func, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                            Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, Ast.deduceTypes(node.initializer)));
                            func.symbols.insert(symbol);
                        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                            visitDestructuringDeclerations(node.name, (name, start, end) => {
                                const symbol = Symbol.create(name, start, end, false, func.getStart());
                                Ast.addTypeCarrier(func, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                                Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                                func.symbols.insert(symbol);
                            });
                        }
                    }
                    ts.forEachChild(node, hoistFunctionScopedDeclarations);
                    break;
                }
                case ts.SyntaxKind.FunctionDeclaration: {

                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.create(name, start, end, false, func.getStart());
                    Ast.addTypeCarrier(func, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Function, node}));
                    func.symbols.insert(symbol);

                    break;
                
                }
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression: {
                    break;
                }
                default: {
                    ts.forEachChild(node, hoistFunctionScopedDeclarations);
                    break;
                }
            }
        }

        ts.forEachChild(func, hoistFunctionScopedDeclarations);

    }

    /**
     * @param {ts.Node} block
     */
    function hoistBlockScopedDeclarations(block) {
        
        function hoistBlockScopedDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    if(!Ast.isVarDeclaration(node.parent)) {
                        const isConst = Ast.isConstDeclaration(node.parent);
                        if(node.name.kind === ts.SyntaxKind.Identifier) {
                            const name = node.name.text;
                            const start = node.name.getStart();
                            const end = node.name.end;
                            const symbol = Symbol.create(name, start, end, isConst);
                            Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, Ast.deduceTypes(node.initializer)));
                            block.symbols.insert(symbol);
                        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                            visitDestructuringDeclerations(node.name, (name, start, end) => {
                                const symbol = Symbol.create(name, start, end, isConst, node.name.getStart());
                                Ast.addTypeCarrier(node.parent.parent, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                                block.symbols.insert(symbol);
                            });
                        } else {
                            console.assert(false);
                        }
                    }
                    ts.forEachChild(node, hoistBlockScopedDeclarations);
                    break;
                }
                case ts.SyntaxKind.ClassDeclaration: {
                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.create(name, start, end);
                    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Class, node}));
    
                    block.symbols.insert(symbol);
                    break;
                }
                case ts.SyntaxKind.Block:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.ForStatement: 
                case ts.SyntaxKind.ForOfStatement: 
                case ts.SyntaxKind.ForInStatement: {
                    break;
                }
                default: {
                    ts.forEachChild(node, hoistBlockScopedDeclarations);
                    break;
                }
            }
        }

        ts.forEachChild(block, hoistBlockScopedDeclarations);
    
    }

	/**
	 * @param {ts.SourceFile} node 
	 */
	function visitDeclarations(node) {

		switch(node.kind) {
			case ts.SyntaxKind.ImportClause: {  // import x, ...

                const importDeclaration = node.parent;
                importDeclaration.symbols = SymbolTable.create();

				if(node.hasOwnProperty("name") && node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.escapedText;
					const start = node.name.getStart();
					const end = node.name.end;
                    const symbol = Symbol.create(name, start, end);
                    importDeclaration.symbols.insert(symbol);
                    Ast.addTypeCarrier(importDeclaration, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                }
                
                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.NamespaceImport: {   // import * as ...

                const importDeclaration = node.parent.parent;
                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.create(name, start, end);
                importDeclaration.symbols.insert(symbol);
                Ast.addTypeCarrier(importDeclaration, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                break;

            } 
            case ts.SyntaxKind.ImportSpecifier: {   // import {x, y} ...

                const importDeclaration = node.parent.parent.parent;
                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.create(name, start, end);
                importDeclaration.symbols.insert(symbol);
                Ast.addTypeCarrier(importDeclaration, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));

                break;

            }
			case ts.SyntaxKind.BinaryExpression: {	// x = ...

				ts.forEachChild(node, visitDeclarations);
				
				if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
					if(node.left.kind === ts.SyntaxKind.Identifier) {
                        const name = node.left.escapedText;
                        const symbol = Ast.lookUp(node, name);
						if(symbol) {
                            const typeCarrier = TypeCarrier.create(symbol, Ast.deduceTypes(node.right));
                            Ast.addTypeCarrierToExpression(node, typeCarrier);

                            if(!functionStack.isEmpty()) {
                                const func = functionStack.top();
                                if(!Ast.isDeclaredInFunction(node, symbol, func)) {
                                    Ast.addTypeCarrierToNonPureFunction(func, typeCarrier);
                                    nonPureFunctions.add(func);
                                }
                            }
                        } else {
                            const startPosition = ast.getLineAndCharacterOfPosition(node.getStart());
                            const endPosition = ast.getLineAndCharacterOfPosition(node.end);
                            const diagnostic = AnalyzeDiagnostic.create(startPosition, endPosition, `'${name}' is not declared.`);
                            Ast.addAnalyzeDiagnostic(ast, diagnostic);
                        }
                    }
				}
				
				break;

            }
			case ts.SyntaxKind.Parameter: {	// function x(a, ...

                node.symbols = SymbolTable.create();
				if(node.name.kind === ts.SyntaxKind.Identifier) {
					const name = node.name.text;
					const start = node.name.getStart();
                    const end = node.name.end;
                    const symbol = Symbol.create(name, start, end);
                    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                    node.symbols.insert(symbol);
				} else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
					visitDestructuringDeclerations(node.name, (name, start, end) => {
                        const symbol = Symbol.create(name, start, end);
                        Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Undefined}));
                        node.symbols.insert(symbol);
                    });
				} else {
					console.assert(false);
				}

				ts.forEachChild(node, visitDeclarations);
				break;
			
			}
			case ts.SyntaxKind.ClassDeclaration: {

                node.symbols = SymbolTable.create();

                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
				break;
			
            }
			case ts.SyntaxKind.Constructor: {

				const name = "constructor";
				const start = node.getStart();
                const end = node.end;
                const symbol = Symbol.create(name, start, end);
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Function, node}));
                const classDeclaration = classStack.top();
                classDeclaration.symbols.insert(symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.SetAccessor: {

                const name = "@set_accessor_" + node.name.text;
				const start = node.getStart();
				const end = node.end;
                const symbol = Symbol.create(name, start, end);
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Function, node}));
                const classDeclaration = classStack.top();
				classDeclaration.symbols.insert(symbol);

                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.GetAccessor: {

                const name = "@get_accessor_" + node.name.text;
				const start = node.getStart();
				const end = node.end;
                const symbol = Symbol.create(name, start, end);
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Function, node}));
                const classDeclaration = classStack.top();
                classDeclaration.symbols.insert(symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;
            
            }
			case ts.SyntaxKind.MethodDeclaration: {

                if(node.parent.kind === ts.SyntaxKind.ClassDeclaration || node.parent.kind === ts.SyntaxKind.ClassExpression) {
                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.create(name, start, end);
                    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {type: TypeCarrier.Type.Function, node}));
                    const classDeclaration = classStack.top();
                    classDeclaration.symbols.insert(symbol);
                }

                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.FunctionDeclaration: 
			case ts.SyntaxKind.FunctionExpression: 
			case ts.SyntaxKind.ArrowFunction: {
                node.symbols = SymbolTable.create();
                functionStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                functionStack.pop();
                break;
            }
            case ts.SyntaxKind.ClassExpression: {
                node.symbols = SymbolTable.create();
                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
                break;
			}
			case ts.SyntaxKind.Block: {

                node.symbols = SymbolTable.create();

                if(node.parent.kind === ts.SyntaxKind.FunctionDeclaration || 
                    node.parent.kind === ts.SyntaxKind.Constructor ||
                    node.parent.kind === ts.SyntaxKind.MethodDeclaration || 
                    node.parent.kind === ts.SyntaxKind.SetAccessor ||
                    node.parent.kind === ts.SyntaxKind.GetAccessor) {

                    hoistFunctionScopedDeclarations(node);
                    hoistBlockScopedDeclarations(node);

                    ts.forEachChild(node, visitDeclarations);
    
                    break;

				} else {

                    hoistBlockScopedDeclarations(node);

                    ts.forEachChild(node, visitDeclarations);
                    node.typeCarriers = Ast.findAllTypeCarriers(node);

                    break;
                }

            }
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement: {
                node.symbols = SymbolTable.create();
                hoistBlockScopedDeclarations(node);
                ts.forEachChild(node, visitDeclarations);
                break;
            }
            case ts.SyntaxKind.CallExpression: {

                if(node.expression.kind == ts.SyntaxKind.Identifier) {  // x(...);
                    const name = node.expression.getText();
                    const callee = Ast.findCallee(node, name);
                    if(callee !== undefined) {
                        Ast.addCallSite(callee, node);
                    }
                } else if(node.expression.kind === ts.SyntaxKind.ParenthesizedExpression &&
                    node.expression.expression.kind === ts.SyntaxKind.FunctionExpression) { // iife
                    const callee = node.expression.expression;
                    console.assert(callee !== undefined);
                    Ast.addCallSite(callee, node);
                } else {
                    const line = ast.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    console.assert(false, "Could not recognize type of callee at line " + line);
                }

                ts.forEachChild(node, visitDeclarations);
                break;

            }
			default: {
				ts.forEachChild(node, visitDeclarations);
				break;
			}
		}
	}

	hoistFunctionScopedDeclarations(ast);
	hoistBlockScopedDeclarations(ast);
    ts.forEachChild(ast, visitDeclarations);

    nonPureFunctions.forEach(func => {
        func.affectedOutOfScopeSymbols.forEach(typeCarrier => {
            if(func.hasOwnProperty("callSites")) {
                func.callSites.forEach(call => {
                    Ast.addTypeCarrierToClosestStatement(call, typeCarrier);
                });
            }
        });
    });
    
    // console.log("---------------");
    // Ast.findAllSymbols(ast).forEach(symbol => {
    //     console.log(symbol);
    // });
    // console.log("---------------");

}

module.exports = Analyzer;