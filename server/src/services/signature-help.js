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
	const call = Ast.findInnerMostNode(ast, offset, ts.isCallLikeExpression);

	if(!call) { return ; }
	if(!call.expression.carrier) { Analyzer.analyze(ast); }
	let callees = call.plausibleCallees;
	const activeParameter = computeActiveParameter(call, offset);
	if(activeParameter === null) { return ; }
	const activeSignature = context.activeSignatureHelp ? context.activeSignatureHelp.activeSignature : 0;
	if(callees.length > 1) {
		setMetadata(ast, call, callees[activeSignature]);
	}
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

		const inducedBinders = symbol && symbol.binders.filter(b => b.carrier.induced);
		const inducedTypeInfos = TypeCarrier.removeDuplicates(
			inducedBinders.flatMap(b => TypeCarrier.evaluate(b.carrier))
		);

		let signature = `${parameterName}: `;

		if(!inducedTypeInfos.length) { return signature + 'any'; }
		
		signature += inducedTypeInfos
		.map(t => TypeInfo.typeToString(t))
		.join(' || ');

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
		signature += call.expression.getText();
	}
	const parametersSignature = computeParametersSignature(callee);
	signature += `(${parametersSignature.join(', ')})`;
	signature += `: ${computeReturnInfo(callee, call)}`;
	return {
		documentation: computeDocumentation(callee),
		label: signature,
		parameters: parametersSignature.map(p => vscodeLanguageServer.ParameterInformation.create(p, /* parameter documentation */))
	};
};

function computeReturnInfo(callee, call) {
	if(call.kind === ts.SyntaxKind.NewExpression) {
		return computeNewExpressionReturnInfo(callee);	
	}
	const typeInfo = callee.returnTypeCarriers
		.flatMap(c => TypeCarrier.evaluate(c));
	if(!typeInfo.length) { return [ 'any' ]; }
	return TypeCarrier.removeDuplicates(typeInfo)
		.map(t => TypeInfo.typeToString(t))
		.join(' || ');
}

function computeNewExpressionReturnInfo(callee) {
	if(callee.kind === ts.SyntaxKind.Constructor && callee.parent.name) {
		return callee.parent.name.escapedText;
	} else if(callee.name) {
		return callee.name.escapedText;
	}
	return 'object';
}

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
	const leftParenthesisToken = callChildren.find(c => c.kind === ts.SyntaxKind.OpenParenToken);
	if(!leftParenthesisToken) { return null; }
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