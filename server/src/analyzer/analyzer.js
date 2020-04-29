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

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------


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
                            if(type.id === TypeCarrier.Type.Object && type.hasOwnProperty('value')) {
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
            // case ts.SyntaxKind.FunctionDeclaration: {
            //     ts.forEachChild(node, visitDeclarations);
            //     break;
            // }
			// case ts.SyntaxKind.FunctionExpression: 
            // case ts.SyntaxKind.ArrowFunction: {
            //     ts.forEachChild(node, visitDeclarations);
            //     break;
            // }
            case ts.SyntaxKind.ClassExpression: {
                node.symbols = SymbolTable.create();
                classStack.push(node);
                ts.forEachChild(node, visitDeclarations);
                classStack.pop();
                break;
			}
			case ts.SyntaxKind.Block: {
                ts.forEachChild(node, visitDeclarations);
                Ast.copyTypeCarriersFromBlockToNextStatement(node);
                break;
            }
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement: {
                Binder.bindBlockScopedDeclarations(node);
                ts.forEachChild(node, visitDeclarations);
                break;
            }
            case ts.SyntaxKind.CallExpression: {

                ts.forEachChild(node, visitDeclarations);

                const types = TypeDeducer.deduceTypes(node.expression);
                const callees = types.flatMap(t => t.id === TypeCarrier.Type.Function ? [t.node] : []);
                const callee = !callees.length ? undefined : callees[0];

                // TODO: somehow pick callee
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
            case ts.SyntaxKind.ShorthandPropertyAssignment: {

                const object = objectStack.top();
                const name = node.name.getText();
                const propertyTypes = TypeDeducer.deduceTypes(node.name);

                if(name !== undefined) {
                    const symbol = Symbol.create(`@${object.type.value}.${name}`, node.pos, node.end);
                    object.type.properties.insert(symbol);
                    assign(node, symbol, node.initializer, propertyTypes);
                }

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
                    const returnTypes = TypeDeducer.deduceTypes(node.expression) || [TypeCarrier.createAny()];
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

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} source
 * @param {Array} types 
 * @param {ts.Node} destination
 */

function copyPropertiesTypeCarriersIfObject(source, types, destination) {
    for(const t of types) {
        if(t.id === TypeCarrier.Type.Object && t.hasOwnProperty('value')) {
            for(const [, p] of Object.entries(t.properties.getSymbols())) {
                const propertyTypeCarrier = Ast.findClosestTypeCarrier(source, p);
                Ast.addTypeCarrierToClosestStatement(
                    destination, 
                    propertyTypeCarrier
                );
                copyPropertiesTypeCarriersIfObject(source, propertyTypeCarrier.getTypes(), destination);
            }
        }
    }
}

/**
 * If statements do not need to copy properties of objects since it checks for same symbols 
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
function copyParameterTypeCarriersToCallee(func, args) {
    // TODO: handle destructuring?
    for(let i = 0; i < Math.min(func.parameters.length, args.length); ++i) {
        const parameter = func.parameters[i];
        const argument = args[i];
        const parameterSymbol = parameter.symbols.getSymbols()[parameter.name.escapedText];
        console.assert(parameterSymbol, "parameter without symbol?");
        const types = TypeDeducer.deduceTypes(argument);
        const typeCarrier = TypeCarrier.create(parameterSymbol, types);
        Ast.addTypeCarrier(parameter, typeCarrier);
        copyPropertiesTypeCarriersIfObject(argument, types, parameter);
    }
    for(let i = args.length; i < func.parameters.length; ++i) {
        const parameter = func.parameters[i];
        const parameterSymbol = parameter.symbols.getSymbols()[parameter.name.escapedText];
        console.assert(parameterSymbol, "parameter without symbol?");
        Ast.addTypeCarrier(parameter, TypeCarrier.create(parameterSymbol, TypeCarrier.createUndefined()));
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
    callee.freeVariables = new Set(callee._original.freeVariables);
    callee.parent = calleeDependenciesNode;
    return callee;
}

/**
 * 
 * @param {ts.Node} callee 
 * @param {ts.Node} call 
 */
function copyFreeVariablesTypeCarriersToCallee(callee, call) {
    console.assert(callee.hasOwnProperty("freeVariables"), "addFreeVariablesTypeCarriers");
    callee.freeVariables.forEach(fv => {
        const closestTypeCarrier = Ast.findClosestTypeCarrier(call, fv);
        console.assert(closestTypeCarrier !== undefined, 'addFreeVariablesTypeCarriers: Failed to find type carrier for free variable');
        const types = closestTypeCarrier.getTypes();
        // TODO: think more about undefined.
        assign(callee.parent, fv, undefined, types);
        copyPropertiesTypeCarriersIfObject(call, types, callee.parent);
        for(const t of types) {
            if(t.id === TypeCarrier.Type.Object && t.hasOwnProperty('value')) {
                for(const [, propertySymbol] of Object.entries(t.properties.getSymbols())) {
                    callee.freeVariables.add(propertySymbol);
                }
            }
        }
    });
}

/**
 * 
 * @param {ts.Node} callee 
 * @param {ts.Node} call 
 */
function copyFreeVariablesTypeCarriersToCaller(callee, call) {
    const lastStatement = Ast.findLastStatement(callee.body) || callee.body;
    const callNextStatement = Ast.findNextStatement(call);
    for(const fv of callee.freeVariables) {
        const closestTypeCarrier = Ast.findClosestTypeCarrier(lastStatement, fv);
        console.assert(closestTypeCarrier !== undefined, 'addFreeVariablesTypeCarriers: Failed to find type carrier for free variable');
        const types = closestTypeCarrier.getTypes();
        Ast.addTypeCarrierToClosestStatement(callNextStatement, closestTypeCarrier);
        copyPropertiesTypeCarriersIfObject(lastStatement, types, callNextStatement);
    }
}

/**
 * @param {ts.Node} call 
 * @param {ts.Node} callee 
 * @param {Object} thisObject
 */
function call(call, callee, thisObject = TypeCarrier.createEmptyObject(), beforeCall = noOp) {
    callStack.push(call);
    call.returnTypes = [];
    // Add call site to original callee node
    Ast.addCallSite(callee, call);
    callee = call.callee = createCallee(callee);
    defineThis(callee.parent, thisObject);
    copyParameterTypeCarriersToCallee(callee, call.arguments || []);
    copyFreeVariablesTypeCarriersToCallee(callee, call);
    beforeCall(callee);
    Analyzer.analyze(callee.body);
    copyFreeVariablesTypeCarriersToCaller(callee, call);
    if(!call.returnTypes.length) { call.returnTypes.push({id: TypeCarrier.Type.Undefined}); }
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
        copyPropertiesTypeCarriersIfObject(constructorLastStatement, thisTypes, node);
    };
    for(const type of types) {
        if(type.id === TypeCarrier.Type.Function && type.node) {
            call(node, type.node);
            copyThisPropertiesToCallSite(type.node);
        } else if (type.id === TypeCarrier.Type.Class && type.node) {
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

    if(rvalue) {
        rvalue = Ast.stripOutParenthesizedExpressions(rvalue);
        if(rvalue.kind === ts.SyntaxKind.CallExpression && rvalue.callee) {
            copyPropertiesTypeCarriersIfObject(Ast.findLastStatement(rvalue.callee.body) || rvalue.callee.body, types, rvalue);
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