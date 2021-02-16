const Ast = require('../ast/ast');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const { getAst, createRange } = require('./utility');

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
			const uri = node.getSourceFile().fileName;
			const location = vscodeLanguageServer.Location.create(uri, range);
			return location;
		}
		default: return null;
	}

};

/**
 * @param {ts.PropertyAccessExpression} node 
 */
function getPropertySymbols(node) {
	const properties = [];
	const objectTypeInfo = TypeCarrier.evaluate(node.expression.carrier);
	for(const typeInfo of objectTypeInfo) {
		if(typeInfo.type === TypeInfo.Type.Object) {
			properties.push(...Object.values(typeInfo.properties.getSymbols()));
		}
	}
	return properties;
}

// ----------------------------------------------------------------------------

module.exports = Definition;