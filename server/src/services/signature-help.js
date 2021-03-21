const Ast = require('../ast/ast');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const { getAst } = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');
const Analyzer = require('../analyzer/analyzer');
const { setMetadata } = require('../analyzer/call');

// ----------------------------------------------------------------------------

const SignatureHelp = {};

// ----------------------------------------------------------------------------

/**
 * 
 * @param {vscodeLanguageServer.SignatureHelpParams} info 
 */
SignatureHelp.onSignatureHelp = info => {

	const { position, context } = info;
	const ast = getAst(info);
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character) - 1;
	const call = Ast.findInnermostNode(ast, offset, ts.SyntaxKind.CallExpression);

	if(!call) { return ; }
	if(!call.expression.carrier) { Analyzer.analyze(ast); }
	let callees = TypeCarrier.evaluate(call.expression.carrier).filter(t => t.type === TypeInfo.Type.Function && t.value);
	if(!callees.length) { return ; }
	callees = callees.map(t => t.value);
	const activeParameter = computeActiveParameter(call, offset);
	const activeSignature = context.activeSignatureHelp ? context.activeSignatureHelp.activeSignature : 0;
	setMetadata(ast, call, callees[activeSignature]);
	const signatures = callees.map(callee => computeFunctionSignature(callee, call))

	return {
		activeParameter,
		activeSignature,
		signatures
	};

};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} callee
 */
const computeParametersSignature = (callee) => {
	// TODO: Adjust for destructuring pattern
	const computeParameterSignature = p => {
		const parameterName = p.name.getText();
		const symbol = Ast.lookUp(
			Ast.findLastParameter(callee),
			parameterName
		);
		
		// We need to filter similar types because on call new carriers for the parameter will be added.
		// TODO: Should i change this?
		const inducedBinders = symbol && symbol.binders.filter(b => b.carrier.induced);
		let inducedTypeInfos = [];
		inducedBinders.forEach(b => inducedTypeInfos.push(...TypeCarrier.evaluate(b.carrier)));

		let signature = parameterName;
		let firstTime = true;

		for(const type of inducedTypeInfos) {
			if(firstTime) { 
				signature += ':';
				firstTime = false; 
			} else { 
				signature += ' ||' 
			}
			signature += ` ${TypeInfo.typeToString(type)}`;
		}

		return signature;
	}

	return callee.parameters.map(computeParameterSignature);

};

/**
 * @param {ts.Node} callee
 * @param {ts.Node} call 
 */
const computeFunctionSignature = (callee, call) => {
	let signature = '';
	if(callee.name !== undefined) {
		signature += callee.name.getText();
	} else {
		// TODO: check if this is fine
		// refinement: it probably is 
		//		eg: x()() -> x()()
		signature += call.expression.getText();
	}
	const parametersSignature = computeParametersSignature(callee);
	signature += `(${parametersSignature.join(', ')})`;
	return {
		documentation: computeDocumentation(callee),
		label: signature,
		parameters: parametersSignature.map(p => vscodeLanguageServer.ParameterInformation.create(p, /* parameter documentation */))
	};
};

// ----------------------------------------------------------------------------

function computeDocumentation(node) {
	/**
	 * @type {ts.Statement}
	 */
	const closestStatement = Ast.findStatementAncestor(node);
	return closestStatement.jsDoc ? computeJSDocDocumentation(closestStatement) : '';
}

/**
 * @param {ts.Statement} node
 */
function computeJSDocDocumentation(node) {
	const jsDoc = node.jsDoc[node.jsDoc.length - 1];
	return jsDoc.getText().replace(/  +/g, ' ');
}

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} call 
 * @param {Number} offset 
 */
const computeActiveParameter = (call, offset) => {

	const callChildren = call.getChildren();
	const leftParenthesisToken = callChildren[1];
	const leftParenthesisOffset = leftParenthesisToken.end - 1;
	const cursorOffset = offset - leftParenthesisOffset;
	const ast = call.getSourceFile();
	const argumentsText = ast.getFullText().substring(leftParenthesisOffset, call.end);
	const parenthesizedExpression = ts.createSourceFile('', argumentsText);
	let activeParameter = 0;

	const countCommas = (node) => {
		if(node.kind === ts.SyntaxKind.BinaryExpression && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
			countCommas(node.left);
			if(node.operatorToken.end - 1 <= cursorOffset) {
				activeParameter++;
			}
		} 
	};
	countCommas(parenthesizedExpression.statements[0].expression.expression);

	return activeParameter;

};

// ----------------------------------------------------------------------------

module.exports = SignatureHelp;