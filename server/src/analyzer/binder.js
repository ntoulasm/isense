const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol-table');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const TypeBinder = require('../utility/type-binder');

// ----------------------------------------------------------------------------

const ts = require('typescript');

//-----------------------------------------------------------------------------

const Binder = {};

//-----------------------------------------------------------------------------

Binder.totalAnonymousFunctions = 0;
Binder.totalAnonymousClasses = 0;

//-----------------------------------------------------------------------------

const bindFunctionScopedDeclarationsFunctions = {};
const bindBlockScopedDeclarationsFunctions = {};
const noOp = () => {};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} body
 */
Binder.bindFunctionScopedDeclarations = body => {
	if (!body) {
		return;
	}

	body.binders = ts.isClassLike(body) ? body.binders : [];
	body.symbols = SymbolTable.create();

	const bindFunctionScopedDeclarationsInternal = node => {
		let iterateChildren = true;
		if (bindFunctionScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
			iterateChildren = !!bindFunctionScopedDeclarationsFunctions[
				node.kind
			](node, body);
		}
		if (iterateChildren) {
			ts.forEachChild(node, bindFunctionScopedDeclarationsInternal);
		}
	};

	ts.forEachChild(body, bindFunctionScopedDeclarationsInternal);
};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} block
 */
Binder.bindBlockScopedDeclarations = block => {
	block.symbols = SymbolTable.create();
	block.binders = [];

	const bindBlockScopedDeclarationsInternal = node => {
		if (bindBlockScopedDeclarationsFunctions.hasOwnProperty(node.kind)) {
			bindBlockScopedDeclarationsFunctions[node.kind](node, block);
		} else {
			ts.forEachChild(node, bindBlockScopedDeclarationsInternal);
		}
	};

	ts.forEachChild(block, bindBlockScopedDeclarationsInternal);
};

//-----------------------------------------------------------------------------

Binder.reset = () => {
	resetTotalAnonymousFunctions();
	resetTotalAnonymousClasses();
};

function resetTotalAnonymousFunctions() {
	Binder.totalAnonymousFunctions = 0;
}

function resetTotalAnonymousClasses() {
	Binder.totalAnonymousClasses = 0;
}

//-----------------------------------------------------------------------------

/**
 * import x ...
 * import {x, y as ...} ...
 * import x, {x, ...} ...
 * import * as x...
 * import ..., * as x
 *
 * @param {ts.ImportClause} node
 * @param {ts.Block} body
 */

bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ImportClause] = (
	node,
	body
) => {
	if (node.name && node.name.kind === ts.SyntaxKind.Identifier) {
		declareImportClause(node, body);
	}

	if (node.namedBindings) {
		switch (node.namedBindings.kind) {
			case ts.SyntaxKind.NamedImports: {
				node.namedBindings.elements.forEach(e => {
					declareImportSpecifier(e, body);
				});
				break;
			}
			case ts.SyntaxKind.NamespaceImport: {
				declareNamespaceImport(node.namedBindings, body);
				break;
			}
			default: {
				console.assert(false, '');
				break;
			}
		}
	}
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (
	node,
	body
) => {
	node.binders = [];
	if (Ast.isVarDeclaration(node.parent)) {
		declareFunctionScopedVariable(node, body);
	} else if (!isBoundByBindBlockScopedDeclarations(node, body)) {
		declareBlockScopedVariable(node, body);
	}
	return true;
};

/**
 * @param {ts.FunctionDeclaration} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.Constructor] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.MethodDeclaration] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.SetAccessor] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.GetAccessor] =
		(node, body) => {
			bindFunction(node, body);
		};

/**
 * @param {ts.ClassDeclaration} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ClassExpression] = (
		node,
		body
	) => {
		if (isBoundByBindBlockScopedDeclarations(node, body)) {
			return;
		}
		node.binders = [];
		bindClass(node, body);
	};

/**
 * @param {ts.Block} node
 * @param {ts.Block} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.Block] = (node, body) => {
	Binder.bindBlockScopedDeclarations(node);
	return true;
};

/**
 * @param {ts.Constructor} node
 * @param {ts.Node} body
 */
bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.PropertyDeclaration] = (
	node,
	body
) => {
	node.binders = [];
	declareBlockScopedVariable(node, body);
};

bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ForStatement] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ForOfStatement] =
	bindFunctionScopedDeclarationsFunctions[ts.SyntaxKind.ForInStatement] =
		(node, body) => {
			Binder.bindBlockScopedDeclarations(node);
			return true;
		};

//-----------------------------------------------------------------------------

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.VariableDeclaration] = (
	node,
	block
) => {
	node.binders = [];
	if (Ast.isVarDeclaration(node.parent)) {
		return;
	}
	declareBlockScopedVariable(node, block);
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassDeclaration] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ClassExpression] = (
		node,
		block
	) => {
		node.binders = [];
		bindClass(node, block);
	};

/**
 * @param {ts.Block} node
 * @param {ts.Block} block
 */
bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.Block] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionDeclaration] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.FunctionExpression] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ArrowFunction] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForStatement] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForOfStatement] =
	bindBlockScopedDeclarationsFunctions[ts.SyntaxKind.ForInStatement] =
		noOp;

//-----------------------------------------------------------------------------

function isBoundByBindBlockScopedDeclarations(node, body) {
	return (
		Ast.findAncestor(node, [
			ts.SyntaxKind.Block,
			ts.SyntaxKind.SourceFile,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ForInStatement,
			ts.SyntaxKind.ForOfStatement,
		]) !== body
	);
}

//-----------------------------------------------------------------------------

function bindFunction(node, body) {
	const name = findFunctionName(node);
	declareFunction(name, node, body);
	node._original = node;
	node.freeVariables = new Set();
	node.callSites = [];
	node.returnTypeCarriers = [];
	declareParameters(node);
	Binder.bindFunctionScopedDeclarations(node.body);
}

function findFunctionName(node) {
	switch (node.kind) {
		case ts.SyntaxKind.FunctionDeclaration:
		case ts.SyntaxKind.MethodDeclaration:
			return node.name.text;
		case ts.SyntaxKind.FunctionExpression:
			if (node.name) {
				return node.name.text;
			}
			break;
		case ts.SyntaxKind.ArrowFunction:
			break;
		case ts.SyntaxKind.Constructor:
			return `(constructor) ${findConstructorName(node)}`;
		case ts.SyntaxKind.SetAccessor:
			return `(set) ${node.name.text}`;
		case ts.SyntaxKind.GetAccessor:
			return `(get) ${node.name.text}`;
		default:
			console.assert(false);
	}

	return findAnonymousName(node, () => Binder.totalAnonymousFunctions++);
}

function bindClass(node, block) {
	const name = findClassName(node);
	declareClass(name, node, block);
	Binder.bindFunctionScopedDeclarations(node);
}

function findClassName(node) {
	if (node.name) {
		return node.name.text;
	} else {
		return findAnonymousName(node, () => Binder.totalAnonymousClasses++);
	}
}

function findConstructorName(node) {
	return node.parent.binders[0].symbol.name;
}

function findAnonymousName(node, incrementTotalAnonymous) {
	const parent = node.parent;
	if (isDeclarationInitializer(node)) {
		// let x = () => {};
		return `<${parent.name.text}> anonymous ${incrementTotalAnonymous()}`;
	} else if (isAssignmentRightValue(node)) {
		// x = () => {};
		return `<${parent.left.getText()}> anonymous ${incrementTotalAnonymous()}`;
	} else if (ts.isCallOrNewExpression(parent)) {
		return `<${parent.expression.getText()}(...)> anonymous ${incrementTotalAnonymous()} callback`;
	} else {
		return `<${incrementTotalAnonymous()}> anonymous`;
	}
}

function isDeclarationInitializer(node) {
	return (
		node.parent.kind === ts.SyntaxKind.VariableDeclaration &&
		node.parent.initializer === node
	);
}

