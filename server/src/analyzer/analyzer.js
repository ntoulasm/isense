const Ast = require('../ast/ast');
const Replicator = require('../ast/replicator');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol_table');
const Stack = require('../utility/stack');
const TypeCarrier = require('../utility/type_carrier');
const AnalyzeDiagnostic = require('./analyze_diagnostic');
const TypeDeducer = require('../type-deducer/type_deducer');
const FunctionAnalyzer = require('./function-analyzer');
const Binder = require('./binder');
const DiagnosticMessages = require('./diagnostic-messages');

const ts = require('typescript');


const Analyzer = {};

const callStack = Stack.create();
const noOp = () => {};

/**
 * @param {ts.SourceFile} ast 
 */
Analyzer.analyze = ast => {

    const objectStack = Stack.create();
    const classStack = Stack.create();

    ast.analyzeDiagnostics = [];
    ast.symbols = SymbolTable.create();

	/**
	 * @param {ts.SourceFile} node 
	 */
	function visitDeclarations(node) {
		switch(node.kind) {
			case ts.SyntaxKind.ImportDeclaration: {
                break;
            }
            case ts.SyntaxKind.VariableDeclaration: {

                ts.forEachChild(node, visitDeclarations);
                
                if(node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.text;
                    const symbol = Ast.lookUp(node, name);
                    const types = node.initializer !== undefined ? TypeDeducer.deduceTypes(node.initializer) : [TypeCarrier.createUndefined()];
                    assign(node, symbol, node.initializer, types);
                }
                
                break;

            }
			case ts.SyntaxKind.BinaryExpression: {	// x = ...

                ts.forEachChild(node, visitDeclarations);
                
				if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                    const lvalue = Ast.stripOutParenthesizedExpressions(node.left);
                    // const rvalue = Ast.stripOutParenthesizedExpressions(node.right);
					if(lvalue.kind === ts.SyntaxKind.Identifier) {
                        const name = lvalue.escapedText;
                        const symbol = Ast.lookUp(node, name);
						if(symbol) {

                            const types = TypeDeducer.deduceTypes(node.right);
                            assign(node, symbol, node.right, types);

                        } else {
                            Ast.addAnalyzeDiagnostic(
                                node.getSourceFile(), 
                                AnalyzeDiagnostic.create(node, DiagnosticMessages.undeclaredReference, [name])
                            );
                        }
                    } else if (lvalue.kind === ts.SyntaxKind.PropertyAccessExpression) {

                        const leftTypes = TypeDeducer.deduceTypes(lvalue.expression);
                        const propertyName = lvalue.name.text;
                        const rightTypes = TypeDeducer.deduceTypes(node.right);

                        // if(leftTypes === undefined) { break; } // TODO: maybe change?

                        for(const type of leftTypes) {
                            if(type.id === TypeCarrier.Type.Object) {
                                setProperty(node, type, propertyName, node.right, rightTypes);
                            }
                        }

                    } else {
                        console.assert(false, 'left side of assignment is not lvalue');
                    }
				}
				
				break;

            }
			case ts.SyntaxKind.Parameter: {
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

                FunctionAnalyzer.analyze(node);

				const name = "constructor";
				const start = node.getStart();
                const end = node.end;
                const symbol = Symbol.create(name, start, end);
                Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Function, node}));
                const classDeclaration = classStack.top();
                classDeclaration.symbols.insert(symbol);
                
                // ts.forEachChild(node, visitDeclarations);
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

                FunctionAnalyzer.analyze(node);

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
            case ts.SyntaxKind.FunctionDeclaration: {
                ts.forEachChild(node, visitDeclarations);
                break;
            }
			case ts.SyntaxKind.FunctionExpression: 
            case ts.SyntaxKind.ArrowFunction: {
                FunctionAnalyzer.analyze(node);
                ts.forEachChild(node, visitDeclarations);
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

                    Binder.bindFunctionScopedDeclarations(node);

                    ts.forEachChild(node, visitDeclarations);
    
                    break;

				} else {

                    Binder.bindBlockScopedDeclarations(node);

                    ts.forEachChild(node, visitDeclarations);
                    const blockTypeCarriers = Ast.findAllTypeCarriers(node);
                    const nextStatement = Ast.findNextStatementOfBlock(node);
                    if(nextStatement) {
                        nextStatement.typeCarriers = blockTypeCarriers;
                    }
                    node.blockTypeCarriers = blockTypeCarriers;

                    break;
                }

            }
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement: {
                node.symbols = SymbolTable.create();
                Binder.bindBlockScopedDeclarations(node);
                ts.forEachChild(node, visitDeclarations);
                break;
            }
            case ts.SyntaxKind.CallExpression: {

                ts.forEachChild(node, visitDeclarations);

                let callee;

                if(node.expression.kind == ts.SyntaxKind.Identifier) {  // x(...);
                    const callees = Ast.findCallees(node) || [];
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
                newExpression(node);
                break;
            }
            case ts.SyntaxKind.IfStatement: {
                ts.forEachChild(node, visitDeclarations);
                if(node.thenStatement.kind !== ts.SyntaxKind.Block) {
                    node.thenStatement.blockTypeCarriers = Ast.findAllTypeCarriers(node.thenStatement);
                } 
                if(node.elseStatement && node.elseStatement.kind !== ts.SyntaxKind.Block && node.elseStatement.kind !== ts.SyntaxKind.IfStatement) {
                    node.elseStatement.blockTypeCarriers = Ast.findAllTypeCarriers(node.elseStatement);
                }
                mergeIfStatementTypeCarriers(node);
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                objectStack.push(node);
                node.type = TypeCarrier.createEmptyObject();
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
                        name = node.name.text;
                        break;
                    }
                }

                if(name !== undefined) {
                    const symbol = Symbol.create(`@${object.type.value}.${name}`, node.pos, node.end);
                    object.type.properties.insert(symbol);
                    assign(node, symbol, node.initializer, propertyTypes);
                }

                break;
            
            }
            case ts.SyntaxKind.ReturnStatement: {
                ts.forEachChild(node, visitDeclarations);
                if(node.hasOwnProperty('expression') && !node.unreachable && !callStack.isEmpty()) {
                    const returnTypes = TypeDeducer.deduceTypes(node.expression);
                    const call = callStack.top();
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

	Binder.bindFunctionScopedDeclarations(ast);
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
 * @param {ts.IfStatement} node
 */
function mergeIfStatementTypeCarriers(node) {
    
    const thenCarriers = node.thenStatement.blockTypeCarriers;
    const elseCarriers = node.elseStatement ? node.elseStatement.blockTypeCarriers : [];

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
        let addOuterType = node === topLevelIfStatement;
        const outerCarrier = addOuterType ? Ast.findClosestTypeCarrier(topLevelIfStatement, symbol) : undefined;
        addOuterType = addOuterType && outerCarrier;
        const carrier = TypeCarrier.create(symbol, [
            ...(addOuterType ? outerCarrier.getTypes() : []),
            ...(c.getTypes())
        ]);
        carriers.push(carrier);
    }

    node.blockTypeCarriers = carriers;
    const nextStatement = Ast.findNextStatementOfBlock(node);
    if(nextStatement) {
        nextStatement.typeCarriers = carriers;
    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} func 
 * @param {*} args 
 */
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

/**
 * @param {ts.Node} node 
 * @param {*} thisObject 
 */
function defineThis(node, thisObject = TypeCarrier.createEmptyObject()) {
    const thisSymbol = Symbol.create('this', 0, 0);
    node.symbols.insert(thisSymbol);
    assign(node, thisSymbol, undefined, [thisObject]);
}

/**
 * @param {ts.Node} original 
 * @param {ts.Node} clone 
 */
function replicateISenseData(original, clone) {
    original.symbols && (clone.symbols = SymbolTable.copy(original.symbols));
    clone.typeCarriers = [];
    clone.unreachable = original.unreachable;
}

const callReplicationOptions = {
    setOriginal: true,
    onReplicate(original, clone) {
        Replicator.setParentNodes(clone);
        Replicator.replicatePositionData(original, clone);
        replicateISenseData(original, clone);
    }
};

/**
 * @returns {ts.Node}
 */
function createCalleeDependenciesNode() {
    const calleeDependenciesNode = ts.createEmptyStatement();
    calleeDependenciesNode.symbols = SymbolTable.create();
    calleeDependenciesNode.typeCarriers = [];
    return calleeDependenciesNode;
}

/**
 * @param {ts.Node} callee 
 * 
 * @returns {ts.Node}
 */
function createCallee(callee) {
    const calleeDependenciesNode = createCalleeDependenciesNode();
    calleeDependenciesNode.parent = callee.parent;
    callee = Replicator.replicate(callee, callReplicationOptions);
    callee.parent = calleeDependenciesNode;
    return callee;
}

/**
 * 
 * @param {ts.Node} callee 
 * @param {ts.Node} call 
 */
function addFreeVariablesTypeCarriers(callee, call) {
    console.assert(callee._original.hasOwnProperty("freeVariables"), "addFreeVariablesTypeCarriers");
    callee._original.freeVariables.forEach(fv => {
        const closestTypeCarrier = Ast.findClosestTypeCarrier(call, fv);
        console.assert(closestTypeCarrier !== undefined, 'addFreeVariablesTypeCarriers: Failed to find type carrier for free variable');
        // TODO: think more about undefined.
        assign(callee.parent, fv, undefined, closestTypeCarrier.getTypes());
    });
}

/**
 * @param {ts.Node} node 
 * @param {ts.Node} callee 
 * @param {Object} thisObject
 */
function call(node, callee, thisObject = TypeCarrier.createEmptyObject(), beforeCall = noOp) {
    callee = node.callee = createCallee(callee);
    addFreeVariablesTypeCarriers(callee, node);
    callStack.push(node);
    node.returnTypes = [];
    Ast.addCallSite(callee, node);
    addParameterTypeCarriers(callee, node.arguments);
    delete callee.affectedOutOfScopeSymbols;
    defineThis(callee.parent, thisObject);
    beforeCall(callee);
    Analyzer.analyze(callee.body);
    if(callee.hasOwnProperty("affectedOutOfScopeSymbols")) {
        // TODO: copy type carriers of properties of free variables that are objects.
        // we need to search body after the call.
        callee.affectedOutOfScopeSymbols.forEach(typeCarrier => {
            Ast.addTypeCarrierToClosestStatement(node, typeCarrier);
        });
    }
    if(!node.returnTypes.length) { node.returnTypes.push({id: TypeCarrier.Type.Undefined}); }
    callStack.pop();
}

/**
 * @param {ts.Node} classNode 
 */
function createEmptyConstructor(classNode) {
    const emptyConstructor = ts.createConstructor(undefined, undefined, [], ts.createBlock());
    emptyConstructor.parent = classNode;
    emptyConstructor._original = emptyConstructor;
    FunctionAnalyzer.analyze(emptyConstructor);
    return emptyConstructor;
}

/**
 * @param {ts.Node} node 
 * @param {ts.Node} constructor 
 */
function newClassExpression(node, classNode) {

    const constructor = Ast.findConstructor(classNode) || createEmptyConstructor();
    const thisObject = TypeCarrier.createEmptyObject();
    const beforeCall = (constructor) => {
        for(const member of classNode.members) {
            if(member.kind === ts.SyntaxKind.PropertyDeclaration) {
                setProperty(constructor, thisObject, member.name.getText(), member.initializer, TypeDeducer.deduceTypes(member.initializer));
            } else if(member.kind === ts.SyntaxKind.MethodDeclaration) {
                setProperty(constructor, thisObject, member.name.getText(), undefined, TypeDeducer.deduceTypes(member));
            }
        }
    };
    
    call(node, constructor, thisObject, beforeCall);

}

/**
 * @param {ts.NewExpression} node 
 */
function newExpression(node) {
    const types = TypeDeducer.deduceTypes(node.expression);
    /**
     * @param {ts.Node} constructor 
     */
    const copyThisPropertiesToCallSite = (constructor) => {
        const constructorLastStatement = Ast.findLastStatement(node.callee.body);
        if(constructorLastStatement === undefined) { return; }
        const thisSymbol = Ast.lookUp(constructorLastStatement, 'this');
        const thisTypeCarrier = Ast.findClosestTypeCarrier(constructorLastStatement, thisSymbol);
        const thisTypes = thisTypeCarrier.getTypes();
        constructor.returnTypes = [thisTypes];
        copyPropertiesTypeCarriersToCallIfObject(constructorLastStatement, thisTypes, node);
    };
    for(const type of types) {
        if(type.id === TypeCarrier.Type.Function) {
            call(node, type.node);
            copyThisPropertiesToCallSite(type.node);
            // const constructorLastStatement = type.node.body.statements.length ? type.node.body.statements[type.node.body.statements.length - 1] : undefined;
            // copyPropertiesTypeCarriersToCallIfObject(constructorLastStatement, ThisHolder.top(), node);
        } else if (type.id === TypeCarrier.Type.Class) {
            newClassExpression(node, type.node);
            copyThisPropertiesToCallSite(type.node);
        }
    }
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} rvalue
 * @param {*} types 
 */
function assign(node, symbol, rvalue, types) {

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
        if(type.id === TypeCarrier.Type.Object && type.hasOwnProperty('value')) {
            type.references.push(symbol);
        }
    }

    const typeCarrier = TypeCarrier.create(symbol, types);
    Ast.addTypeCarrierToExpression(node, typeCarrier);

    const ancestorFunction = Ast.findAncestorFunction(node);
    // TODO: Optimization no need to check for free variables if it's a declaration node.
    if(ancestorFunction) {
        if(ancestorFunction._original.freeVariables.has(symbol)) {
            Ast.addTypeCarrierToNonPureFunction(ancestorFunction, typeCarrier);
        }
    }

    if(rvalue) {
        rvalue = Ast.stripOutParenthesizedExpressions(rvalue);
        if(rvalue.kind === ts.SyntaxKind.CallExpression && rvalue.callee) {
            copyPropertiesTypeCarriersToCallIfObject(Ast.findLastStatement(rvalue.callee.body) || rvalue.callee.body, types, rvalue);
        }
    }

    return typeCarrier;

}

/**
 * @param {*} object 
 * @param {String} name 
 */
function getProperty(object, name) {
    return object.properties.lookUp(name);
}

/**
 * @param {ts.Node} node 
 * @param {*} object 
 * @param {String} name 
 * @param {ts.Node} rvalue
 * @param {*} types 
 */
function setProperty(node, object, name, rvalue, types) {

    const propertyName = `@${object.value}.${name}`;
    const property = getProperty(object, propertyName);
    const symbol = property ? property : Symbol.create(propertyName, node.pos, node.end);
    const typeCarrier = assign(node, symbol, rvalue, types);
    
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