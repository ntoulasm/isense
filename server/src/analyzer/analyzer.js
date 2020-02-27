const Ast = require('../ast/ast');
const Replicator = require('../ast/replicator');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol_table');
const Stack = require('../utility/stack');
const TypeCarrier = require('../utility/type_carrier');
const AnalyzeDiagnostic = require('./analyze_diagnostic');
const TypeDeducer = require('../type-deducer/type_deducer');
const FunctionAnalyzer = require('./function-analyzer');
const Hoist = require('./hoist');

const ts = require('typescript');

const Analyzer = {};

let totalObjects = -1;
const callStack = Stack.create();

/**
 * @param {ts.SourceFile} ast 
 */
Analyzer.analyze = ast => {
    
    totalObjects = 0;

    const objectStack = Stack.create();
    const classStack = Stack.create();
    const functionStack = Stack.create();

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
                    Ast.addTypeCarrier(importDeclaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
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
                Ast.addTypeCarrier(importDeclaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
                break;

            } 
            case ts.SyntaxKind.ImportSpecifier: {   // import {x, y} ...

                const importDeclaration = node.parent.parent.parent;
                const name = node.name.text;
                const start = node.name.getStart();
                const end = node.name.end;
                const symbol = Symbol.create(name, start, end);
                importDeclaration.symbols.insert(symbol);
                Ast.addTypeCarrier(importDeclaration, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));

                break;

            }
            case ts.SyntaxKind.VariableDeclaration: {

                ts.forEachChild(node, visitDeclarations);

                const name = node.name.text;
                const symbol = Ast.lookUp(node, name);
                
                if(node.name.kind === ts.SyntaxKind.Identifier && node.initializer !== undefined) {
                    assign(node, symbol, TypeDeducer.deduceTypes(node.initializer));
                }
                
                break;

            }
			case ts.SyntaxKind.BinaryExpression: {	// x = ...

				ts.forEachChild(node, visitDeclarations);
				
				if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
					if(node.left.kind === ts.SyntaxKind.Identifier) {
                        const name = node.left.escapedText;
                        const symbol = Ast.lookUp(node, name);
						if(symbol) {

                            const types = TypeDeducer.deduceTypes(node.right);
                            const typeCarrier = assign(node, symbol, types);

                        } else {
                            const startPosition = ast.getLineAndCharacterOfPosition(node.getStart());
                            const endPosition = ast.getLineAndCharacterOfPosition(node.end);
                            const diagnostic = AnalyzeDiagnostic.create(startPosition, endPosition, `'${name}' is not declared.`);
                            Ast.addAnalyzeDiagnostic(ast, diagnostic);
                        }
                    } else if (node.left.kind === ts.SyntaxKind.PropertyAccessExpression) {

                        const leftTypes = TypeDeducer.deduceTypes(node.left.expression);
                        const propertyName = node.left.name.text;
                        const rightTypes = TypeDeducer.deduceTypes(node.right);

                        // if(leftTypes === undefined) { break; } // TODO: maybe change?

                        for(const type of leftTypes) {
                            if(type.id === TypeCarrier.Type.Object) {
                                setProperty(node, type, propertyName, rightTypes);
                            }
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
                    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
                    node.symbols.insert(symbol);
				} else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
					visitDestructuringDeclerations(node.name, (name, start, end) => {
                        const symbol = Symbol.create(name, start, end);
                        Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
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

                node.symbols = SymbolTable.create();

				const name = "constructor";
				const start = node.getStart();
                const end = node.end;
                const symbol = Symbol.create(name, start, end);
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Function, node}));
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
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Function, node}));
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
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Function, node}));
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
                    Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Function, node}));
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
                FunctionAnalyzer.analyze(node);
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
                    node.parent.kind === ts.SyntaxKind.FunctionExpression ||
                    node.parent.kind === ts.SyntaxKind.ArrowFunction ||
                    node.parent.kind === ts.SyntaxKind.Constructor ||
                    node.parent.kind === ts.SyntaxKind.MethodDeclaration || 
                    node.parent.kind === ts.SyntaxKind.SetAccessor ||
                    node.parent.kind === ts.SyntaxKind.GetAccessor) {

                    Hoist.hoistFunctionScopedDeclarations(node);
                    Hoist.hoistBlockScopedDeclarations(node);

                    ts.forEachChild(node, visitDeclarations);
    
                    break;

				} else {

                    Hoist.hoistBlockScopedDeclarations(node);

                    ts.forEachChild(node, visitDeclarations);
                    node.typeCarriers = Ast.findAllTypeCarriers(node);

                    break;
                }

            }
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement: {
                node.symbols = SymbolTable.create();
                Hoist.hoistBlockScopedDeclarations(node);
                ts.forEachChild(node, visitDeclarations);
                break;
            }
            case ts.SyntaxKind.CallExpression: {

                ts.forEachChild(node, visitDeclarations);

                let callee;

                if(node.expression.kind == ts.SyntaxKind.Identifier) {  // x(...);
                    const callees = Ast.findCallees(node);
                    callee = !callees.length ? undefined : callees[0];
                } else if(node.expression.kind === ts.SyntaxKind.ParenthesizedExpression &&
                    node.expression.expression.kind === ts.SyntaxKind.FunctionExpression) { // iife
                    callee = node.expression.expression;
                    console.assert(callee !== undefined);
                } else {
                    const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    console.log("Could not recognize type of callee at line " + line);
                }

                if(callee !== undefined) {
                    call(node, callee);
                }

                break;

            }
            case ts.SyntaxKind.NewExpression: {

                ts.forEachChild(node, visitDeclarations);

                if(node.expression.kind === ts.SyntaxKind.Identifier) {
                    const types = TypeDeducer.deduceTypes(node.expression);
                    for(const type of types) {
                        if(type.id === TypeCarrier.Type.Function) {
                            call(node, type.node);
                            // const constructorLastStatement = type.node.body.statements.length ? type.node.body.statements[type.node.body.statements.length - 1] : undefined;
                            // copyPropertiesTypeCarriersToCallIfObject(constructorLastStatement, ThisHolder.top(), node);
                        } else if (type.id === TypeCarrier.Type.Class) {
                            call(node, Ast.findConstructor(type.node));
                        }
                    }
                }
                break;
            }
            case ts.SyntaxKind.IfStatement: {
                ts.forEachChild(node, visitDeclarations);
                mergeIfStatementTypeCarriers(node);
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                objectStack.push(node);
                node.type = createObject();
                ts.forEachChild(node, visitDeclarations);
                objectStack.pop();
                break;
            }
            case ts.SyntaxKind.PropertyAssignment: {

                ts.forEachChild(node, visitDeclarations);

                const propertyTypes = TypeDeducer.deduceTypes(node.initializer);
                const object = objectStack.top();
                let name;
                
                switch(node.name.kind) {
                    case ts.SyntaxKind.Identifier: 
                    case ts.SyntaxKind.NumericLiteral: {
                        name = node.name.getText();
                        break;

                    }
                    case ts.SyntaxKind.StringLiteral: {
                        name = property.name.text;
                        break;
                    }
                }

                if(name !== undefined) {
                    const symbol = Symbol.create(`@${object.type.value}.${name}`, node.pos, node.end);
                    object.type.properties.insert(symbol);
                    assign(node, symbol, propertyTypes);
                }

                break;
            
            }
            case ts.SyntaxKind.ReturnStatement: {
                ts.forEachChild(node, visitDeclarations);
                if(node.hasOwnProperty('expression') && !callStack.isEmpty()) {
                    const returnTypes = TypeDeducer.deduceTypes(node.expression);
                    const call = callStack.top();
                    copyPropertiesTypeCarriersToCallIfObject(node, returnTypes, call);
                    call.returnTypes.push(...returnTypes);
                }
                break;
            }
			default: {
				ts.forEachChild(node, visitDeclarations);
				break;
			}
		}
    }

    ast.typeCarriers = [];
    function initializeTypeCarriers(node) {
        node.typeCarriers = [];
        ts.forEachChild(node, initializeTypeCarriers);
    };
    initializeTypeCarriers(ast);

	Hoist.hoistFunctionScopedDeclarations(ast);
	Hoist.hoistBlockScopedDeclarations(ast);
    ts.forEachChild(ast, visitDeclarations);

    // console.log("---------------");
    // Ast.findAllSymbols(ast).forEach(symbol => {
    //     console.log(symbol);
    // });
    // console.log("---------------");

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} returnStatement
 * @param {Array} returnTypes 
 * @param {ts.Node} call
 */