function isAssignmentRightValue(node) {
	return (
		node.parent.kind === ts.SyntaxKind.BinaryExpression &&
		node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
		node.parent.right === node
	);
}

//-----------------------------------------------------------------------------

/**
 * import x, ...
 *
 * @param {ts.ImportClause} node
 * @param {ts.Block} block
 */
function declareImportClause(node, block) {
	const name = node.name.escapedText;
	const symbol = Symbol.create(name, node);

	block.symbols.insert(symbol);
	Ast.addTypeBinder(
		block,
		TypeBinder.create(
			symbol,
			TypeCarrier.createConstant(TypeInfo.createAny())
		)
	); // TODO: Fixme
}

/**
 * import {x, ...} ...
 * import {x, y as z} ...
 *
 * @param {ts.ImportSpecifier} node
 * @param {ts.Block} block
 */
function declareImportSpecifier(node, block) {
	const name = node.name.text;
	const symbol = Symbol.create(name, node);

	block.symbols.insert(symbol);
	Ast.addTypeBinder(
		block,
		TypeBinder.create(
			symbol,
			TypeCarrier.createConstant(TypeInfo.createAny())
		)
	); // TODO: Fixme
}

/**
 * import * as ...
 * import ..., * as ...
 *
 * @param {ts.NamespaceImport} node
 * @param {ts.Block} block
 */
function declareNamespaceImport(node, block) {
	const name = node.name.text;
	const symbol = Symbol.create(name, node);

	block.symbols.insert(symbol);
	Ast.addTypeBinder(
		block,
		TypeBinder.create(
			symbol,
			TypeCarrier.createConstant(TypeInfo.createAny())
		)
	); // TODO: Fixme
}

/**
 * @param {ts.FunctionDeclaration} node
 * @param {ts.Block} block
 */
function declareFunction(name, node, block) {
	const symbol = Symbol.create(name, node);

	block.symbols.insert(symbol);
	Ast.addTypeBinder(
		block,
		TypeBinder.create(
			symbol,
			TypeCarrier.createConstant(TypeInfo.createFunction(node))
		)
	);
}

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
function declareFunctionScopedVariable(node, block) {
	if (node.name.kind === ts.SyntaxKind.Identifier) {
		const name = node.name.text;
		const symbol = Symbol.create(name, node);

		block.symbols.insert(symbol);
		if (node.type) {
			const typeInfo = tsTypeToTypeInfo(node.type);
			const typeBinder = TypeBinder.create(
				symbol,
				TypeCarrier.createConstant([typeInfo])
			);
			Ast.addTypeBinder(block, typeBinder);
		} else {
			Ast.addTypeBinder(
				block,
				TypeBinder.create(
					symbol,
					TypeCarrier.createConstant(TypeInfo.createUndefined())
				)
			);
		}
	} else if (
		node.name.kind === ts.SyntaxKind.ArrayBindingPattern ||
		node.name.kind === ts.SyntaxKind.ObjectBindingPattern
	) {
		bindBindingPatternDeclarations(node.name, (node, name, start, end) => {
			const symbol = Symbol.create(name, node);
			Ast.addTypeBinder(
				block,
				TypeBinder.create(
					symbol,
					TypeCarrier.createConstant(TypeInfo.createUndefined())
				)
			);
			block.symbols.insert(symbol);
		});
	} else {
		console.assert(false);
	}
}

/**
 * @param {ts.ClassDeclaration} node
 * @param {ts.Block} block
 */
function declareClass(name, node, block) {
	const symbol = Symbol.create(name, node);

	block.symbols.insert(symbol);
	Ast.addTypeBinder(
		node,
		TypeBinder.create(
			symbol,
			TypeCarrier.createConstant(TypeInfo.createClass(node))
		)
	);
}

/**
 * @param {ts.VariableDeclaration} node
 * @param {ts.Block} block
 */
