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
                if(symbol === undefined) { 
                    node.carrier = TypeCarrier.createConstant(TypeInfo.createAny()); 
                    break;
                }
                updateFreeVariables(node, symbol);
                node.carrier = TypeCarrier.createVariable(symbol, node);
                break;
            }
            case ts.SyntaxKind.PrefixUnaryExpression: {
                ts.forEachChild(node, visitDeclarations);
                node.carrier = TypeCarrier.createPrefixUnaryExpression(node.operator, node.operand.carrier);
                break;
            }
            case ts.SyntaxKind.PostfixUnaryExpression: {
                ts.forEachChild(node, visitDeclarations);
                node.carrier = TypeCarrier.createPostfixUnaryExpression(node.operator, node.operand.carrier);
                break;
            }
            case ts.SyntaxKind.VoidExpression: {
                ts.forEachChild(node, visitDeclarations);
                node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined());
                break;
            }
            case ts.SyntaxKind.TypeOfExpression: {
                ts.forEachChild(node, visitDeclarations);
                node.carrier = TypeCarrier.createTypeOfExpression(node.expression.carrier);
                break;
            }
            case ts.SyntaxKind.ThisKeyword: {
                // TODO: refactoring
                const symbol = Ast.lookUp(node, 'this');
                console.assert(symbol, `this symbol not found`);
                node.carrier = TypeCarrier.createVariable(symbol, node);
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
                        const leftTypes = TypeCarrier.evaluate(lvalue.expression.carrier);
                        const propertyName = lvalue.name.text;
                        const rightTypes = TypeCarrier.evaluate(node.right.carrier);

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
                    node.carrier = TypeCarrier.createBinaryExpression(node.left.carrier, node.operatorToken, node.right.carrier);
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
                if(!node.body) { break; }
                functionStack.push(node);
                node.carrier = TypeCarrier.createConstant(TypeInfo.createFunction(node));
                ts.forEachChild(node.body, visitDeclarations);
                functionStack.pop(node);
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
                
                const types = TypeCarrier.evaluate(node.expression.carrier);
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
            case ts.SyntaxKind.IfStatement: {
                ts.forEachChild(node, visitDeclarations);
                const conditionInfo = TypeCarrier.evaluate(node.expression.carrier);
                node.conditionBoolean = TypeInfo.createBoolean();
                if(conditionInfo.length === 1 && conditionInfo[0].hasValue) {
                    node.conditionBoolean = TypeInfo.toBoolean(conditionInfo[0]);
                    if(node.conditionBoolean.value) {
                        markUnreachableStatements(Ast.findRightSiblings(node.thenStatement));
                    } else {
                        markUnreachableStatements([node.thenStatement]);
                    }
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
                    const returnTypes = TypeCarrier.evaluate(node.expression.carrier) || [TypeInfo.createAny()];
                    const call = callStack.top();
                    TypeCarrier.evaluate(call.carrier).push(...returnTypes);
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
    if(ast.kind === ts.SyntaxKind.SourceFile) {
        defineThis(ast);
        
    }
    ts.forEachChild(ast, visitDeclarations);

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} source
 * @param {Array} carrier 
 * @param {ts.Node} destination
 */

function copyPropertiesTypeBindersIfObject(source, carrier, destination) {
    for(const t of TypeCarrier.evaluate(carrier)) {
        if(t.type === TypeInfo.Type.Object && t.hasValue) {
            for(const [, p] of Object.entries(t.properties.getSymbols())) {
                const propertyBinder = Ast.findActiveTypeBinders(source, p)[0]; // TODO: fixme
                Ast.addTypeBinderToClosestStatement(
                    destination, 
                    propertyBinder
                );
                copyPropertiesTypeBindersIfObject(source, propertyBinder.carrier, destination);
            }
        }
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
    // Use addTypeBinder instead of assign because this is not a binary expression.
    thisObject.references.push(thisSymbol);
    Ast.addTypeBinder(node, TypeBinder.create(thisSymbol, TypeCarrier.createConstant(thisObject)));
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
 * @param {ts.Node} callee 
 * 
 * @returns {ts.Node}
 */
function createCallee(callee) {
    callee = Replicator.replicate(callee, callReplicationOptions);
    callee.parent = callee._original.parent;
    callee.freeVariables = new Set(callee._original.freeVariables);
    callee.symbols = SymbolTable.create();
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
        const closestBinder = Ast.findActiveTypeBinders(call, fv)[0]; // TODO: fixme
        console.assert(closestBinder !== undefined, 'addFreeVariablesTypeBinders: Failed to find type binder for free variable');
        const carrier = closestBinder.carrier;
        // Use addTypeBinder instead of assign because this is not a binary expression.
        Ast.addTypeBinder(callee, closestBinder);
        copyPropertiesTypeBindersIfObject(call, carrier, callee);
        for(const t of TypeCarrier.evaluate(closestBinder.carrier)) {
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
        const closestBinder = Ast.findActiveTypeBinders(lastStatement, fv)[0];  // TODO: fixme
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
    callStack.push(call);
    Ast.addCallSite(callee, call);
    callee = call.callee = createCallee(callee);
    callee.call = call;
    defineThis(callee, thisObject);
    copyParameterTypeBindersToCallee(callee, call.arguments || []);
    // copyFreeVariablesTypeBindersToCallee(callee, call);
    beforeCall(callee);
    Analyzer.analyze(callee.body);
    // copyFreeVariablesTypeBindersToCaller(callee, call);
    const callInfo = TypeCarrier.evaluate(call.carrier);
    if(!callInfo.length) { callInfo.push(TypeInfo.createUndefined()); }
    callStack.pop();
}

/**
 * @param {ts.Node} classNode 
 */
function createEmptyConstructor(classNode) {
    const emptyConstructor = ts.createConstructor(undefined, undefined, [], ts.createBlock());
    emptyConstructor.end = classNode.end;
    ts.forEachChild(emptyConstructor, function setEnd(n) {
        n.end = classNode.end;
        ts.forEachChild(n, setEnd);
    });
    emptyConstructor.parent = classNode;
    emptyConstructor._original = emptyConstructor;
    return emptyConstructor;
}

/**
 * @param {ts.Node} node 
 * @param {ts.Node} constructor 
 */
function newClassExpression(node, classNode) {

    const constructor = Ast.findConstructor(classNode) || createEmptyConstructor(classNode);
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
    const constructorLastStatement = Ast.findLastStatement(newExpression.callee.body) || newExpression.callee.body;
    if(constructorLastStatement === undefined) { return; }
    const thisSymbol = Ast.lookUp(constructorLastStatement, 'this');
    const thisBinder = Ast.findActiveTypeBinders(constructorLastStatement, thisSymbol)[0];  // TODO: fixme
    const thisCarrier = thisBinder.carrier;
    const thisTypes = TypeCarrier.evaluate(thisCarrier);
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
    const types = TypeCarrier.evaluate(node.expression.carrier);
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

    const lvalueBinders = Ast.findActiveTypeBinders(node, symbol);

    if(lvalueBinders.length) {
        for(const b of lvalueBinders) {
            for(const type of TypeCarrier.evaluate(b.carrier)) {
                if(type.type === TypeInfo.Type.Object) {
                    const index = type.references.indexOf(symbol);
                    console.assert(index != -1, "Remove reference from object");
                    type.references.splice(index, 1);
                }
            }   
        }
    }

    const binder = TypeBinder.create(symbol, carrier);
    Ast.addTypeBinderToExpression(node, binder);

    for(const type of TypeCarrier.evaluate(carrier)) {
        if(type.type === TypeInfo.Type.Object && type.hasValue) {
            type.references.push(symbol);
        }
    }

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

        const previousBinder = Ast.findActiveTypeBinders(node, reference)[0]; // TODO: fixme
        const b = TypeBinder.copy(previousBinder);
        
        for(const info of TypeCarrier.evaluate(b.carrier)) {
            if(info.type === TypeInfo.Type.Object) {
                info.properties.insert(symbol);
            }
        }

        Ast.addTypeBinderToExpression(node, b);
    
    });

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.PropertyAccessExpression} node 
 */
function analyzePropertyAccessExpression(node) {

    const expressionTypes = TypeCarrier.evaluate(node.expression.carrier);
    const propertyName = node.name.getText();
    const info = [];
    let typesContainUndefined = false;

    for(const type of expressionTypes) {
        if(type.type === TypeInfo.Type.Object && type.hasValue) {
            const name = `@${type.value}.${propertyName}`;
            for(const [,property] of Object.entries(type.properties.getSymbols())) {
                if(property.name === name) {
                    // TODO: fixme
                    info.push(...TypeCarrier.evaluate(Ast.findActiveTypeBinders(node, property)[0]));
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

    const expressionTypes = TypeCarrier.evaluate(node.expression.carrier);
    const elementTypes = TypeCarrier.evaluate(node.argumentExpression.carrier);
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