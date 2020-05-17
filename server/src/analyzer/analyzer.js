const Ast = require('../ast/ast');
const Replicator = require('../ast/replicator');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol-table');
const Stack = require('../utility/stack');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const TypeBinder = require('../utility/type-binder');
const AnalyzeDiagnostic = require('./analyze-diagnostic');
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
                    const carrier = node.initializer !== undefined ? node.initializer.carrier : TypeCarrier.createConstant(TypeInfo.createUndefined());
                    assign(node, symbol, node.initializer, carrier);
                }
                
                break;

            }
            case ts.SyntaxKind.NumericLiteral: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createNumber(Number(node.getText())));
                break;
            }
            case ts.SyntaxKind.StringLiteral: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createString(node.text));
                break;
            }
            case ts.SyntaxKind.TrueKeyword: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createBoolean(true));
                break;
            }
            case ts.SyntaxKind.FalseKeyword: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createBoolean(false));
                break;
            }
            case ts.SyntaxKind.ArrayLiteralExpression: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createArray());
                break;
            }
            case ts.SyntaxKind.NullKeyword: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createNull());
                break;
            }
            case ts.SyntaxKind.UndefinedKeyword: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined());
                break;
            }
            case ts.SyntaxKind.Identifier: {
                // TODO: refactoring
                if(node.escapedText === "undefined") { 
                    node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined()); 
                    break;
                }
                const symbol = Ast.lookUp(node, node.getText());
                updateFreeVariables(node, symbol);
                if(symbol === undefined) { 
                    node.carrier = TypeCarrier.createConstant(TypeInfo.createAny()); 
                    break;
                }
                const closestBinder = Ast.findClosestTypeBinder(node, symbol);
                if(closestBinder === undefined) { 
                    node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined()); 
                    break;
                }
                node.carrier = closestBinder.carrier;
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
                node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined());
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
                node.carrier = symbol ? 
                    Ast.findClosestTypeBinder(node, symbol).carrier :
                    TypeCarrier.createConstant(TypeInfo.createObject(true));
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

                            const carrier = node.right.carrier;
                            assign(node, symbol, node.right, carrier);
                            // TODO: move to assign?
                            node.carrier = carrier;

                        } else {
                            Ast.addAnalyzeDiagnostic(
                                node.getSourceFile(), 
                                AnalyzeDiagnostic.create(node, DiagnosticMessages.undeclaredReference, [name])
                            );
                        }
                    } else if (lvalue.kind === ts.SyntaxKind.PropertyAccessExpression) {

                        const info = [];
                        const leftTypes = lvalue.expression.carrier.info;
                        const propertyName = lvalue.name.text;
                        const rightTypes = node.right.carrier.info;

                        // if(leftTypes === undefined) { break; } // TODO: maybe change?

                        for(const type of leftTypes) {
                            if(type.type === TypeInfo.Type.Object && type.hasValue) {
                                setProperty(node, type, propertyName, node.right, node.right.carrier);
                                info.push(...rightTypes);
                            }
                        }

                        node.carrier = TypeCarrier.createConstant(info);

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
                node.carrier = node.expression.carrier;
                break;
            }
			case ts.SyntaxKind.Parameter: {
                break;
			}
			case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createClass(node));
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
                Ast.addTypeBinder(node, TypeBinder.create(symbol, {id: TypeInfo.Type.Function, node}));
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
                Ast.addTypeBinder(node, TypeBinder.create(symbol, {id: TypeInfo.Type.Function, node}));
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
                Ast.addTypeBinder(node, TypeBinder.create(symbol, {id: TypeInfo.Type.Function, node}));
                const classDeclaration = classStack.top();
                classDeclaration.symbols.insert(symbol);
                
                ts.forEachChild(node, visitDeclarations);
				break;
            
            }
			case ts.SyntaxKind.MethodDeclaration: {

                node.carrier = TypeCarrier.createConstant(TypeInfo.createFunction(node));

                if(node.parent.kind === ts.SyntaxKind.ClassDeclaration || node.parent.kind === ts.SyntaxKind.ClassExpression) {
                    const name = node.name.text;
                    const start = node.getStart();
                    const end = node.end;
                    const symbol = Symbol.create(name, start, end);
                    Ast.addTypeBinder(node, TypeBinder.create(symbol, {id: TypeInfo.Type.Function, node}));
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
                node.carrier = TypeCarrier.createConstant(TypeInfo.createFunction(node));
                ts.forEachChild(node, visitDeclarations);
                functionStack.pop(node);
                break;
            }
			case ts.SyntaxKind.Block: {
                ts.forEachChild(node, visitDeclarations);
                Ast.copyTypeBindersFromBlockToNextStatement(node);
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

                const types = node.expression.carrier.info;
                const callees = types.flatMap(t => t.type === TypeInfo.Type.Function ? [t.value] : []);
                const callee = !callees.length ? undefined : callees[0];

                // TODO: somehow pick callee
                if(callee === undefined) {
                    node.carrier = TypeCarrier.createConstant(TypeInfo.createAny());
                } else if(!callee.body) {
                    node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined());
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
                    node.thenStatement.blockBinders = Ast.findAllTypeBinders(node.thenStatement);
                } 
                if(node.elseStatement && node.elseStatement.kind !== ts.SyntaxKind.Block && node.elseStatement.kind !== ts.SyntaxKind.IfStatement) {
                    node.elseStatement.blockBinders = Ast.findAllTypeBinders(node.elseStatement);
                }
                mergeIfStatementTypeBinders(node);
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                objectStack.push(node);
                node.type = TypeInfo.createObject(true);
                ts.forEachChild(node, visitDeclarations);
                objectStack.pop();
                node.carrier = TypeCarrier.createConstant(node.type);
                delete node.type;
                break;
            }
            case ts.SyntaxKind.ShorthandPropertyAssignment: {
                
                ts.forEachChild(node, visitDeclarations);

                const object = objectStack.top();
                const name = node.name.getText();

                if(name !== undefined) {
                    const symbol = Symbol.create(`@${object.type.value}.${name}`, node.pos, node.end);
                    object.type.properties.insert(symbol);
                    assign(node, symbol, node.initializer, node.name.carrier);
                }

                break;

            }
            case ts.SyntaxKind.PropertyAssignment: {

                ts.forEachChild(node, visitDeclarations);

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
                    assign(node, symbol, node.initializer, node.initializer.carrier);
                }

                break;
            
            }
            case ts.SyntaxKind.ReturnStatement: {
                ts.forEachChild(node, visitDeclarations);
                if(node.expression && !node.unreachable && !callStack.isEmpty()) {
                    const returnTypes = node.expression.carrier.info || [TypeInfo.createAny()];
                    const call = callStack.top();
                    call.carrier.info.push(...returnTypes);
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

    ast.binders = [];
    function initializeTypeBinders(node) {
        node.binders = [];
        ts.forEachChild(node, initializeTypeBinders);
    };
    initializeTypeBinders(ast);

	Binder.bindFunctionScopedDeclarations(ast);
    ts.forEachChild(ast, visitDeclarations);

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} source
 * @param {Array} carrier 
 * @param {ts.Node} destination
 */

function copyPropertiesTypeBindersIfObject(source, carrier, destination) {
    for(const t of carrier.info) {
        if(t.type === TypeInfo.Type.Object && t.hasValue) {
            for(const [, p] of Object.entries(t.properties.getSymbols())) {
                const propertyBinder = Ast.findClosestTypeBinder(source, p);
                Ast.addTypeBinderToClosestStatement(
                    destination, 
                    propertyBinder
                );
                copyPropertiesTypeBindersIfObject(source, propertyBinder.carrier, destination);
            }
        }
    }
}

/**
 * If statements do not need to copy properties of objects since it checks for same symbols 
 * 
 * @param {ts.IfStatement} node
 */
function mergeIfStatementTypeBinders(node) {
    
    const thenBinders = node.thenStatement.blockBinders;
    const elseBinders = node.elseStatement ? node.elseStatement.blockBinders : [];

    const binders = [];
    const notInBothBinders = [...thenBinders, ...elseBinders];

    for(const thenBinder of thenBinders) {
        for(const elseBinder of elseBinders) {
            if(thenBinder.symbol === elseBinder.symbol) {
                const binder = TypeBinder.create(
                    thenBinder.symbol,
                    TypeCarrier.createConstant([
                        ...thenBinder.carrier.info,
                        ...elseBinder.carrier.info
                    ])
                );
                notInBothBinders.splice(notInBothBinders.indexOf(thenBinder), 1);
                notInBothBinders.splice(notInBothBinders.indexOf(elseBinder), 1);
                binders.push(binder);
            }
        }
    }

    const topLevelIfStatement = Ast.findTopLevelIfStatement(node);

    for(const b of notInBothBinders) {
        const symbol = b.symbol;
        let addOuterType = node === topLevelIfStatement;
        const outerBinder = addOuterType ? Ast.findClosestTypeBinder(topLevelIfStatement, symbol) : undefined;
        addOuterType = addOuterType && outerBinder;
        const binder = TypeBinder.create(symbol, TypeCarrier.createConstant([
            ...(addOuterType ? outerBinder.carrier.info : []),
            ...(b.carrier.info)
        ]));
        binders.push(binder);
    }

    node.blockBinders = binders;
    const nextStatement = Ast.findNextStatementOfBlock(node);
    if(nextStatement) {
        nextStatement.binders = binders;
    } else {
        node.binders = binders;
    }

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} func 
 * @param {*} args 
 */
function copyParameterTypeBindersToCallee(func, args) {
    // TODO: handle destructuring?
    for(let i = 0; i < Math.min(func.parameters.length, args.length); ++i) {
        const parameter = func.parameters[i];
        const argument = args[i];
        const parameterSymbol = parameter.symbols.getSymbols()[parameter.name.escapedText];
        console.assert(parameterSymbol, "parameter without symbol?");
        const carrier = argument.carrier;
        const binder = TypeBinder.create(parameterSymbol, carrier);
        Ast.addTypeBinder(parameter, binder);
        copyPropertiesTypeBindersIfObject(argument, carrier, parameter);
    }
    for(let i = args.length; i < func.parameters.length; ++i) {
        const parameter = func.parameters[i];
        const parameterSymbol = parameter.symbols.getSymbols()[parameter.name.escapedText];
        console.assert(parameterSymbol, "parameter without symbol?");
        Ast.addTypeBinder(parameter, TypeBinder.create(parameterSymbol, TypeCarrier.createConstant(TypeInfo.createUndefined())));
    }
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node 
 * @param {*} thisObject 
 */
function defineThis(node, thisObject = TypeInfo.createObject(true)) {
    const thisSymbol = Symbol.create('this', 0, 0);
    node.symbols.insert(thisSymbol);
    assign(node, thisSymbol, undefined, TypeCarrier.createConstant(thisObject));
}

/**
 * @param {ts.Node} original 
 * @param {ts.Node} clone 
 */
function replicateISenseData(original, clone) {
    original.symbols && (clone.symbols = SymbolTable.copy(original.symbols));
    clone.binders = [];
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
    calleeDependenciesNode.binders = [];
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
function copyFreeVariablesTypeBindersToCallee(callee, call) {
    console.assert(callee.hasOwnProperty("freeVariables"), "addFreeVariablesTypeBinders");
    callee.freeVariables.forEach(fv => {
        const closestBinder = Ast.findClosestTypeBinder(call, fv);
        console.assert(closestBinder !== undefined, 'addFreeVariablesTypeBinders: Failed to find type binder for free variable');
        const carrier = closestBinder.carrier;
        assign(callee.parent, fv, undefined, carrier);
        copyPropertiesTypeBindersIfObject(call, carrier, callee.parent);
        for(const t of carrier.info) {
            if(t.type === TypeInfo.Type.Object && t.hasValue) {
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
function copyFreeVariablesTypeBindersToCaller(callee, call) {
    const lastStatement = Ast.findLastStatement(callee.body) || callee.body;
    const callNextStatement = Ast.findNextStatement(call);
    for(const fv of callee.freeVariables) {
        const closestBinder = Ast.findClosestTypeBinder(lastStatement, fv);
        console.assert(closestBinder !== undefined, 'addFreeVariablesTypeBinders: Failed to find type binder for free variable');
        Ast.addTypeBinderToClosestStatement(callNextStatement, closestBinder);
        copyPropertiesTypeBindersIfObject(lastStatement, closestBinder.carrier, callNextStatement);
    }
}

/**
 * @param {ts.Node} call 
 * @param {ts.Node} callee 
 * @param {Object} thisObject
 */
function call(call, callee, thisObject = TypeInfo.createObject(true), beforeCall = noOp) {
    call.carrier = TypeCarrier.createConstant([]);
    // if(!callee.body) {
    //     call.carrier.info.push(TypeInfo.createUndefined);
    //     return; 
    // }
    callStack.push(call);
    Ast.addCallSite(callee, call);
    callee = call.callee = createCallee(callee);
    defineThis(callee.parent, thisObject);
    copyParameterTypeBindersToCallee(callee, call.arguments || []);
    copyFreeVariablesTypeBindersToCallee(callee, call);
    beforeCall(callee);
    Analyzer.analyze(callee.body);
    copyFreeVariablesTypeBindersToCaller(callee, call);
    if(!call.carrier.info.length) { call.carrier.info.push(TypeInfo.createUndefined()); }
    callStack.pop();
}

/**
 * @param {ts.Node} classNode 
 */
function createEmptyConstructor(classNode) {
    const emptyConstructor = ts.createConstructor(undefined, undefined, [], ts.createBlock());
    emptyConstructor.parent = classNode;
    emptyConstructor._original = emptyConstructor;
    return emptyConstructor;
}

/**
 * @param {ts.Node} node 
 * @param {ts.Node} constructor 
 */
function newClassExpression(node, classNode) {

    const constructor = Ast.findConstructor(classNode) || createEmptyConstructor();
    const thisObject = TypeInfo.createObject(true);
    const beforeCall = (constructor) => {
        for(const member of classNode.members) {
            if(member.kind === ts.SyntaxKind.PropertyDeclaration) {
                setProperty(constructor, thisObject, member.name.getText(), member.initializer, member.initializer.carrier);
            } else if(member.kind === ts.SyntaxKind.MethodDeclaration) {
                setProperty(constructor, thisObject, member.name.getText(), undefined, member.carrier);
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
    const thisBinder = Ast.findClosestTypeBinder(constructorLastStatement, thisSymbol);
    const thisCarrier = thisBinder.carrier;
    const thisTypes = thisCarrier.info;
    thisTypes.forEach(e => e.references = []);
    if(constructor.hasOwnProperty("constructorName")) {
        for(const thisType of thisTypes) {
            thisType.constructorName = constructor.constructorName;
        }
    }
    newExpression.carrier = thisCarrier;
    copyPropertiesTypeBindersIfObject(constructorLastStatement, thisCarrier, newExpression);
};

/**
 * @param {ts.NewExpression} node 
 */
function newExpression(node) {
    const types = node.expression.carrier.info;
    const constructors = types.filter(t => (t.type === TypeInfo.Type.Function || t.type === TypeInfo.Type.Class));
    const constructor = !constructors.length ? undefined : constructors[0];
    if(constructor === undefined) {
        node.carrier = TypeCarrier.createConstant(TypeInfo.createAny());
        return ;
    }
    // TODO: pick constructor?
    if(constructor.type === TypeInfo.Type.Function && constructor.value) {
        call(node, constructor.value);
    } else if (constructor.type === TypeInfo.Type.Class && constructor.value) {
        newClassExpression(node, constructor.value);
    }
    copyThisToNewExpression(constructor.value, node);
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} rvalue
 * @param {*} carrier
 */
function assign(node, symbol, rvalue, carrier) {

    const lvalueBinder = Ast.findClosestTypeBinder(node, symbol);

    if(lvalueBinder !== undefined) {
        for(const type of lvalueBinder.carrier.info) {
            if(type.type === TypeInfo.Type.Object) {
                const index = type.references.indexOf(symbol);
                console.assert(index != -1, "Remove reference from object");
                type.references.splice(index, 1);
            }
        }   
    }

    for(const type of carrier.info) {
        if(type.type === TypeInfo.Type.Object && type.hasValue) {
            type.references.push(symbol);
        }
    }

    const binder = TypeBinder.create(symbol, carrier);
    Ast.addTypeBinderToExpression(node, binder);

    if(rvalue) {
        rvalue = Ast.stripOutParenthesizedExpressions(rvalue);
        if(rvalue.kind === ts.SyntaxKind.CallExpression && rvalue.callee) {
            copyPropertiesTypeBindersIfObject(Ast.findLastStatement(rvalue.callee.body) || rvalue.callee.body, carrier, rvalue);
        }
    }

    return binder;

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
 * @param {*} carrier 
 */
function setProperty(node, object, name, rvalue, carrier) {

    const propertyName = `@${object.value}.${name}`;
    const property = getProperty(object, propertyName);
    const symbol = property ? property : Symbol.create(propertyName, node.pos, node.end);
    const binder = assign(node, symbol, rvalue, carrier);
    
    Ast.addTypeBinderToExpression(node, binder);

    !property && object.references.forEach(reference => {

        const previousBinder = Ast.findClosestTypeBinder(node, reference);
        const newTypes = [];
        
        for(const type of previousBinder.carrier.info) {
            const newType = TypeInfo.copy(type);
            if(newType.type === TypeInfo.Type.Object) {
                newType.properties.insert(symbol);
            }
            newTypes.push(newType);
        }
    
        const binder = TypeBinder.create(reference, TypeCarrier.createConstant(newTypes));
        Ast.addTypeBinderToExpression(node, binder);
    
    });

}

// ----------------------------------------------------------------------------

const binaryExpressionFunctions = {};
const addFunctions = {};

addFunctions[TypeInfo.Type.Number] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number: {
            type.type = TypeInfo.Type.Number;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeInfo.Type.String: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeInfo.Type.Boolean: {
            type.type = TypeInfo.Type.Number;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            type.value = "TODO: number + array";
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = String(left.value) + right.value.getText();
            }
            break;
        }
        case TypeInfo.Type.Null: {
            type.type = TypeInfo.Type.Number;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value
            }
            break;
        }
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.Number;
            type.hasValue = true; // TODO: fix me?
            type.value = "NaN";
            break;
        }
        case TypeInfo.Type.Any: {
            return [
                TypeInfo.createNumber(),
                TypeInfo.createString()
            ];
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.String] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeInfo.Type.String: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + right.value;
            }
            break;
        }
        case TypeInfo.Type.Boolean: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = "TODO: string + array"
            }
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + "[object Object]";
            }
            break;
        }
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + right.value.getText();
            }
            break;
        }
        case TypeInfo.Type.Null: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + "null";
            }
            break;
        }
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value + "undefined";
            }
            break;
        }
        case TypeInfo.Type.Any: {
            type.type = TypeInfo.Type.String;
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.Boolean] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number: {
            type.type = TypeInfo.Type.Number;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeInfo.Type.String: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeInfo.Type.Boolean: {
            type.type = TypeInfo.Type.Number;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.value = "TODO: boolean + array";
            }
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            type.type = TypeInfo.Type.String;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = String(left.value) + right.value.getText();
            } 
            break;
        }
        case TypeInfo.Type.Null: {
            type.type = TypeInfo.Type.Number;
            if(left.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(left.value);
            }
            break;
        }
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.Number;
            type.hasValue = true; // TODO: fix me?
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Any: {
            return [
                TypeInfo.createNumber(),
                TypeInfo.createString()
            ];
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.Array] = (left, right) => {
    const type = { id: TypeInfo.Type.String };
    if(left.hasValue && right.hasValue) {
        type.value = "TODO: array + " + TypeInfo.typeToString(right);
    }
    return [type];
};

