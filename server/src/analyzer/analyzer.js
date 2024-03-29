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
const { getMetaData, removeMetaData } = require('./call');
const Utility = require('../utility/utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------


const Analyzer = {};

// ----------------------------------------------------------------------------

const callStack = Stack.create();
const functionStack = Stack.create();
const noOp = () => {};

// ----------------------------------------------------------------------------

/**
 * @param {ts.SourceFile} ast 
 */
Analyzer.analyze = ast => {


    ast.analyzeDiagnostics = [];

	/**
	 * @param {ts.SourceFile} node 
	 */
	function analyzeInternal(node) {

        if(!node.binders) { node.binders = []; }

        if(node.parent && node.parent.unreachable) {
            node.unreachable = true;
        }

        if(!isNodeOfInterest(node)) { return ; }

		switch(node.kind) {
			case ts.SyntaxKind.ImportDeclaration: {
                break;
            }
            case ts.SyntaxKind.VariableDeclaration: {

                ts.forEachChild(node, analyzeInternal);
                
                if(node.name.kind === ts.SyntaxKind.Identifier) {
                    const name = node.name.text;
                    const symbol = Ast.lookUp(node, name);
                    const carrier = node.initializer ? node.initializer.carrier : TypeCarrier.createConstant(TypeInfo.createUndefined());
                    assign(node, symbol, carrier);
                    if(!node.initializer && Ast.isConstDeclaration(node.parent)) {
                        Ast.addAnalyzeDiagnostic(
                            node.getSourceFile(), 
                            AnalyzeDiagnostic.create(node, DiagnosticMessages.uninitializedConst, name)
                        );
                    }
                }
                
                break;

            }
            case ts.SyntaxKind.PropertyDeclaration: {
                ts.forEachChild(node, analyzeInternal);
                if(!node.initializer) { break; }
                const name = node.name.text;
                const symbol = Ast.lookUp(node, name);
                const carrier = node.initializer.carrier;
                assign(node, symbol, carrier);
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
                ts.forEachChild(node, analyzeInternal);
                induceParameterTypeFromPrefixUnaryExpression(node);
                node.carrier = TypeCarrier.createPrefixUnaryExpression(node.operator, node.operand.carrier);
                break;
            }
            case ts.SyntaxKind.BreakStatement:
            case ts.SyntaxKind.ContinueStatement: {
                markUnreachableStatements(Ast.findRightSiblings(node));
                break;
            }
            case ts.SyntaxKind.PostfixUnaryExpression: {
                ts.forEachChild(node, analyzeInternal);
                induceParameterTypeFromPostfixUnaryExpression(node);
                node.carrier = TypeCarrier.createPostfixUnaryExpression(node.operator, node.operand.carrier);
                break;
            }
            case ts.SyntaxKind.VoidExpression: {
                ts.forEachChild(node, analyzeInternal);
                node.carrier = TypeCarrier.createConstant(TypeInfo.createUndefined());
                break;
            }
            case ts.SyntaxKind.TypeOfExpression: {
                ts.forEachChild(node, analyzeInternal);
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

                ts.forEachChild(node, analyzeInternal);
                
				if(node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                    const lvalue = Ast.stripOutParenthesizedExpressions(node.left);
					if(lvalue.kind === ts.SyntaxKind.Identifier) {
                        const name = lvalue.escapedText;
                        const symbol = Ast.lookUp(node, name);
						if(symbol) {

                            if(Ast.isConstDeclaration(symbol.declaration.parent)) {
                                Ast.addAnalyzeDiagnostic(
                                    node.getSourceFile(), 
                                    AnalyzeDiagnostic.create(node, DiagnosticMessages.assignmentToConst, [name])
                                );
                            }

                            const carrier = node.right.carrier;
                            assign(node, symbol, carrier);
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

                        for(const type of leftTypes) {
                            if(type.type === TypeInfo.Type.Object && type.hasValue) {
                                setProperty(node, type, propertyName, node.right, node.right.carrier);
                                info.push(...rightTypes);
                            }
                        }

                        node.carrier = TypeCarrier.createConstant(info);

                    }
				} else {
                    induceParameterTypeFromBinaryExpression(node);   
                    node.carrier = TypeCarrier.createBinaryExpression(node.left.carrier, node.operatorToken, node.right.carrier);
                }
				
				break;

            }
            case ts.SyntaxKind.CaseClause:
            case ts.SyntaxKind.DefaultClause:
            case ts.SyntaxKind.Block: {
                initBlock(node);
                Utility.blockStack.push(node);
                ts.forEachChild(node, analyzeInternal);
                Utility.blockStack.pop();
                break;
            }
            case ts.SyntaxKind.PropertyAccessExpression: {
                ts.forEachChild(node, analyzeInternal);
                analyzePropertyAccessExpression(node);
                break;
            }
            case ts.SyntaxKind.ElementAccessExpression: {
                ts.forEachChild(node, analyzeInternal);
                analyzeElementAccessExpression(node);
            }
            case ts.SyntaxKind.ParenthesizedExpression: {
                ts.forEachChild(node, analyzeInternal);
                node.carrier = node.expression.carrier;
                break;
            }
			case ts.SyntaxKind.Parameter: {
                break;
			}
			case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression: {
                node.carrier = TypeCarrier.createConstant(TypeInfo.createClass(node));
                ts.forEachChild(node, analyzeInternal);
				break;
            }
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression: 
            case ts.SyntaxKind.ArrowFunction: 
            case ts.SyntaxKind.MethodDeclaration: 
            case ts.SyntaxKind.SetAccessor: 
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.Constructor: {
                if(!node.body) { break; }
                node.carrier = TypeCarrier.createConstant(TypeInfo.createFunction(node));
                functionStack.push(node);
                ts.forEachChild(node, analyzeInternal);
                functionStack.pop(node);
                break;
            }
            case ts.SyntaxKind.CallExpression: {

                ts.forEachChild(node, analyzeInternal);
                
                const types = TypeCarrier.evaluate(node.expression.carrier);
                node.plausibleCallees = types.flatMap(t => t.type === TypeInfo.Type.Function ? [t.value] : []);
                const callee = pickCallee(node);
                
                node.carrier = TypeCarrier.createCallExpression(node);

                if(callee && !isRecursive(callee)) {
                    call(node, callee);
                }

                break;

            }
            case ts.SyntaxKind.NewExpression: {
                ts.forEachChild(node, analyzeInternal);
                newExpression(node);
                break;
            }
            case ts.SyntaxKind.ObjectLiteralExpression: {
                node.type = TypeInfo.createObject(true);
                ts.forEachChild(node, analyzeInternal);
                node.carrier = TypeCarrier.createConstant(node.type);
                delete node.type;
                break;
            }
            case ts.SyntaxKind.ShorthandPropertyAssignment: {
                
                ts.forEachChild(node, analyzeInternal);

                const name = node.name.getText();

                if(name !== undefined) {
                    const symbol = Symbol.create(name, node);
                    node.parent.type.properties.insert(symbol);
                    assign(node, symbol, node.name.carrier);
                }

                break;

            }
            case ts.SyntaxKind.PropertyAssignment: {

                ts.forEachChild(node, analyzeInternal);

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
                    const symbol = Symbol.create(name, node);
                    node.parent.type.properties.insert(symbol);
                    assign(node, symbol, node.initializer.carrier);
                }

                break;
            
            }
            case ts.SyntaxKind.ReturnStatement: {
                ts.forEachChild(node, analyzeInternal);
                if(!node.unreachable) {
                    markUnreachableStatements(Ast.findRightSiblings(node));
                    const func = Ast.findAncestorFunction(node);
                    if(node.expression) {
                        func.returnTypeCarriers.push(node.expression.carrier);
                    }
                }
                break;
            }
			default: {
				ts.forEachChild(node, analyzeInternal);
				break;
			}
		}
    }

    Binder.reset();
    Binder.bindFunctionScopedDeclarations(ast);
    if(ast.kind === ts.SyntaxKind.SourceFile) {
        defineThis(ast);
    }
    ts.forEachChild(ast, analyzeInternal);

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
    const thisSymbol = Symbol.create('this', node);
    node.symbols.insert(thisSymbol);
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
    callee.returnTypeCarriers = [];
    return callee;
}

/**
 * @param {ts.Node} call 
 * @param {ts.Node} callee 
 * @param {Object} thisObject
 */
function call(call, callee, thisObject = TypeInfo.createObject(true), beforeCall = noOp) {
    callStack.push(call);
    storeInner('innerCalls', call);
    Ast.addCallSite(callee, call);
    callee = call.callee = createCallee(callee);
    callee.call = call;
    defineThis(callee, thisObject);
    copyParameterTypeBindersToCallee(callee, call.arguments || []);
    beforeCall(callee);
    initBlock(callee.body);
    Utility.blockStack.push(callee.body);
    callee.body && Analyzer.analyze(callee.body);
    Utility.blockStack.pop();
    callStack.pop();
}

/**
 * @param {ts.Node} classNode 
 */
function createEmptyConstructor(classNode) {
    const emptyConstructor = ts.createConstructor(undefined, undefined, [], ts.createBlock());
    emptyConstructor.pos = classNode.pos;
    emptyConstructor.end = classNode.end;
    ts.forEachChild(emptyConstructor, function setEnd(n) {
        n.pos = classNode.pos;
        n.end = classNode.end;
        ts.forEachChild(n, setEnd);
    });
    emptyConstructor.parent = classNode;
    emptyConstructor._original = emptyConstructor;
    emptyConstructor.callSites = [];
    return emptyConstructor;
}

/**
 * @param {ts.Node} node 
 * @param {ts.Node} constructor 
 */
function newClassExpression(node, constructor, thisObject) {

    const classNode = constructor.parent;
    const beforeCall = (constructor) => {
        for(const member of classNode.members) {
            if(member.kind === ts.SyntaxKind.PropertyDeclaration) {
                const carrier = member.initializer ? member.initializer.carrier : TypeCarrier.createConstant([TypeInfo.createUndefined()]);
                setProperty(member, thisObject, member.name.getText(), member.initializer, carrier);
            } else if(member.kind === ts.SyntaxKind.MethodDeclaration) {
                setProperty(member, thisObject, member.name.getText(), undefined, member.carrier);
            }
        }
    };
    
    call(node, constructor, thisObject, beforeCall);

}

/**
 * @param {ts.NewExpression} node 
 */
function newExpression(node) {

    const types = TypeCarrier.evaluate(node.expression.carrier);
    node.plausibleCallees = types.flatMap(t => {
        switch(t.type) {
            case TypeInfo.Type.Function:
                return t.value;
            case TypeInfo.Type.Class:
                return Ast.findConstructor(t.value) || createEmptyConstructor(t.value)
        }    
    });
    const constructor = pickCallee(node);

    node.carrier = TypeCarrier.createNewExpression(node);

    if(constructor) {
        const thisObject = TypeInfo.createObject(true);
        if(constructor.kind === ts.SyntaxKind.Constructor) {
            setClassConstructorName(constructor, thisObject);
            newClassExpression(node, constructor, thisObject);
        } else {
            setFunctionConstructorName(constructor, thisObject);
            call(node, constructor, thisObject);
        }
        if(!node.callee.returnTypeCarriers.length) {
            node.callee.returnTypeCarriers.push(TypeCarrier.createConstant(thisObject));
        }
    }

}

function setFunctionConstructorName(constructor, thisObject) {
    if(constructor.name) {
        thisObject.constructorName = constructor.name.escapedText;
    }
}

function setClassConstructorName(constructor, thisObject) {
    if(constructor.parent.name) {
        thisObject.constructorName = constructor.parent.name.escapedText;
    }
}

/**
 * @param {ts.Node} node 
 * @param {isense.symbol} symbol 
 * @param {ts.Node} rvalue
 * @param {*} carrier
 */
function assign(node, symbol, carrier) {
    const binder = TypeBinder.create(symbol, carrier);
    Ast.addTypeBinder(node, binder);
    storeInner('affectedSymbols', symbol);
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

    const propertyName = name;
    const property = getProperty(object, propertyName);
    let propertySymbol = property;

    if(!property) {
        propertySymbol = Symbol.create(propertyName, node);
        object.properties.insert(propertySymbol);
    }
    
    assign(node, propertySymbol, carrier);

}

// ----------------------------------------------------------------------------

/**
 * @param {ts.PropertyAccessExpression} node 
 */
function analyzePropertyAccessExpression(node) {

    const expressionTypes = TypeCarrier.evaluate(node.expression.carrier);
    const name = node.name.getText();
    const info = [];
    let typesContainUndefined = false;

    for(const type of expressionTypes) {
        if(type.type === TypeInfo.Type.Object && type.hasValue) {
            for(const [,property] of Object.entries(type.properties.getSymbols())) {
                if(property.name === name) {
                    // TODO: Fixme
                    const activeBinders = Ast.findActiveTypeBinders(node, property);
                    if(activeBinders.length) {
                        info.push(...TypeCarrier.evaluate(activeBinders[0].carrier));
                    }
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

function isParameter(symbol) {
    return symbol.declaration && symbol.declaration.kind === ts.SyntaxKind.Parameter;
}

function hasInducedBinders(binders) {
    return !!binders.find(b => b.carrier.induced);
}

function isInOriginalFunction(node) {
    const outerFunction = Ast.findAncestorFunction(node);
    return outerFunction && outerFunction.hasOwnProperty('_original') && outerFunction === outerFunction._original;
}

/**
 * 
 * @param {ts.Node} node 
 */
function getParameterSymbol(node) {

    if(node.carrier.kind !== TypeCarrier.Kind.Variable) { return ; }

    let symbol = node.carrier.symbol;

    while(true) {
        const binders = Ast.findActiveTypeBinders(node, symbol);
        const variableCarriers = binders.map(b => b.carrier).filter(c => c.kind === TypeCarrier.Kind.Variable);
        if(variableCarriers.length === 1) {
            symbol = variableCarriers[0].symbol;
        } else if(isParameter(symbol) && (!binders.length || hasInducedBinders(binders))) {
            return symbol;
        } else {
            return ;
        }
    }

}

/**
 * @param {ts.Node} node 
 */
function induceParameterTypeFromPrefixUnaryExpression(node) {

    if(!isInOriginalFunction(node)) { return ; }

    const parameterSymbol = getParameterSymbol(node.operand);
    
    if(parameterSymbol) {
        const carrier = createInducedCarrierFromPrefixUnaryExpression(node);
        if(carrier) { 
            const binder = TypeBinder.create(parameterSymbol, carrier);
            Ast.addTypeBinder(node, binder);
        }
    }

}

function induceParameterTypeFromPostfixUnaryExpression(node) {

    if(!isInOriginalFunction(node)) { return ; }

    const parameterSymbol = getParameterSymbol(node.operand);
    
    if(parameterSymbol) {
        const carrier = createInducedCarrierFromPostfixUnaryExpression(node);
        if(carrier) { 
            const binder = TypeBinder.create(parameterSymbol, carrier);
            Ast.addTypeBinder(node, binder);
        }
    }
    
}

/**
 * 
 * @param {ts.Node} node 
 */
function induceParameterTypeFromBinaryExpression(node) {

    if(!isInOriginalFunction(node)) { return ; }

    const leftParameterSymbol = getParameterSymbol(node.left);
    const rightParameterSymbol = getParameterSymbol(node.right);
    
    if(leftParameterSymbol) {
        const carrier = createInducedCarrierFromBinaryExpression(node);
        addInducedBinderIfCarrier(node, leftParameterSymbol, carrier);
    }

    if(rightParameterSymbol && rightParameterSymbol !== leftParameterSymbol) {
        const carrier = createInducedCarrierFromBinaryExpression(node);
        addInducedBinderIfCarrier(node, rightParameterSymbol, carrier);
    }

}

function createInducedCarrierFromPrefixUnaryExpression(node) {
    switch(node.operator) {
        case ts.SyntaxKind.PlusToken:
        case ts.SyntaxKind.MinusToken:
        case ts.SyntaxKind.PlusPlusToken:
        case ts.SyntaxKind.MinusMinusToken:
            const carrier = TypeCarrier.createConstant([
                TypeInfo.createNumber()
            ]);
            carrier.induced = true;  
            return carrier;
    }
}

function createInducedCarrierFromPostfixUnaryExpression(node) {
    switch(node.operator) {
        case ts.SyntaxKind.PlusPlusToken:
        case ts.SyntaxKind.MinusMinusToken:
            const carrier = TypeCarrier.createConstant([
                TypeInfo.createNumber()
            ]);
            carrier.induced = true;
            return carrier;
    }
}

function createInducedCarrierFromBinaryExpression(node) {
    switch(node.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken: {
            const carrier = TypeCarrier.createConstant([
                TypeInfo.create(TypeInfo.Type.Number),
                TypeInfo.create(TypeInfo.Type.String)
            ]);
            carrier.induced = true;
            return carrier;
        }
        case ts.SyntaxKind.MinusToken:
        case ts.SyntaxKind.AsteriskToken:
        case ts.SyntaxKind.SlashToken:
        case ts.SyntaxKind.PercentToken:
        case ts.SyntaxKind.AsteriskAsteriskToken:
        case ts.SyntaxKind.LessThanToken:
        case ts.SyntaxKind.LessThanEqualsToken:
        case ts.SyntaxKind.GreaterThanToken:
        case ts.SyntaxKind.GreaterThanEqualsToken:
        case ts.SyntaxKind.AmpersandToken:
        case ts.SyntaxKind.BarToken:
        case ts.SyntaxKind.CaretToken:
        case ts.SyntaxKind.LessThanLessThanToken:
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken: {
            const carrier = TypeCarrier.createConstant([
                TypeInfo.create(TypeInfo.Type.Number),
            ]);
            carrier.induced = true;
            return carrier;
        }
    }
}

function addInducedBinderIfCarrier(node, symbol, carrier) {
    if(!carrier) { return ; }
    const binder = TypeBinder.create(symbol, carrier);
    Ast.addTypeBinder(node, binder);
}

// ----------------------------------------------------------------------------

function isNodeOfInterest(node) {
    return Ast.isNodeOfInterest(node) || 
        ts.isLiteralExpression(node) ||
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword ||
        node.kind === ts.SyntaxKind.ThisKeyword;
}

// ----------------------------------------------------------------------------

function pickCallee(call) {
    if(!call.plausibleCallees.length) { return ; }
    if(call.plausibleCallees.length == 1) { return call.plausibleCallees[0]; }
    const ast = call.getSourceFile();
    const calleeInfo = getMetaData(ast, call);
    if(!calleeInfo) { return ; }
    const callee = Ast.findInnerMostNode(
        ast, calleeInfo.start, ts.isFunctionLike
    );
    if(callee) { 
        if(call.plausibleCallees.indexOf(callee) != -1) {
            return callee;
        } else {
            // TODO: not the right place to clear the metadata but it does its job :(
            removeMetaData(ast, call);
        }
    }
}

// ----------------------------------------------------------------------------

function isRecursive(func) {
    for(const c of callStack.getElements()) {
        if(func._original === c.callee._original) {
            return true;
        }
    }
}

// ----------------------------------------------------------------------------

function initBlock(node) {
    node.affectedSymbols = new Set();
    node.innerBlocks = new Set();
    node.innerCalls = new Set();
    storeInner('innerBlocks', node);
}

function storeInner(property, value) {
    if(Utility.blockStack.isEmpty()) { return ; }
    const currentBlock = Utility.blockStack.top();
    currentBlock && currentBlock[property].add(value);
}

// ----------------------------------------------------------------------------

module.exports = Analyzer;