const SignatureFinder = require('../utility/signature-finder');
const Ast = require('../ast/ast');
const { getAst, getPropertySymbols } = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

const Hover = {};

// ----------------------------------------------------------------------------

Hover.onHover = info => {

	const ast = getAst(info);
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	const node = Ast.findInnermostNodeOfAnyKind(ast, offset);

	if(node === undefined) { return { contents: [] }; }
	
	switch(node.kind) {
		case ts.SyntaxKind.Constructor: {
			const parentName = node.parent.name ? node.parent.name.getText() : '';
			return {
				contents: {
					language: "typescript",
					value: `${parentName} constructor`
				}
			};
		}
		case ts.SyntaxKind.Identifier: {
			const symbol = getSymbolOfIdentifier(node);
			if(symbol === undefined || !symbol.binders.length) { 
				return { 
					contents: {
						language: 'typescript',
						value: node.text + ': any'
					} 
				}; 
			}
			const contents = [];
			const closestBinders = Ast.findActiveTypeBinders(node, symbol);
			for(const b of symbol.binders) {
				const line = ts.getLineAndCharacterOfPosition(ast, b.parent.getStart()).line + 1;
				const isActive = closestBinders.indexOf(b) !== -1;
				const binderLineInfo = `at line ${line}`;
				const postfix = isActive ? '(up to here)' : '';
				contents.push({
					language: 'typescript',
					value: `${SignatureFinder.computeSignature(node, [b])} ${binderLineInfo} ${postfix}`
				});
			}
			return { contents };
		}
		default:
			return { contents: [] };
	}
	
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Identifier} node 
 */
function getSymbolOfIdentifier(node) {
	if(Ast.isNameOfPropertyAccessExpression(node)) {
		const propertyName = node.getText();
		const properties = getPropertySymbols(node.parent);
		return properties.find(p => p.name === propertyName);
	} else {
		return Ast.lookUp(node, node.text);
	}
}

// ----------------------------------------------------------------------------

module.exports = Hover;