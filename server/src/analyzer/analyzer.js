const Ast = require('../ast/ast');
const Replicator = require('../ast/replicator');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol-table');
const Stack = require('../utility/stack');
const TypeCarrier = require('../utility/type-carrier');
const AnalyzeDiagnostic = require('./analyze-diagnostic');
const TypeCaster = require('../type-caster/type-caster');
const FunctionAnalyzer = require('./function-analyzer');
const Binder = require('./binder');
const DiagnosticMessages = require('./diagnostic-messages');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------


const Analyzer = {};

const callStack = Stack.create();
const functionStack = Stack.create();
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

        if(node.parent && node.parent.unreachable) {
            node.unreachable = true;
        }

		switch(node.kind) {
			case ts.SyntaxKind.ImportDeclaration: {
                break;
            }
            case ts.SyntaxKind.VariableDeclaration: {

                ts.forEachChild(node, visitDeclarations);
                
                if(node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.text;
                    const symbol = Ast.lookUp(node, name);
                    const types = node.initializer !== undefined ? node.initializer.types : [TypeCarrier.createUndefined()];
                    assign(node, symbol, node.initializer, types);
                }
                
                break;

            }
            case ts.SyntaxKind.NumericLiteral: {
                node.types = [TypeCarrier.createNumber(node.getText())];
                break;
            }
            case ts.SyntaxKind.StringLiteral: {
                node.types = [TypeCarrier.createString(node.text)];
                break;
            }
            case ts.SyntaxKind.TrueKeyword: {
                node.types = [TypeCarrier.createBoolean(true)];
                break;
            }
            case ts.SyntaxKind.FalseKeyword: {
                node.types = [TypeCarrier.createBoolean(false)];
                break;
            }
            case ts.SyntaxKind.ArrayLiteralExpression: {
                node.types = [TypeCarrier.createArray()];
                break;
            }
            case ts.SyntaxKind.NullKeyword: {
                node.types = [TypeCarrier.createNull()];
                break;
            }
            case ts.SyntaxKind.UndefinedKeyword: {
                node.types = [TypeCarrier.createUndefined()];
                break;
            }
            case ts.SyntaxKind.Identifier: {
                // TODO: refactoring
                if(node.escapedText === "undefined") { 
                    node.types = [TypeCarrier.createUndefined()]; 
                    break;
                }
                const symbol = Ast.lookUp(node, node.getText());
                updateFreeVariables(node, symbol);
                if(symbol === undefined) { 
                    node.types = [TypeCarrier.createAny()]; 
                    break;
                }
                const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
                if(typeCarrier === undefined) { 
                    node.types = [TypeCarrier.createUndefined()]; 
                    break;
                }
                node.types = typeCarrier.getTypes();
                break;
            }
            case ts.SyntaxKind.PrefixUnaryExpression: {
                ts.forEachChild(node, visitDeclarations);
                analyzePrefixUnaryExpression(node);
                break;
            }
            case ts.SyntaxKind.PostfixUnaryExpression: {
                ts.forEachChild(node, visitDeclarations);
                analyzePostfixUnaryExpression(node);
                break;
            }
            case ts.SyntaxKind.VoidExpression: {
                ts.forEachChild(node, visitDeclarations);
                node.types = [TypeCarrier.createUndefined()];
                break;
            }
            case ts.SyntaxKind.TypeOfExpression: {
                ts.forEachChild(node, visitDeclarations);
                analyzeTypeOfExpression(node);
                break;
            }
            case ts.SyntaxKind.ThisKeyword: {
                // TODO: refactoring
                const symbol = Ast.lookUp(node, 'this');
                node.types = symbol ? 
                    Ast.findClosestTypeCarrier(node, symbol).getTypes() :
                    [TypeCarrier.createEmptyObject()];
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

                            const types = node.right.types;
                            assign(node, symbol, node.right, types);
                            // TODO: move to assign?
                            node.types = types;

                        } else {
                            Ast.addAnalyzeDiagnostic(
                                node.getSourceFile(), 
                                AnalyzeDiagnostic.create(node, DiagnosticMessages.undeclaredReference, [name])
                            );
                        }
                    } else if (lvalue.kind === ts.SyntaxKind.PropertyAccessExpression) {

                        node.types = [];

                        const leftTypes = lvalue.expression.types;
                        const propertyName = lvalue.name.text;
                        const rightTypes = node.right.types;

                        // if(leftTypes === undefined) { break; } // TODO: maybe change?

                        for(const type of leftTypes) {
                            if(type.id === TypeCarrier.Type.Object && type.hasOwnProperty('value')) {
                                setProperty(node, type, propertyName, node.right, rightTypes);
                                node.types.push(...rightTypes);
                            }
                        }

                    } else {
                        console.assert(false, 'left side of assignment is not lvalue');
                    }
				} else {
                    analyzeBinaryExpression(node);
                }
				
				break;

            }
            case ts.SyntaxKind.PropertyAccessExpression: {
                visitDeclarations(node.expression);
                analyzePropertyAccessExpression(node);
                break;
            }
            case ts.SyntaxKind.ElementAccessExpression: {
                ts.forEachChild(node, visitDeclarations);
                analyzeElementAccessExpression(node);
            }
            case ts.SyntaxKind.ParenthesizedExpression: {
                ts.forEachChild(node, visitDeclarations);
                node.types = node.expression.types;
                break;
            }
			case ts.SyntaxKind.Parameter: {
                break;
			}
			case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression: {
                node.types = [TypeCarrier.createClass(node)];
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

                node.types = [TypeCarrier.createFunction(node)];

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
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression: 
            case ts.SyntaxKind.ArrowFunction: {
                functionStack.push(node);
                node.types = [TypeCarrier.createFunction(node)];
                ts.forEachChild(node, visitDeclarations);
                functionStack.pop(node);
                if(!node.body) { return; }
                const innerTypeCarriers = Ast.findAllTypeCarriers(node.body)
                node.typeCarriers = innerTypeCarriers.filter(t => t.getSymbol().name.startsWith('@typeVariable'));
                const solutions = {};
                for(const {symbol, type} of node.typeVariables) {
                    const solution = Ast.findLastTypeCarrier(node.body, type.value);
                    solutions[type.value.name] = solution ? solution.getTypes() : TypeCarrier.createAny();
                    const typeCarrier = TypeCarrier.create(
                        symbol, 
                        solution ? solution.getTypes() : TypeCarrier.createAny()
                    );
                    Ast.addTypeCarrier(symbol.declaration, typeCarrier);
                }
                replaceTypeVariables(node, solutions);
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

                const types = node.expression.types;
                const callees = types.flatMap(t => t.id === TypeCarrier.Type.Function ? [t.node] : []);
                const callee = !callees.length ? undefined : callees[0];

                // TODO: somehow pick callee
                if(callee === undefined) {
                    node.types = [TypeCarrier.createAny()];
                } else if(!callee.body) {
                    node.types = [TypeCarrier.createUndefined()];
                } else {
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
                node.types = [node.type];
                delete node.type;
                break;
            }
            case ts.SyntaxKind.ShorthandPropertyAssignment: {
                
                ts.forEachChild(node, visitDeclarations);

                const object = objectStack.top();
                const name = node.name.getText();
                const propertyTypes = node.name.types;

                if(name !== undefined) {
                    const symbol = Symbol.create(`@${object.type.value}.${name}`, node.pos, node.end);
                    object.type.properties.insert(symbol);
                    assign(node, symbol, node.initializer, propertyTypes);
                }

                break;

            }
            case ts.SyntaxKind.PropertyAssignment: {

                ts.forEachChild(node, visitDeclarations);

                const propertyTypes = node.initializer.types;
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
                if(node.expression && !node.unreachable && !callStack.isEmpty()) {
                    const returnTypes = node.expression.types || [TypeCarrier.createAny()];
                    const call = callStack.top();
                    call.types.push(...returnTypes);
                }
                if(!node.unreachable) {
                    markUnreachableStatements(Ast.findRightSiblings(node));
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
    } else {
        node.typeCarriers = carriers;
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
        const types = argument.types;
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
    call.types = [];
    // if(!callee.body) {
    //     call.types.push(TypeCarrier.createUndefined);
    //     return; 
    // }
    callStack.push(call);
    Ast.addCallSite(callee, call);
    callee = call.callee = createCallee(callee);
    defineThis(callee.parent, thisObject);
    copyParameterTypeCarriersToCallee(callee, call.arguments || []);
    copyFreeVariablesTypeCarriersToCallee(callee, call);
    beforeCall(callee);
    Analyzer.analyze(callee.body);
    copyFreeVariablesTypeCarriersToCaller(callee, call);
    if(!call.types.length) { call.types.push(TypeCarrier.createUndefined()); }
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
                setProperty(constructor, thisObject, member.name.getText(), member.initializer, member.initializer.types);
            } else if(member.kind === ts.SyntaxKind.MethodDeclaration) {
                setProperty(constructor, thisObject, member.name.getText(), undefined, member.types);
            }
        }
    };
    
    call(node, constructor, thisObject, beforeCall);

}

