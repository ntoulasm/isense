const Utility = require('../utility/utility.js');
const Symbol = require('../utility/symbol.js');
const SymbolTable = require('../utility/symbol_table.js');
const Stack = require('../utility/stack.js');

const ts = require('typescript');

const Analyzer = {};

/**
 * @param {ts.SourceFile} ast 
 */
Analyzer.analyze = function(ast) {
    
    const classStack = Stack.createStack();

    ast.symbols = SymbolTable.createSymbolTable();
    ast.innerSymbols = SymbolTable.createSymbolTable();
    
    /**
     * @param {ts.Node} node 
     * @param {string} name 
     */
    function lookUp(node, name) {
        return Utility.forEachSymbolReversed(node, function(symbol) {
            return symbol.name === name;
        });
    }

    /**
     * @param {ts.SourceFile} node 
     * @param {symbolTable} symbolTable 
     * @param {number} symbolType 
     * @param {boolean} isConst 
     */
    function visitDestructuringDeclerations(symbolTable, node, symbolType, isConst = false, isInitialized = true) {
        function visitDestructuringDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.BindingElement: {

                    if(node.name.kind === ts.SyntaxKind.Identifier) {
                        const name = node.name.text;
                        const start = node.name.getStart();
                        const end = node.name.end;
                        const symbol = Symbol.createSymbol(name, symbolType, start, end, isConst, isInitialized);
                        symbolTable.insert(name, symbol);
                    }

                    ts.forEachChild(node, visitDestructuringDeclarations);
                    break;

                }
                case ts.SyntaxKind.FunctionExpression:  // {x = function..., }
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
     * @param {ts.Node} node
     */
    function hoistFunctionScopedDeclarations(node) {
        const functionSymbolTable = node.innerSymbols;
        function hoistFunctionScopedDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    if(Utility.isVarDeclaration(node.parent)) {
                        if(node.name.kind === ts.SyntaxKind.Identifier) {
                            const name = node.name.text;
                            const start = node.name.getStart();
                            const end = node.name.end;
                            const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Variable, start, end);
                            functionSymbolTable.insert(name, symbol);
                        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                            visitDestructuringDeclerations(functionSymbolTable, node.name, Symbol.SymbolType.Variable);
                        }

                    }
                    ts.forEachChild(node, hoistFunctionScopedDeclarations);
                    break;
                }
                case ts.SyntaxKind.FunctionDeclaration: {

                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Function, start, end);

                    functionSymbolTable.insert(name, symbol);

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
        ts.forEachChild(node, hoistFunctionScopedDeclarations);
    }

    /**
     * @param {ts.Node} node
     */
    function hoistBlockScopedDeclarations(node) {
        const symbolTable = node.innerSymbols;
        function hoistBlockScopedDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    if(!Utility.isVarDeclaration(node.parent)) {
                        const isConst = Utility.isConstDeclaration(node.parent);
                        if(node.name.kind === ts.SyntaxKind.Identifier) {
                            const name = node.name.text;
                            const start = node.name.getStart();
                            const end = node.name.end;
                            const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Variable, start, end, isConst, false);
                            symbolTable.insert(name, symbol);
                        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                            visitDestructuringDeclerations(symbolTable, node.name, Symbol.SymbolType.Variable, isConst, false);
                        } else {
                            console.assert(false);
                        }
                    }
                    ts.forEachChild(node, hoistBlockScopedDeclarations);
                    break;
                }
                case ts.SyntaxKind.Block:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression: {
                    break;
                }
                default: {
                    ts.forEachChild(node, hoistBlockScopedDeclarations);
                    break;
                }
            }
        }
        ts.forEachChild(node, hoistBlockScopedDeclarations);
    }

	/**
	 * @param {ts.SourceFile} node 
	 */
	function visitDeclarations(node) {

		switch(node.kind) {
			case ts.SyntaxKind.ImportClause: {  // import x, ...

				if(node.hasOwnProperty("name") && node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.escapedText;
					const start = node.name.getStart();
					const end = node.name.end;
                    const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Variable, start, end);
                    node.symbols = SymbolTable.createSymbolTable();
                    node.symbols.insert(name, symbol);
                }
                
                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.NamespaceImport: {   // import * as ...

                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Variable, start, end);
                node.symbols = SymbolTable.createSymbolTable();
                node.symbols.insert(name, symbol);
                break;

            } 
            case ts.SyntaxKind.ImportSpecifier: {   // import {x, y} ...

                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Variable, start, end);
                node.symbols = SymbolTable.createSymbolTable();
                node.symbols.insert(name, symbol);

                break;

            }
			case ts.SyntaxKind.BinaryExpression: {	// x = ...

				ts.forEachChild(node, visitDeclarations);
				
				if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
					if(node.left.kind === ts.SyntaxKind.Identifier) {
						const name = node.left.escapedText;
						if(lookUp(node, name)) { break; }
						const start = node.left.getStart();
						const end = node.left.end;
                        const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Variable, start, end, false, false);
                        ast.innerSymbols.insert(name, symbol);
					}
				}
				
				break;

            }
			case ts.SyntaxKind.Parameter: {	// function x(a, ...

                node.symbols = SymbolTable.createSymbolTable();
				if(node.name.kind === ts.SyntaxKind.Identifier) {
					const name = node.name.text;
					const start = node.name.getStart();
                    const end = node.name.end;
                    const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Formal, start, end);
                    node.symbols.insert(name, symbol);
				} else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
					visitDestructuringDeclerations(node.symbols, node.name, Symbol.SymbolType.Formal);
				} else {
					console.assert(false);
				}

				ts.forEachChild(node, visitDeclarations);
				break;
			
			}
			case ts.SyntaxKind.ClassDeclaration: {

				const name = node.name.text;
				const start = node.getStart();
				const end = node.end;
                const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Class, start, end);
                node.symbols = SymbolTable.createSymbolTable();
                node.symbols.insert(name, symbol);
                node.innerSymbols = SymbolTable.createSymbolTable();

                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
				break;
			
            }
			case ts.SyntaxKind.Constructor: {

				const name = "constructor";
				const start = node.getStart();
                const end = node.end;
                const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Constructor, start, end);
                const classDeclaration = classStack.top();
                classDeclaration.innerSymbols.insert(name, symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.SetAccessor: {

                const name = "@set_accessor_" + node.name.text;
				const start = node.getStart();
				const end = node.end;
                const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Method, start, end);
				const classDeclaration = classStack.top();
				classDeclaration.innerSymbols.insert(name, symbol);

                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.GetAccessor: {

                const name = "@get_accessor_" + node.name.text;
				const start = node.getStart();
				const end = node.end;
				const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Method, start, end);
                const classDeclaration = classStack.top();
                classDeclaration.innerSymbols.insert(name, symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;
            
            }
			case ts.SyntaxKind.MethodDeclaration: {

                if(node.parent.kind === ts.SyntaxKind.ClassExpression || node.parent.kind === ts.SyntaxKind.ClassExpression) {
                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.createSymbol(name, Symbol.SymbolType.Method, start, end);
                    const classDeclaration = classStack.top();
                    classDeclaration.innerSymbols.insert(name, symbol);
                }

                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.FunctionDeclaration: 
			case ts.SyntaxKind.FunctionExpression: 
			case ts.SyntaxKind.ArrowFunction: {
                node.innerSymbols = SymbolTable.createSymbolTable();
                ts.forEachChild(node, visitDeclarations);
                break;
            }
            case ts.SyntaxKind.ClassExpression: {
                node.innerSymbols = SymbolTable.createSymbolTable();
                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
                break;
			}
			case ts.SyntaxKind.Block: {

                node.innerSymbols = SymbolTable.createSymbolTable();

                if(node.parent.kind === ts.SyntaxKind.FunctionDeclaration || 
                    node.parent.kind === ts.SyntaxKind.Constructor ||
                    node.parent.kind === ts.SyntaxKind.MethodDeclaration || 
                    node.parent.kind === ts.SyntaxKind.SetAccessor ||
                    node.parent.kind === ts.SyntaxKind.GetAccessor) {
                    hoistFunctionScopedDeclarations(node);
				}

                hoistBlockScopedDeclarations(node);
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
    
    console.log("---------------");
    Utility.forEachSymbol(ast, symbol => {
        console.log(symbol);
    });
    console.log("---------------");

}

module.exports = Analyzer;