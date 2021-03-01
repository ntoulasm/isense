const SignatureFinder = require('../utility/signature-finder');
const Ast = require('../ast/ast');
const TypeCarrier = require('../utility/type-carrier');
const { getAst, getSymbolOfIdentifier } = require('./utility');

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
				const plausibleTypes = TypeCarrier.evaluate(b.carrier);
				contents.push({
					language: 'typescript',
					value: `${SignatureFinder.computeSignature(node, symbol, plausibleTypes)} ${binderLineInfo} ${postfix}`
				});
			}
			return { contents };
		}
		default:
			return { contents: [] };
	}
	
};

// ----------------------------------------------------------------------------

module.exports = Hover;