function copyPropertiesTypeCarriersToCallIfObject(returnStatement, returnTypes, call) {
    for(const t of returnTypes) {
        if(t.id === TypeCarrier.Type.Object) {
            for(const [, p] of Object.entries(t.properties.getSymbols())) {
                Ast.addTypeCarrierToClosestStatement(
                    call, 
                    Ast.findClosestTypeCarrier(returnStatement, p)
                );
            }
        }
    }
}

/**
 * 
 * @param {ts.Node} node
 */
function mergeIfStatementTypeCarriers(node) {

    console.assert(node.kind === ts.SyntaxKind.IfStatement, "Trying to merge carriers in node that is not an if statement");
    
    const thenCarriers = node.thenStatement.typeCarriers;
    const elseCarriers = node.elseStatement ? node.elseStatement.typeCarriers : [];

    const carriers = [];
    const notInBothCarriers = [...thenCarriers, ...elseCarriers];

    for(const thenCarrier of thenCarriers) {
        for(const elseCarrier of elseCarriers) {
            if(thenCarrier.getSymbol() === elseCarrier.getSymbol()) {
                const carrier = TypeCarrier.create(
                    thenCarrier.getSymbol(),
                    [
                        ...thenCarrier.getTypes(),
                        ...elseCarrier.getTypes()
                    ]
                );
                notInBothCarriers.splice(notInBothCarriers.indexOf(thenCarrier), 1);
                notInBothCarriers.splice(notInBothCarriers.indexOf(elseCarrier), 1);
                carriers.push(carrier);
            }
        }
    }

    const topLevelIfStatement = Ast.findTopLevelIfStatement(node);

    for(const c of notInBothCarriers) {
        const symbol = c.getSymbol();
        const outerCarrier = Ast.findClosestTypeCarrier(topLevelIfStatement, symbol);
        const carrier = TypeCarrier.create(symbol, [
            ...(outerCarrier !== undefined ? outerCarrier.getTypes() : []),
            ...c.getTypes()
        ]);
        carriers.push(carrier);
    }

    node.typeCarriers = carriers;

}