/**
 * @param {ts.Node} constructor 
 */
const copyThisToNewExpression = (constructor, newExpression) => {
    const constructorLastStatement = Ast.findLastStatement(newExpression.callee.body);
    if(constructorLastStatement === undefined) { return; }
    const thisSymbol = Ast.lookUp(constructorLastStatement, 'this');
    const thisTypeCarrier = Ast.findClosestTypeCarrier(constructorLastStatement, thisSymbol);
    const thisTypes = thisTypeCarrier.getTypes();
    thisTypes.forEach(e => e.references = []);
    if(constructor.hasOwnProperty("constructorName")) {
        for(const thisType of thisTypes) {
            thisType.constructorName = constructor.constructorName;
        }
    }
    newExpression.types = thisTypes;
    copyPropertiesTypeCarriersIfObject(constructorLastStatement, thisTypes, newExpression);
};

/**
 * @param {ts.NewExpression} node 
 */
function newExpression(node) {
    const types = node.expression.types;
    const constructors = types.filter(t => (t.id === TypeCarrier.Type.Function || t.id === TypeCarrier.Type.Class));
    const constructor = !constructors.length ? undefined : constructors[0];
    if(constructor === undefined) {
        node.types = [TypeCarrier.createAny()];
        return ;
    }
    // TODO: pick constructor?
    if(constructor.id === TypeCarrier.Type.Function && constructor.node) {
        call(node, constructor.node);
    } else if (constructor.id === TypeCarrier.Type.Class && constructor.node) {
        newClassExpression(node, constructor.node);
    }
    copyThisToNewExpression(constructor.node, node);
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

const binaryExpressionFunctions = {};
const addFunctions = {};

addFunctions[TypeCarrier.Type.Number] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            type.value = "TODO: number + array";
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + right.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value")) {
                type.value = left.value
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
            type.value = "NaN";
            break;
        }
        case TypeCarrier.Type.Any: {
            return [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
        }
        case TypeCarrier.Type.TypeVariable: {
            const types = [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
            return types;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.String] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = "TODO: string + array"
            }
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + right.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = left.value + "null";
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = left.value + "undefined";
            }
            break;
        }
        case TypeCarrier.Type.Any: {
            type.id = TypeCarrier.Type.String;
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            const types = [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
            type.id = TypeCarrier.Type.String;
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.Boolean] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = "TODO: boolean + array";
            }
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + right.node.getText();
            } 
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value")) {
                type.value = Number(left.value);
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Any: {
            return [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
        }
        case TypeCarrier.Type.TypeVariable: {
            const types = [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
            return types;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.Array] = (left, right) => {
    const type = { id: TypeCarrier.Type.String };
    if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
        type.value = "TODO: array + " + TypeCarrier.typeToString(right);
    }
    return [type];
};

addFunctions[TypeCarrier.Type.Object] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "[object Object]" + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: object + array";
            }
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object][object Object]";
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object]" + right.node.getText();
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object]null";
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object]undefined";
            break;
        }
        case TypeCarrier.Type.Any: {
            type.id = TypeCarrier.Type.String;
        }
        case TypeCarrier.Type.TypeVariable: {
            type.id = TypeCarrier.Type.String;
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ]));
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.Function] = 
addFunctions[TypeCarrier.Type.Class] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = left.node.getText() + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: function + array";
            }
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            type.value = left.node.getText() + "[object Object]";
            break;
        }
        case TypeCarrier.Type.Function: 
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            type.value = left.node.getText() + right.node.getText();
            break;
        }
        case TypeCarrier.Type.Any: {
            type.id = TypeCarrier.Type.String;
        }
        case TypeCarrier.Type.TypeVariable: {
            type.id = TypeCarrier.Type.String;
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ]));
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.Null] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.Number;
            if(right.hasOwnProperty("value")) {
                type.value = Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "null" + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: null + array";
            }
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            type.value = "null[object Object]";
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.Number;
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
            type.value = NaN;
        }
        case TypeCarrier.Type.Any: {
            return [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
        }
        case TypeCarrier.Type.TypeVariable: {
            const types = [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
            return types;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.Undefined] = (left, right, node) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "undefined" + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: undefined + array";
            }
            break;
        }
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            type.value = "undefined[object Object]";
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            type.value = "undefined" + right.node.getText();
            break;
        }
        case TypeCarrier.Type.Any: {
            return [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
        }
        case TypeCarrier.Type.TypeVariable: {
            const types = [
                TypeCarrier.createNumberWithoutValue(),
                TypeCarrier.createStringWithoutValue()
            ];
            if(right.id === TypeCarrier.Type.TypeVariable) {
                Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
            }
            return types;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeCarrier.Type.Any] = (left, right, node) => {
    const types = [
        TypeCarrier.createNumberWithoutValue(),
        TypeCarrier.createStringWithoutValue()
    ];
    if(right.id === TypeCarrier.Type.TypeVariable) {
        Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
    }
    return types;
};

addFunctions[TypeCarrier.Type.TypeVariable] = (left, right, node) => {
    const types = [
        TypeCarrier.createNumberWithoutValue(),
        TypeCarrier.createStringWithoutValue()
    ];
    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(left.value, types));
    if(right.id === TypeCarrier.Type.TypeVariable) {
        Ast.addTypeCarrierToExpression(node, TypeCarrier.create(right.value, types));
    }
    return types;
};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.PlusToken] = node => {

    const leftTypes = node.left.types;
    const rightTypes = node.right.types;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            console.assert(addFunctions.hasOwnProperty(leftType.id));
            node.types.push(...addFunctions[leftType.id](leftType, rightType, node));
        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.MinusToken] = 
