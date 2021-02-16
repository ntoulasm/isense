const Ast = require('../ast/ast');
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

	switch(node.kind) {
		case ts.SyntaxKind.Identifier: {
			const symbol = node.carrier.symbol;
			const range = createRange(symbol);
			const uri = node.getSourceFile().fileName;
			const location = vscodeLanguageServer.Location.create(uri, range);
			return location;
		}
		default: return null;
	}

};

// ----------------------------------------------------------------------------

module.exports = Definition;