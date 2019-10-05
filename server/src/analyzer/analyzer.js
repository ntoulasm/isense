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

    function computeTypeCarrier(node, start) {
        if(node === undefined) {
            return {type: "undefined", start};
        }
        switch(node.kind) {
            case ts.SyntaxKind.NumericLiteral: {
                return {type: "number", value: node.text, start};
            }
            case ts.SyntaxKind.StringLiteral: {
                return {type: "string", value: '"' + node.text + '"', start};
            }
            case ts.SyntaxKind.TrueKeyword: {
                return {type: "boolean", value: true, start};
            }
            case ts.SyntaxKind.FalseKeyword: {
                return {type: "boolean", value: false, start};
            }
            case ts.SyntaxKind.ArrayLiteralExpression: {
                return {type: "array", start};
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                return {type: "object", start};
            }
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction: {
                return {type: "function", start};
            }
            case ts.SyntaxKind.ClassExpression : {
                return {type: "class", start};
            }
            case ts.SyntaxKind.NullKeyword: {
                return {type: "null", start};
            }
            case ts.SyntaxKind.UndefinedKeyword: {
                return {type: "undefined", start};
            }
            case ts.SyntaxKind.Identifier: {
                const symbol = Utility.lookUp(node, node.text);
                offset = node.getStart();
                if(symbol === undefined) { return {type: "undefined", start} };
                const typeCarrier = Utility.findActiveTypeCarrier(symbol, offset);
                return {
                    type: typeCarrier.type,
                    value: typeCarrier.value,
                    start
                };
            }
        }
    }

    /**
     * @param {ts.SourceFile} node 
     * @param {symbolTable} symbolTable 
     * @param {boolean} isConst 
     */
    function visitDestructuringDeclerations(symbolTable, node, isConst = false, isInitialized = true) {
        function visitDestructuringDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.BindingElement: {

                    if(node.name.kind === ts.SyntaxKind.Identifier) {
                        const name = node.name.text;
                        const start = node.name.getStart();
                        const end = node.name.end;
                        const symbol = Symbol.createSymbol(name, start, end, isConst, isInitialized);
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

        const scopeStart = node.getStart();
        const functionSymbolTable = node.symbols;

        function hoistFunctionScopedDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    if(Utility.isVarDeclaration(node.parent)) {
                        if(node.name.kind === ts.SyntaxKind.Identifier) {
                            const name = node.name.text;
                            const start = node.name.getStart();
                            const end = node.name.end;
                            const symbol = Symbol.createSymbol(name, start, end);
                            symbol.typeCarriers.push({type: "undefined", start: scopeStart});
                            symbol.typeCarriers.push(computeTypeCarrier(node.initializer, node.getStart()));
                            functionSymbolTable.insert(name, symbol);
                        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                            visitDestructuringDeclerations(functionSymbolTable, node.name);
                        }
                    }
                    ts.forEachChild(node, hoistFunctionScopedDeclarations);
                    break;
                }
                case ts.SyntaxKind.FunctionDeclaration: {

                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.createSymbol(name, start, end);
                    symbol.typeCarriers.push({type: "function", start: scopeStart});
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

        const symbolTable = node.symbols;
        
        function hoistBlockScopedDeclarations(node) {
            switch(node.kind) {
                case ts.SyntaxKind.VariableDeclaration: {
                    if(!Utility.isVarDeclaration(node.parent)) {
                        const isConst = Utility.isConstDeclaration(node.parent);
                        if(node.name.kind === ts.SyntaxKind.Identifier) {
                            const name = node.name.text;
                            const start = node.name.getStart();
                            const end = node.name.end;
                            const symbol = Symbol.createSymbol(name, start, end, isConst, false);
                            symbol.typeCarriers.push(computeTypeCarrier(node.initializer, node.getStart()));
                            symbolTable.insert(name, symbol);
                        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
                            visitDestructuringDeclerations(symbolTable, node.name, isConst, false);
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
                    const symbol = Symbol.createSymbol(name, start, end);
                    symbol.typeCarriers.push({type: "class", start});
    
                    symbolTable.insert(name, symbol);
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

        ts.forEachChild(node, hoistBlockScopedDeclarations);
    
    }

	/**
	 * @param {ts.SourceFile} node 
	 */
	function visitDeclarations(node) {

		switch(node.kind) {
			case ts.SyntaxKind.ImportClause: {  // import x, ...

                const importDeclaration = node.parent;
                importDeclaration.symbols = SymbolTable.createSymbolTable();

				if(node.hasOwnProperty("name") && node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.escapedText;
					const start = node.name.getStart();
					const end = node.name.end;
                    const symbol = Symbol.createSymbol(name, start, end);
                    importDeclaration.symbols.insert(name, symbol);
                }
                
                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.NamespaceImport: {   // import * as ...

                const importDeclaration = node.parent.parent;
                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.createSymbol(name, start, end);
                importDeclaration.symbols.insert(name, symbol);
                break;

            } 
            case ts.SyntaxKind.ImportSpecifier: {   // import {x, y} ...

                const importDeclaration = node.parent.parent.parent;
                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.createSymbol(name, start, end);
                importDeclaration.symbols.insert(name, symbol);

                break;

            }
			case ts.SyntaxKind.BinaryExpression: {	// x = ...

				ts.forEachChild(node, visitDeclarations);
				
				if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
					if(node.left.kind === ts.SyntaxKind.Identifier) {
                        const name = node.left.escapedText;
                        const start = node.left.getStart();
                        let symbol;
						if(!(symbol = Utility.lookUp(node, name))) { 
                            const end = node.left.end;
                            symbol = Symbol.createSymbol(name, start, end, false, false);
                            ast.symbols.insert(name, symbol);
                        }
                        symbol.typeCarriers.push(computeTypeCarrier(node.right, start));
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
                    const symbol = Symbol.createSymbol(name, start, end);
                    node.symbols.insert(name, symbol);
				} else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
					visitDestructuringDeclerations(node.symbols, node.name);
				} else {
					console.assert(false);
				}

				ts.forEachChild(node, visitDeclarations);
				break;
			
			}
			case ts.SyntaxKind.ClassDeclaration: {

                node.symbols = SymbolTable.createSymbolTable();

                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
				break;
			
            }
			case ts.SyntaxKind.Constructor: {

				const name = "constructor";
				const start = node.getStart();
                const end = node.end;
                const symbol = Symbol.createSymbol(name, start, end);
                symbol.typeCarriers.push({type: "function", start});
                const classDeclaration = classStack.top();
                classDeclaration.symbols.insert(name, symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.SetAccessor: {

                const name = "@set_accessor_" + node.name.text;
				const start = node.getStart();
				const end = node.end;
                const symbol = Symbol.createSymbol(name, start, end);
                symbol.typeCarriers.push({type: "function", start});
                const classDeclaration = classStack.top();
				classDeclaration.symbols.insert(name, symbol);

                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.GetAccessor: {

                const name = "@get_accessor_" + node.name.text;
				const start = node.getStart();
				const end = node.end;
                const symbol = Symbol.createSymbol(name, start, end);
                symbol.typeCarriers.push({type: "function", start});
                const classDeclaration = classStack.top();
                classDeclaration.symbols.insert(name, symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;
            
            }
			case ts.SyntaxKind.MethodDeclaration: {

                if(node.parent.kind === ts.SyntaxKind.ClassDeclaration || node.parent.kind === ts.SyntaxKind.ClassExpression) {
                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.createSymbol(name, start, end);
                    symbol.typeCarriers.push({type: "function", start});
                    const classDeclaration = classStack.top();
                    classDeclaration.symbols.insert(name, symbol);
                }

                ts.forEachChild(node, visitDeclarations);
				break;

            }
            case ts.SyntaxKind.FunctionDeclaration: 
			case ts.SyntaxKind.FunctionExpression: 
			case ts.SyntaxKind.ArrowFunction: {
                node.symbols = SymbolTable.createSymbolTable();
                ts.forEachChild(node, visitDeclarations);
                break;
            }
            case ts.SyntaxKind.ClassExpression: {
                node.symbols = SymbolTable.createSymbolTable();
                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
                break;
			}
			case ts.SyntaxKind.Block: {

                node.symbols = SymbolTable.createSymbolTable();

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
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement: {
                node.symbols = SymbolTable.createSymbolTable();
                hoistBlockScopedDeclarations(node);
                ts.forEachChild(node, visitDeclarations);
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