binaryExpressionFunctions[ts.SyntaxKind.AsteriskToken] = 
binaryExpressionFunctions[ts.SyntaxKind.SlashToken] = 
binaryExpressionFunctions[ts.SyntaxKind.PercentToken] = 
binaryExpressionFunctions[ts.SyntaxKind.AsteriskAsteriskToken] = 
binaryExpressionFunctions[ts.SyntaxKind.LessThanToken] = 
binaryExpressionFunctions[ts.SyntaxKind.LessThanEqualsToken] = 
binaryExpressionFunctions[ts.SyntaxKind.GreaterThanToken] = 
binaryExpressionFunctions[ts.SyntaxKind.GreaterThanEqualsToken] =
binaryExpressionFunctions[ts.SyntaxKind.AmpersandToken] =
binaryExpressionFunctions[ts.SyntaxKind.BarToken] =
binaryExpressionFunctions[ts.SyntaxKind.CaretToken] =
binaryExpressionFunctions[ts.SyntaxKind.LessThanLessThanToken] =
binaryExpressionFunctions[ts.SyntaxKind.GreaterThanGreaterThanToken] =
binaryExpressionFunctions[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = node => {

    const leftTypes = node.left.types;
    const rightTypes = node.right.types;
    const op = Ast.operatorTokenToString(node.operatorToken);

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            
            let betweenTypeVariables = false;
            const type = {};
            type.id = TypeCarrier.Type.Number;

            if(leftType.id === TypeCarrier.Type.TypeVariable) {
                Ast.addTypeCarrierToExpression(node, TypeCarrier.create(leftType.value, [type]));
                betweenTypeVariables = true;
            }
            if(rightType.id === TypeCarrier.Type.TypeVariable) {
                Ast.addTypeCarrierToExpression(node, TypeCarrier.create(rightType.value, [type]));
                betweenTypeVariables = true;
            } 

            if(betweenTypeVariables) { continue; }

            const left = TypeCaster.toNumber(leftType);
            const right = TypeCaster.toNumber(rightType);
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = eval(left.value + op + right.value);
            }
    
            node.types.push(type);
            
        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsToken] = node => {
    
    const leftTypes = node.left.types;
    const rightTypes = node.right.types;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            // TODO: check for null, undefined, any?

            if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                type.value = (leftType.value == rightType.value);
            }

            node.types.push(type);

        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.ExclamationEqualsToken] = node => {
    
    const leftTypes = node.left.types;
    const rightTypes = node.right.types;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            // TODO: check for null, undefined, any?

            if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                type.value = leftType.value != rightType.value;
            }

            node.types.push(type);

        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsEqualsToken] = node => {
    
    const leftTypes = node.left.types;
    const rightTypes = node.right.types;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            if(leftType.id === rightType.id) {
                if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                    type.value = leftType.value == rightType.value;
                }
            } else {
                type.value = false;
            }

            node.types.push(type);

        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.ExclamationEqualsEqualsToken] = node => {
    
    const leftTypes = node.left.types;
    const rightTypes = node.right.types

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            if(leftType.id === rightType.id) {
                if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                    type.value = leftType.value != rightType.value;
                }
            } else {
                type.value = true;
            }

            node.types.push(type);

        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.AmpersandAmpersandToken] = node => {

    const leftTypes = node.left.types;
    const rightTypes = node.right.types

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            
            if(leftType.hasOwnProperty("value")) {
                node.types.push(Boolean(leftType.value) ? rightType : leftType);
            } else {
                node.types.push(leftType);
                node.types.push(rightType);
            }

        }
    }

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.BarBarToken] = node => {

    const leftTypes = node.left.types;
    const rightTypes = node.right.types

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
        
            if(leftType.hasOwnProperty("value")) {
                node.types.push(Boolean(leftType.value) ? leftType : rightType);
            } else {
                node.types.push(leftType);
                node.types.push(rightType);
            }

        }
    }

};