// ----------------------------------------------------------------------------

function addParameterTypeCarriers(func, args) {
    for(let i = 0; i < Math.min(func.parameters.length, args.length); ++i) {
        const parameter = func.parameters[i];
        const argument = args[i];
        const parameterSymbol = parameter.symbols.getSymbols()[parameter.name.escapedText];
        console.assert(parameterSymbol, "parameter without symbol?");
        const types = TypeDeducer.deduceTypes(argument);
        const typeCarrier = TypeCarrier.create(parameterSymbol, types);
        Ast.addTypeCarrier(parameter, typeCarrier);
    }
};

// ----------------------------------------------------------------------------

function defineThis(node, thisObject = createObject()) {
    const thisSymbol = Symbol.create('this', 0, 0);
    node.symbols.insert(thisSymbol);
    assign(node, thisSymbol, [thisObject]);
}

/**
 * @param {ts.Node} original 
 * @param {ts.Node} clone 
 */
function replicateISenseData(original, clone) {
    original.symbols && (clone.symbols = SymbolTable.copy(original.symbols));
    clone.typeCarriers = [];
}

const callReplicationOptions = {
    setOriginal: true,
    onReplicate(original, clone) {
        Replicator.setParentNodes(clone);
        Replicator.replicatePositionData(original, clone);
        replicateISenseData(original, clone);
    }
};

function call(node, callee) {
    const calleeDependenciesNode = ts.createEmptyStatement();
    calleeDependenciesNode.symbols = SymbolTable.create();
    calleeDependenciesNode.typeCarriers = [];
    calleeDependenciesNode.parent = callee.parent;
    callee = Replicator.replicate(callee, callReplicationOptions);
    callee.parent = calleeDependenciesNode;
    node.callee = callee;
    callStack.push(node);
    node.returnTypes = [];
    Ast.addCallSite(callee, node);
    addParameterTypeCarriers(callee, node.arguments);
    delete callee.affectedOutOfScopeSymbols;
    defineThis(calleeDependenciesNode);
    Analyzer.analyze(callee.body);
    if(callee.hasOwnProperty("affectedOutOfScopeSymbols")) {
        callee.affectedOutOfScopeSymbols.forEach(typeCarrier => {
            Ast.addTypeCarrierToClosestStatement(node, typeCarrier);
        });
    }
    if(!node.returnTypes.length) { node.returnTypes.push({id: TypeCarrier.Type.Undefined}); }
    callStack.pop();
}

function assign(node, symbol, types) {

    const lvalueTypeCarrier = Ast.findClosestTypeCarrier(node, symbol);

    if(lvalueTypeCarrier !== undefined) {
        for(const type of lvalueTypeCarrier.getTypes()) {
            if(type.id === TypeCarrier.Type.Object) {
                const index = type.references.indexOf(symbol);
                console.assert(index != -1, "Remove reference from object");
                type.references.splice(index, 1);
            }
        }   
    }

    for(const type of types) {
        if(type.id === TypeCarrier.Type.Object) {
            type.references.push(symbol);
        }
    }

    const typeCarrier = TypeCarrier.create(symbol, types);
    Ast.addTypeCarrierToExpression(node, typeCarrier);

    const ancestorFunction = Ast.findAncestorFunction(node);
    if(ancestorFunction) {
        if(!Ast.isDeclaredInFunction(node, symbol, ancestorFunction)) {
            Ast.addTypeCarrierToNonPureFunction(ancestorFunction, typeCarrier);
        }
    }

    return typeCarrier;

}

function createObject() {
    return {
        id: TypeCarrier.Type.Object,
        value: ++totalObjects,
        properties: SymbolTable.create(),
        references: []
    };
}

function getProperty(object, name) {
    return object.properties.lookUp(name);
}

function setProperty(node, object, name, types) {

    const propertyName = `@${object.value}.${name}`;
    const property = getProperty(object, propertyName);
    const symbol = property ? property : Symbol.create(propertyName, node.pos, node.end);
    const typeCarrier = assign(node, symbol, types);
    
    Ast.addTypeCarrierToExpression(node, typeCarrier);

    !property && object.references.forEach(reference => {

        const previousTypeCarrier = Ast.findClosestTypeCarrier(node, reference);
        const newTypes = [];
        
        for(const type of previousTypeCarrier.getTypes()) {
            const newType = TypeCarrier.copyType(type);
            if(newType.id === TypeCarrier.Type.Object) {
                newType.properties.insert(symbol);
            }
            newTypes.push(newType);
        }
    
        const typeCarrier = TypeCarrier.create(reference, newTypes);
        Ast.addTypeCarrierToExpression(node, typeCarrier);
    
    });

}

// ----------------------------------------------------------------------------

module.exports = Analyzer;