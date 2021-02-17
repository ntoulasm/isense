const Ast = require('../ast/ast');
const { getAst, createRange, getPropertySymbols } = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Definition = {};

// ----------------------------------------------------------------------------

/**
 * 
 * @param {vscodeLanguageServer.DefinitionParams} info 
 */
Definition.onDefinition = info => {

	const ast = getAst(info);
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	/**
	 * @type {ts.Node}
	 */
	const node = Ast.findInnermostNodeOfAnyKind(ast, offset);

	if(!node) { return null; }

	switch(node.kind) {
		case ts.SyntaxKind.Identifier: {
			let symbol;
			if(Ast.isNameOfPropertyAccessExpression(node)) {
				const propertyAccessExpression = node.parent;
				const properties = getPropertySymbols(propertyAccessExpression);
				const propertyName = propertyAccessExpression.name.escapedText;
				symbol = properties.find(s => s.name === propertyName);
			} else {
				symbol = node.carrier.symbol;
			}
			if(!symbol) { return ; }
			const range = createRange(symbol);
			const uri = symbol.declaration.getSourceFile().fileName;
			const location = vscodeLanguageServer.Location.create(uri, range);
			return location;
		}
		default: return null;
	}

};

// ----------------------------------------------------------------------------

module.exports = Definition;