function analyzeBinaryExpression(node) {
    node.types = [];
    console.assert(
        binaryExpressionFunctions.hasOwnProperty(node.operatorToken.kind),
        "Binary expression '" + node.operatorToken.kind +  "' not implemented yet" 
    );
    binaryExpressionFunctions[node.operatorToken.kind](node);
}

// ----------------------------------------------------------------------------

const prefixUnaryExpressionFunctions = {};

prefixUnaryExpressionFunctions[ts.SyntaxKind.PlusToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = Number(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array +[] = 0, +[x] = Number(x) 
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return type;

};

prefixUnaryExpressionFunctions[ts.SyntaxKind.MinusToken] = (operandType, node) => {
    
    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = -Number(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array -[] = 0, -[x] = -Number(x) 
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(operandType.value, TypeCarrier.createNumberWithoutValue()));
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return type;

};

prefixUnaryExpressionFunctions[ts.SyntaxKind.PlusPlusToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = Number(operandType.value) + 1;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(operandType.value, TypeCarrier.createNumberWithoutValue()));
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return type;

};

prefixUnaryExpressionFunctions[ts.SyntaxKind.MinusMinusToken] = (operandType, node) => {

    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = Number(operandType.value) - 1;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(operandType.value, TypeCarrier.createNumberWithoutValue()));
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return type;

};

