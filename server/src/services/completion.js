const Analyzer = require('../analyzer/analyzer');
const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const TypeCarrier = require('../utility/type-carrier');
const SignatureFinder = require('../utility/signature-finder');
const { getAst, getCompletionItemKind, getPropertySymbols } = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Completion = {};

// ----------------------------------------------------------------------------

Completion.onCompletion = info => {

	const ast = getAst(info);
	const position = info.position;
	const offset = ast.getPositionOfLineAndCharacter(position.line, position.character);
	const completionItems = [];
	const triggerCharacter = info.context.triggerCharacter;

	if(triggerCharacter === '.') {

		Analyzer.analyze(ast);
		const node = Ast.findInnermostNode(ast, offset - 1, ts.SyntaxKind.PropertyAccessExpression);
		if(!node) { return ; }
		completionItems.push(...computePropertyCompletions(node));

	} else {
		const node = Ast.findInnermostNodeOfAnyKind(ast, offset);
		switch(node.kind) {
			case ts.SyntaxKind.Identifier: {
				if(Ast.isDeclarationName(node)) { return ; }
				if(node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
					completionItems.push(...computePropertyCompletions(node.parent));
				} else {
					Ast.findVisibleSymbols(node)
					.forEach(symbol => {
						if(Symbol.isAnonymous(symbol)) { return; }
						if(completionItems.find(c => c.label === symbol.name)) { return; }
						const binders = Ast.findActiveTypeBinders(node, symbol);
						if(!binders.length) { 
							completionItems.push({
								label: symbol.name,
								kind: vscodeLanguageServer.CompletionItemKind.Variable,
								signature: `${symbol.name}: any`
							});
							return ;
						}
						const typeInfo = [];
						for(const b of binders) {
							typeInfo.push(...TypeCarrier.evaluate(b.carrier));
						}
						const kind = typeInfo.length === 0 ?
							getCompletionItemKind(typeInfo[0].type) : 
							vscodeLanguageServer.CompletionItemKind.Variable;
						const signature = SignatureFinder.computeSignature(node, binders);
						completionItems.push({
							label: symbol.name, 
							kind,
							data: { signature }
						});
					});
				}
			}
		}
	}

	return completionItems;

};

// ----------------------------------------------------------------------------

Completion.onCompletionResolve = item => {
	item.detail = item.data && item.data.signature;
	return item;
};

// ----------------------------------------------------------------------------

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
	
	for(const property of propertySymbols) {
		const propertyName = property.name;
		const propertyBinders = Ast.findActiveTypeBinders(node, property);
		if(!propertyBinders.length) { continue; }
		const typeInfo = [];
		for(const b of propertyBinders) {
			typeInfo.push(...TypeCarrier.evaluate(b.carrier));
		}
		const kind = typeInfo.length === 1 ?
			getCompletionItemKind(typeInfo[0].type) :
			vscodeLanguageServer.CompletionItemKind.Variable;
		const signature = SignatureFinder.computeSignature(node, propertyBinders);
		completionItems.push({
			label: propertyName,
			kind,
			data: { signature }
		});
	}

	return completionItems;

}

// ----------------------------------------------------------------------------

module.exports = Completion;