addFunctions[TypeInfo.Type.Object] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = "[object Object]" + String(right.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.value = "TODO: object + array";
            }
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "[object Object][object Object]";
            break;
        }
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "[object Object]" + right.value.getText();
            break;
        }
        case TypeInfo.Type.Null: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "[object Object]null";
            break;
        }
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "[object Object]undefined";
            break;
        }
        case TypeInfo.Type.Any: {
            type.type = TypeInfo.Type.String;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.Function] = 
addFunctions[TypeInfo.Type.Class] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean:
        case TypeInfo.Type.Null:
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = left.value.getText() + String(right.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.value = "TODO: function + array";
            }
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = left.value.getText() + "[object Object]";
            break;
        }
        case TypeInfo.Type.Function: 
        case TypeInfo.Type.Class: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = left.value.getText() + right.value.getText();
            break;
        }
        case TypeInfo.Type.Any: {
            type.type = TypeInfo.Type.String;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.Null] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.Boolean: {
            type.type = TypeInfo.Type.Number;
            if(right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(right.value);
            }
            break;
        }
        case TypeInfo.Type.String: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = "null" + right.value;
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.value = "TODO: null + array";
            }
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "null[object Object]";
            break;
        }
        case TypeInfo.Type.Null: {
            type.type = TypeInfo.Type.Number;
            type.hasValue = true; // TODO: fix me?
            type.value = 0;
            break;
        }
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.Number;
            type.hasValue = true; // TODO: fix me?
            type.value = NaN;
        }
        case TypeInfo.Type.Any: {
            return [
                TypeInfo.createNumber(),
                TypeInfo.createString()
            ];
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.Undefined] = (left, right, node) => {

    const type = {};

    switch(right.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.Boolean:
        case TypeInfo.Type.Null:
        case TypeInfo.Type.Undefined: {
            type.type = TypeInfo.Type.Number;
            type.hasValue = true; // TODO: fix me?
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.String: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = "undefined" + right.value;
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.type = TypeInfo.Type.String;
            if(right.hasValue) {
                type.value = "TODO: undefined + array";
            }
            break;
        }
        case TypeInfo.Type.Object: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "undefined[object Object]";
            break;
        }
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            type.type = TypeInfo.Type.String;
            type.hasValue = true; // TODO: fix me?
            type.value = "undefined" + right.value.getText();
            break;
        }
        case TypeInfo.Type.Any: {
            return [
                TypeInfo.createNumber(),
                TypeInfo.createString()
            ];
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

addFunctions[TypeInfo.Type.Any] = (left, right, node) => {
    const info = [
        TypeInfo.createNumber(),
        TypeInfo.createString()
    ];
    return info;
};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.PlusToken] = node => {

    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            console.assert(addFunctions.hasOwnProperty(leftType.type));
            info.push(...addFunctions[leftType.type](leftType, rightType, node));
        }
    }

    node.carrier = TypeCarrier.createConstant(info);

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

    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;
    const op = Ast.operatorTokenToString(node.operatorToken);

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            
            const type = {};
            type.type = TypeInfo.Type.Number;

            const left = TypeInfo.toNumber(leftType);
            const right = TypeInfo.toNumber(rightType);
            if(left.hasValue && right.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = eval(left.value + op + right.value);
            }
    
            info.push(type);
            
        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsToken] = node => {
    
    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.type = TypeInfo.Type.Boolean;

            // TODO: check for null, undefined, any?

            if(leftType.hasValue && rightType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = (leftType.value == rightType.value);
            }

            info.push(type);

        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.ExclamationEqualsToken] = node => {
    
    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.type = TypeInfo.Type.Boolean;

            // TODO: check for null, undefined, any?

            if(leftType.hasValue && rightType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = leftType.value != rightType.value;
            }

            info.push(type);

        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsEqualsToken] = node => {
    
    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.type = TypeInfo.Type.Boolean;

            if(leftType.type === rightType.type) {
                if(leftType.hasValue && rightType.hasValue) {
                    type.hasValue = true; // TODO: fix me?
                    type.value = leftType.value == rightType.value;
                }
            } else {
                type.hasValue = true; // TODO: fix me?
                type.value = false;
            }

            info.push(type);

        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.ExclamationEqualsEqualsToken] = node => {
    
    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.type = TypeInfo.Type.Boolean;

            if(leftType.type === rightType.type) {
                if(leftType.hasValue && rightType.hasValue) {
                    type.hasValue = true; // TODO: fix me?
                    type.value = leftType.value != rightType.value;
                }
            } else {
                type.hasValue = true; // TODO: fix me?
                type.value = true;
            }

            info.push(type);

        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.AmpersandAmpersandToken] = node => {

    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            
            if(leftType.hasValue) {
                info.push(Boolean(leftType.value) ? rightType : leftType);
            } else {
                info.push(leftType);
                info.push(rightType);
            }

        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

/**
 * @param {ts.Node} node
 */
binaryExpressionFunctions[ts.SyntaxKind.BarBarToken] = node => {

    const info = [];
    const leftTypes = node.left.carrier.info;
    const rightTypes = node.right.carrier.info;

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
        
            if(leftType.hasValue) {
                info.push(Boolean(leftType.value) ? leftType : rightType);
            } else {
                info.push(leftType);
                info.push(rightType);
            }

        }
    }

    node.carrier = TypeCarrier.createConstant(info);

};

