const Signature = require('../utility/signature');
const Ast = require('../ast/ast');
const TypeCarrier = require('../utility/type-carrier');
const { getAst, findFocusedNode, getSymbolOfIdentifier } = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

const Hover = {};

// ----------------------------------------------------------------------------

const noInfo = { contents: [] };

// ----------------------------------------------------------------------------

Hover.onHover = info => {
	const ast = getAst(info);
	const node = findFocusedNode(ast, info.position);

	if (!node) {
		return noInfo;
	}

	switch (node.kind) {
		case ts.SyntaxKind.Constructor:
			return createConstructorInfo(ast, node);
		case ts.SyntaxKind.Identifier:
			return createIdentifierInfo(ast, node);
		default:
			return noInfo;
	}
};

// ----------------------------------------------------------------------------

function createConstructorInfo(ast, node) {
	const parentName = node.parent.name ? node.parent.name.getText(ast) : '';
	return {
		contents: {
			language: 'typescript',
			value: `${parentName} constructor`,
		},
	};
}

function createIdentifierInfo(ast, node) {
	const symbol = getSymbolOfIdentifier(node);

	if (!symbol || !symbol.binders.length) {
		return createAnyInfo(node);
	}

	const contents = [];
	const closestBinders = Ast.findActiveTypeBinders(node, symbol);

	for (const b of symbol.binders) {
		const isActive = closestBinders.indexOf(b) !== -1;
		const lineInfo = `at line ${getLine(ast, b)}`;
		const postfix = isActive ? '(up to here)' : '';
		const plausibleTypes = TypeCarrier.evaluate(b.carrier);
		const signature = Signature.compute(node, symbol, plausibleTypes);
		contents.push(createQuickInfo(`${signature} ${lineInfo} ${postfix}`));
	}

	return { contents };
}

// ----------------------------------------------------------------------------

function getLine(ast, binder) {
	return (
		ts.getLineAndCharacterOfPosition(ast, binder.parent.getStart(ast))
			.line + 1
	);
}

// ----------------------------------------------------------------------------

function createQuickInfo(info) {
	return {
		language: 'typescript',
		value: info,
	};
}

function createAnyInfo(node) {
	return {
		contents: createQuickInfo(node.text + ': any'),
	};
}

// ----------------------------------------------------------------------------

module.exports = Hover;
