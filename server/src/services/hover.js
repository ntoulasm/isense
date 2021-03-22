const Signature= require('../utility/signature');
const Ast = require('../ast/ast');
const TypeCarrier = require('../utility/type-carrier');
const { 
	getAst, 
	findFocusedNode, 
	getSymbolOfIdentifier 
} = require('./utility');

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

	if(!node) { return noInfo; }
	
	switch(node.kind) {
		case ts.SyntaxKind.Constructor:
			return createConstructorInfo(ast, node);
		case ts.SyntaxKind.Identifier:
			return createIdentifierInfo(ast, node);
		default: return noInfo;
	}
	
};

// ----------------------------------------------------------------------------

function createConstructorInfo(ast, node) {
	const parentName = node.parent.name ? node.parent.name.getText(ast) : '';
	return {
		contents: {
			language: "typescript",
			value: `${parentName} constructor`
		}
	};
}

function createIdentifierInfo(ast, node) {

	const symbol = getSymbolOfIdentifier(node);
	
	if(!symbol || !symbol.binders.length) { 
		return createAnyInfo(node);
	}

	const contents = [];
	const closestBinders = Ast.findActiveTypeBinders(node, symbol);

	for(const b of symbol.binders) {
		const line = ts.getLineAndCharacterOfPosition(ast, b.parent.getStart(ast)).line + 1;
		const isActive = closestBinders.indexOf(b) !== -1;
		const binderLineInfo = `at line ${line}`;
		const postfix = isActive ? '(up to here)' : '';
		const plausibleTypes = TypeCarrier.evaluate(b.carrier);
		contents.push({
			language: 'typescript',
			value: `${Signature.compute(node, symbol, plausibleTypes)} ${binderLineInfo} ${postfix}`
		});
	}

	return { contents };

}

// ----------------------------------------------------------------------------

function createAnyInfo(node) {
	return { 
		contents: {
			language: 'typescript',
			value: node.text + ': any'
		}
	} 
}

// ----------------------------------------------------------------------------

module.exports = Hover;