function analyzeBinaryExpression(node) {
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
    type.type = TypeInfo.Type.Number;
    
    switch(operandType.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(operandType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(operandType.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.hasValue = true; // TODO: fix me?
            // TODO: add logic for array +[] = 0, +[x] = Number(x) 
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Undefined: {
            type.hasValue = true; // TODO: fix me?
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Null: {
            type.hasValue = true; // TODO: fix me?
            type.value = 0;
            break;
        }
        case TypeInfo.Type.Any: {
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
    type.type = TypeInfo.Type.Number;
    
    switch(operandType.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(operandType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = -Number(operandType.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            type.hasValue = true; // TODO: fix me?
            // TODO: add logic for array -[] = 0, -[x] = -Number(x) 
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Undefined: {
            type.hasValue = true; // TODO: fix me?
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Null: {
            type.hasValue = true; // TODO: fix me?
            type.value = 0;
            break;
        }
        case TypeInfo.Type.Any: {
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
    type.type = TypeInfo.Type.Number;
    
    switch(operandType.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(operandType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(operandType.value) + 1;
            }
            break;
        }
        case TypeInfo.Type.Array: {
            // TODO: add logic for array
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Null: {
            type.value = 0;
            break;
        }
        case TypeInfo.Type.Any: {
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
    type.type = TypeInfo.Type.Number;
    
    switch(operandType.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(operandType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = Number(operandType.value) - 1;
            }
            break;
        }
        case TypeInfo.Type.Array: {
            // TODO: add logic for array
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeInfo.Type.Null: {
            type.value = 0;
            break;
        }
        case TypeInfo.Type.Any: {
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
    type.type = TypeInfo.Type.Boolean;

    switch(operandType.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(operandType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = !Boolean(operandType.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            // TODO: add logic
            type.value = false;
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            type.value = false;
            break;
        }
        case TypeInfo.Type.Null:
        case TypeInfo.Type.Undefined: {
            type.value = true;
            break;
        }
        case TypeInfo.Type.Any: {
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
    type.type = TypeInfo.Type.Number;

    switch(operandType.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(operandType.hasValue) {
                type.hasValue = true; // TODO: fix me?
                type.value = ~Number(operandType.value);
            }
            break;
        }
        case TypeInfo.Type.Array: {
            // TODO: add logic
            type.value = -1;
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Null:
        case TypeInfo.Type.Undefined: {
            type.value = -1;
            break;
        }
        case TypeInfo.Type.Any: {
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

    const operandTypes = node.operand.carrier.info;
    const info = [];

    for(const operandType of operandTypes) {
        console.assert(
            prefixUnaryExpressionFunctions.hasOwnProperty(node.operator), 
            "Prefix unary operator " + node.operator + " not implemented yet"
        );
        info.push(prefixUnaryExpressionFunctions[node.operator](operandType, node));
    }

    node.carrier = TypeCarrier.createConstant(info);

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.PostfixUnaryExpression} node 
 */
function analyzePostfixUnaryExpression(node) {

    const operandTypes = node.operand.carrier.info;
    const info = [];

    for(const operandType of operandTypes) {
        
        const type = {};
        type.type = TypeInfo.Type.Number;

        switch(operandType.type) {
            case TypeInfo.Type.Number:
            case TypeInfo.Type.String:
            case TypeInfo.Type.Boolean: {
                if(operandType.hasValue) {
                    type.hasValue = true; // TODO: fix me?
                    type.value = Number(operandType.value);
                }
                break;
            }
            case TypeInfo.Type.Array: {
                // TODO: add logic
                type.value = NaN;
                break;
            }
            case TypeInfo.Type.Object:
            case TypeInfo.Type.Function:
            case TypeInfo.Type.Class:
            case TypeInfo.Type.Undefined: {
                type.value = NaN;
                break;
            }
            case TypeInfo.Type.Null: {
                type.value = 0;
                break;
            }
            case TypeInfo.Type.Any: {
                break;
            }
            default: {
                console.assert(false, "Unknown Type");
                break;
            }
        }

        info.push(type);

    }

    TypeCarrier.createConstant(info);

}

// ----------------------------------------------------------------------------

/**
 * 
 * @param {ts.TypeOfExpression} node 
 */
function analyzeTypeOfExpression(node) {

    const info = [];
    const operandTypes = node.expression.carrier.info;

    for(const operandType of operandTypes) {

        const type = {};
        type.type = TypeInfo.Type.String;

        switch(operandType.type) {
            case TypeInfo.Type.Number:
            case TypeInfo.Type.String:
            case TypeInfo.Type.Boolean:
            case TypeInfo.Type.Object:
            case TypeInfo.Type.Function:
            case TypeInfo.Type.Undefined: {
                type.hasValue = true; // TODO: fix me?
                type.value = TypeInfo.typeToString(operandType);
                break;
            }
            case TypeInfo.Type.Array:
            case TypeInfo.Type.Class:
            case TypeInfo.Type.Null: {
                type.hasValue = true; // TODO: fix me?
                type.value = "object";
                break;
            }
            case TypeInfo.Type.Any: {
                type.hasValue = true; // TODO: fix me?
                type.value = "number";
                info.push(...[
                    TypeInfo.createString('number'),
                    TypeInfo.createString('string'),
                    TypeInfo.createString('boolean'),
                    TypeInfo.createString('array'),
                    TypeInfo.createString('object'),
                    TypeInfo.createString('function'),
                    TypeInfo.createString('class'),
                    TypeInfo.createString('undefined'),
                    TypeInfo.createString('null'),
                ]);
            }
            default: {
                console.assert(false, "Unknown type");
                break;
            }
        }

        info.push(type);

    }

    node.carrier = TypeCarrier.createConstant(info);

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.PropertyAccessExpression} node 
 */
function analyzePropertyAccessExpression(node) {

    const expressionTypes = node.expression.carrier.info;
    const propertyName = node.name.getText();
    const info = [];
    let typesContainUndefined = false;

    for(const type of expressionTypes) {
        if(type.type === TypeInfo.Type.Object && type.hasValue) {
            const name = `@${type.value}.${propertyName}`;
            for(const [,property] of Object.entries(type.properties.getSymbols())) {
                if(property.name === name) {
                    info.push(...Ast.findClosestTypeBinder(node, property).carrier.info);
                } 
            }
        }
    }

    node.carrier = TypeCarrier.createConstant(info);

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.ElementAccessExpression} node 
 */
function analyzeElementAccessExpression(node) {

    const expressionTypes = node.expression.carrier.info;
    const elementTypes = node.argumentExpression.carrier.info;
    const info = [];
    let typesContainUndefined = false;
    // TODO: FIXME
    for(const elementType of elementTypes) {

        const elementTypeString = TypeInfo.toString(elementType).value;
        
        if(elementTypeString !== undefined) {
            for(const expressionType of expressionTypes) {
                if(expressionType.type === TypeInfo.Type.Object && expressionType.hasValue) {
                    if(expressionType.value.hasOwnProperty(elementTypeString)) {
                        info.push(...expressionType.value[elementTypeString]);
                    } else if(!typesContainUndefined) {
                        info.push({ id: TypeInfo.Type.Undefined });
                        typesContainUndefined = true;
                    }
                }
            } 
        }
    
    }

    TypeCarrier.createConstant(info);

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

module.exports = Analyzer;