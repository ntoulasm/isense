const SignatureFinder = require('../utility/signature-finder');
const Ast = require('../ast/ast');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

const Hover = {};

// ----------------------------------------------------------------------------

Hover.onHover = info => {

	const document = info.textDocument;
	const fileName = document.uri;
	const ast = Ast.asts[fileName];
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
			if(node.parent.kind === ts.SyntaxKind.PropertyAccessExpression && node.parent.name === node) {
				return { 
					contents: {
						language: 'typescript',
						value: `property ${node.text}`
					}
				};
			}
			const symbol = Ast.lookUp(node, node.text);
			if(symbol === undefined) { 
				return { 
					contents: {
						language: 'typescript',
						value: node.text + ': any'
					} 
				}; 
			}
			const contents = [];
			if(!symbol.binders.length) {
				return {
					contents: {
						language: 'typescript',
						value: node.text + ': any'
					}
				};
			}
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
		default: {
			return { contents: [] };
		}
	}
	
};

// ----------------------------------------------------------------------------

module.exports = Hover;