function declareBlockScopedVariable(node, block) {
	if (node.name.kind === ts.SyntaxKind.Identifier) {
		const name = node.name.text;
		// if(Ast.lookUp(node, name)) { return; } // TODO: lookUp only on current scope
		const symbol = Symbol.create(name, node);

		block.symbols.insert(symbol);
		if (node.type) {
			const typeInfo = tsTypeToTypeInfo(node.type);
			const typeBinder = TypeBinder.create(
				symbol,
				TypeCarrier.createConstant([typeInfo])
			);
			Ast.addTypeBinder(node, typeBinder);
		}
	} else if (
		node.name.kind === ts.SyntaxKind.ArrayBindingPattern ||
		node.name.kind === ts.SyntaxKind.ObjectBindingPattern
	) {
		bindBindingPatternDeclarations(node.name, (node, name, start, end) => {
			const symbol = Symbol.create(name, node);
			block.symbols.insert(symbol);
		});
	} else {
		console.assert(false);
	}
}

//-----------------------------------------------------------------------------

/**
 * @param {ts.ArrayBindingPattern | ts.ObjectBindingPattern} node
 * @param {(name: String, start: Number, end: Number) => void} declare
 */
function bindBindingPatternDeclarations(node, declareSymbol) {
	const bindBindingPatternDeclarationsInternal = node => {
		switch (node.kind) {
			case ts.SyntaxKind.BindingElement: {
				if (node.name.kind === ts.SyntaxKind.Identifier) {
					const name = node.name.text;
					const start = node.name.getStart();
					const end = node.name.end;
					declareSymbol(node, name, start, end);
				}

				ts.forEachChild(node, bindBindingPatternDeclarationsInternal);
				break;
			}
			case ts.SyntaxKind.FunctionExpression:
			case ts.SyntaxKind.ArrowFunction:
			case ts.SyntaxKind.ClassExpression: {
				break;
			}
			default: {
				ts.forEachChild(node, bindBindingPatternDeclarationsInternal);
				break;
			}
		}
	};

	ts.forEachChild(node, bindBindingPatternDeclarationsInternal);
}

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} func
 */
function declareParameters(func) {
	console.assert(func.parameters);

	for (const node of func.parameters) {
		node.binders = [];
		node.symbols = SymbolTable.create();
		if (node.name.kind === ts.SyntaxKind.Identifier) {
			const name = node.name.text;
			const symbol = Symbol.create(name, node);
			node.symbols.insert(symbol);
			if (node.type) {
				const typeInfo = tsTypeToTypeInfo(node.type);
				const typeCarrier = TypeCarrier.createConstant([typeInfo]);
				const typeBinder = TypeBinder.create(symbol, typeCarrier);
				typeCarrier.induced = true;
				Ast.addTypeBinder(node, typeBinder);
			}
		} else if (
			node.name.kind === ts.SyntaxKind.ArrayBindingPattern ||
			node.name.kind === ts.SyntaxKind.ObjectBindingPattern
		) {
			// visitDestructuringDeclerations(node.name, (name, start, end) => {
			//     const symbol = Symbol.create(name, start, end);
			//     Ast.addTypeBinder(node, TypeBinder.create(symbol, TypeInfo.createUndefined()));
			//     node.symbols.insert(symbol);
			// });
		} else {
			console.assert(false);
		}
	}
}

//-----------------------------------------------------------------------------

/**
 *
 * @param {ts.TypeNode} type
 */
function tsTypeToTypeInfo(type) {
	switch (type.kind) {
		case ts.SyntaxKind.NumberKeyword:
			return TypeInfo.createNumber();
		case ts.SyntaxKind.StringKeyword:
			return TypeInfo.createString();
		case ts.SyntaxKind.BooleanKeyword:
			return TypeInfo.createBoolean();
		case ts.SyntaxKind.ObjectKeyword:
			return TypeInfo.createObject();
		default:
			return TypeInfo.createAny();
	}
}

//-----------------------------------------------------------------------------

module.exports = Binder;
