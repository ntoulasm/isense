const Analyzer = require('../analyzer/analyzer');
const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const Signature = require('../utility/signature');
const {
	getAst,
	getCompletionItemKind,
	getPropertySymbols,
	findFocusedNode,
} = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Completion = {};

// ----------------------------------------------------------------------------

Completion.onCompletion = info => {
	const ast = getAst(info);
	const node = findFocusedNode(ast, info.position);
	const triggerCharacter = info.context.triggerCharacter;

	if (!node || Ast.isDeclarationName(node)) {
		return;
	}

	if (triggerCharacter === '.') {
		Analyzer.analyze(ast); // TODO: Do not analyze here
		let propertyAccess = node;
		if (node.kind === ts.SyntaxKind.Identifier) {
			propertyAccess = node.parent;
		} else if (node.kind !== ts.SyntaxKind.PropertyAccessExpression) {
			return;
		}
		return computePropertyCompletions(propertyAccess);
	} else if (Ast.isNameOfPropertyAccessExpression(node)) {
		return computePropertyCompletions(node.parent);
	} else {
		return computeIdentifierCompletions(node);
	}
};

// ----------------------------------------------------------------------------

Completion.onCompletionResolve = item => {
	item.detail = item.data && item.data.signature;
	return item;
};

// ----------------------------------------------------------------------------

function computeIdentifierCompletions(node) {
	const completions = [];
	Ast.findVisibleSymbols(node).forEach(symbol => {
		if (Symbol.isAnonymous(symbol)) {
			return;
		}
		if (completions.find(c => c.label === symbol.name)) {
			return;
		}
		const binders = Ast.findActiveTypeBinders(node, symbol);
		if (!binders.length) {
			completions.push({
				label: symbol.name,
				kind: vscodeLanguageServer.CompletionItemKind.Variable,
				signature: `${symbol.name}: any`,
			});
			return;
		}
		completions.push(computeCompletion(node, symbol, binders));
	});
	return completions;
}

function computePropertyCompletions(node) {
	const completionItems = [];
	const propertySymbols = getPropertySymbols(node);

	// Old code for completion of number properties
	// 	if(type.type === TypeInfo.Type.Number) {
	// 		for(const m of NumberMethods) {
	// 			completionItems.push({
	// 				label: m.name,
	// 				kind: vscodeLanguageServer.CompletionItemKind.Variable
	// 			});
	// 		}
	// 	}

	for (const property of propertySymbols) {
		const propertyBinders = Ast.findActiveTypeBindersInLeftSibling(
			node,
			property
		);
		if (!propertyBinders.length) {
			continue;
		}
		completionItems.push(
			computeCompletion(node, property, propertyBinders)
		);
	}

	return completionItems;
}

function computeCompletion(node, symbol, binders) {
	const plausibleTypes = binders
		.sort(compareBinders)
		.flatMap(b => TypeCarrier.evaluate(b.carrier));
	const kind = TypeInfo.hasUniqueType(plausibleTypes)
		? getCompletionItemKind(plausibleTypes[0].type)
		: vscodeLanguageServer.CompletionItemKind.Variable;
	const signature = Signature.compute(node, symbol, plausibleTypes);
	return {
		label: symbol.name,
		kind,
		data: { signature },
	};
}

// ----------------------------------------------------------------------------

function compareBinders(b1, b2) {
	return b1.parent.end - b2.parent.end;
}

// ----------------------------------------------------------------------------

module.exports = Completion;