prefixUnaryExpressionFunctions[ts.SyntaxKind.ExclamationToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Boolean;

    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = !Boolean(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            type.value = false;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.value = false;
            break;
        }
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.value = true;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return type;

};

prefixUnaryExpressionFunctions[ts.SyntaxKind.TildeToken] = (operandType, node) => {

    const type = {};
    type.id = TypeCarrier.Type.Number;

    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = ~Number(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            type.value = -1;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.value = -1;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        case TypeCarrier.Type.TypeVariable: {
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(operandType.value, TypeCarrier.createNumberWithoutValue()));
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return type;

};

/**
 * @param {ts.PrefixUnaryExpression} node 
 */
function analyzePrefixUnaryExpression(node) {

    const operandTypes = node.operand.types;
    node.types = [];

    for(const operandType of operandTypes) {
        console.assert(
            prefixUnaryExpressionFunctions.hasOwnProperty(node.operator), 
            "Prefix unary operator " + node.operator + " not implemented yet"
        );
        node.types.push(prefixUnaryExpressionFunctions[node.operator](operandType, node));
    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.PostfixUnaryExpression} node 
 */
function analyzePostfixUnaryExpression(node) {

    const operandTypes = node.operand.types;
    node.types = [];

    for(const operandType of operandTypes) {
        
        const type = {};
        type.id = TypeCarrier.Type.Number;

        switch(operandType.id) {
            case TypeCarrier.Type.Number:
            case TypeCarrier.Type.String:
            case TypeCarrier.Type.Boolean: {
                if(operandType.hasOwnProperty("value")) {
                    type.value = Number(operandType.value);
                }
                break;
            }
            case TypeCarrier.Type.Array: {
                // TODO: add logic
                type.value = NaN;
                break;
            }
            case TypeCarrier.Type.Object:
            case TypeCarrier.Type.Function:
            case TypeCarrier.Type.Class:
            case TypeCarrier.Type.Undefined: {
                type.value = NaN;
                break;
            }
            case TypeCarrier.Type.Null: {
                type.value = 0;
                break;
            }
            case TypeCarrier.Type.Any: {
                break;
            }
            case TypeCarrier.Type.TypeVariable: {
                Ast.addTypeCarrierToExpression(node, TypeCarrier.create(operandType.value, TypeCarrier.createNumberWithoutValue()));
            }
            default: {
                console.assert(false, "Unknown Type");
                break;
            }
        }

        node.types.push(type);

    }

}

// ----------------------------------------------------------------------------

/**
 * 
 * @param {ts.TypeOfExpression} node 
 */
function analyzeTypeOfExpression(node) {

    node.types = [];
    const operandTypes = node.expression.types;

    for(const operandType of operandTypes) {

        const type = {};
        type.id = TypeCarrier.Type.String;

        switch(operandType.id) {
            case TypeCarrier.Type.Number:
            case TypeCarrier.Type.String:
            case TypeCarrier.Type.Boolean:
            case TypeCarrier.Type.Object:
            case TypeCarrier.Type.Function:
            case TypeCarrier.Type.Undefined: {
                type.value = TypeCarrier.typeToString(operandType);
                break;
            }
            case TypeCarrier.Type.Array:
            case TypeCarrier.Type.Class:
            case TypeCarrier.Type.Null: {
                type.value = "object";
                break;
            }
            case TypeCarrier.Type.Any: {
                type.value = "number";
                types.push(...[
                    TypeCarrier.createString('number'),
                    TypeCarrier.createString('string'),
                    TypeCarrier.createString('boolean'),
                    TypeCarrier.createString('array'),
                    TypeCarrier.createString('object'),
                    TypeCarrier.createString('function'),
                    TypeCarrier.createString('class'),
                    TypeCarrier.createString('undefined'),
                    TypeCarrier.createString('null'),
                ]);
            }
            case TypeCarrier.Type.TypeVariable: {
                break;
            }
            default: {
                console.assert(false, "Unknown type");
                break;
            }
        }

        node.types.push(type);

    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.PropertyAccessExpression} node 
 */
function analyzePropertyAccessExpression(node) {

    const expressionTypes = node.expression.types;
    const propertyName = node.name.getText();
    node.types = [];
    let typesContainUndefined = false;

    for(const type of expressionTypes) {
        if(type.id === TypeCarrier.Type.Object && type.hasOwnProperty('value')) {
            const name = `@${type.value}.${propertyName}`;
            for(const [,property] of Object.entries(type.properties.getSymbols())) {
                if(property.name === name) {
                    node.types.push(...Ast.findClosestTypeCarrier(node, property).getTypes());
                } 
            }
        } else if(type.id === TypeCarrier.Type.TypeVariable) {
            const types = [
                { id: TypeCarrier.Type.Array },
                { id: TypeCarrier.Type.Object }
            ];
            Ast.addTypeCarrierToExpression(node, TypeCarrier.create(type.value, types));
        }
    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.ElementAccessExpression} node 
 */
function analyzeElementAccessExpression(node) {

    const expressionTypes = node.expression.types;
    const elementTypes = node.argumentExpression.types;
    node.types = [];
    let typesContainUndefined = false;
    // TODO: FIXME
    for(const elementType of elementTypes) {

        const elementTypeString = TypeCaster.toString(elementType).value;
        
        if(elementTypeString !== undefined) {
            for(const expressionType of expressionTypes) {
                if(expressionType.id === TypeCarrier.Type.Object && expressionType.hasOwnProperty("value")) {
                    if(expressionType.value.hasOwnProperty(elementTypeString)) {
                        node.types.push(...expressionType.value[elementTypeString]);
                    } else if(!typesContainUndefined) {
                        node.types.push({ id: TypeCarrier.Type.Undefined });
                        typesContainUndefined = true;
                    }
                } else if(expressionType.id === TypeCarrier.Type.TypeVariable) {
                    const types = [
                        { id: TypeCarrier.Type.Array },
                        { id: TypeCarrier.Type.Object }
                    ];
                    Ast.addTypeCarrierToExpression(node, TypeCarrier.create(expressionType.value, types));
                }
            } 
        }
    
    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 * @param {isense.symbol} symbol
 */
function updateFreeVariables(node, symbol) {
    if(functionStack.isEmpty()) { return ; }
    const func = functionStack.top();
    if(!Ast.isDeclaredInFunction(node, symbol, func)) {
        func.freeVariables.add(symbol);
    }
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

// ----------------------------------------------------------------------------

function replaceTypeVariables(node, solutions) {

    const replaceTypeVariablesInternal = (node) => {
        if(node.hasOwnProperty('typeCarriers')) {
            for(const tc of node.typeCarriers) {
                for(const t of tc.getTypes()) {
                    if(t.id === TypeCarrier.Type.TypeVariable) {
                        Ast.addTypeCarrierToExpression(node, TypeCarrier.create(tc.getSymbol(), solutions[t.value.name]));
                    }
                }
            }
        }
    
        ts.forEachChild(node, replaceTypeVariablesInternal);
    }

    ts.forEachChild(node, replaceTypeVariablesInternal);

}

module.exports = Analyzer;