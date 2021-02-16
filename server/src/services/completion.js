const Analyzer = require('../analyzer/analyzer');
const Ast = require('../ast/ast');
const Symbol = require('../utility/symbol');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const NumberMethods = require('../primitive-type-info/number-methods');
const SignatureFinder = require('../utility/signature-finder');
const { getAst, getCompletionItemKind } = require('./utility');

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
		const expressionCarrier = node.expression.carrier;

		for(const type of TypeCarrier.evaluate(expressionCarrier)) {
			if(type.type === TypeInfo.Type.Number) {
				for(const m of NumberMethods) {
					completionItems.push({
						label: m.name,
						kind: vscodeLanguageServer.CompletionItemKind.Variable
					});
				}
			}
			if(type.type === TypeInfo.Type.Object && type.hasValue) {
				for(const [,property] of Object.entries(type.properties.getSymbols())) {
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
						data: {signature}
					});
				}
			}
		}

	} else {
		const node = Ast.findInnermostNodeOfAnyKind(ast, offset);
		switch(node.kind) {
			case ts.SyntaxKind.Identifier: {
				if(Ast.isDeclarationName(node)) { return ; }
				if(node.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {

					const expressionTypes = TypeCarrier.evaluate(node.parent.expression.carrier);

					for(const type of expressionTypes) {
						if(type.type === TypeInfo.Type.Object && type.hasValue) {
							for(const [,property] of Object.entries(type.properties.getSymbols())) {
								const propertyName = property.name;
								const propertyBinders = Ast.findActiveTypeBinders(node, property);
								if(!propertyBinders.length) { continue; }
								const typeInfo = [];
								for(const b of propertyBinders) {
									typeInfo.push(...TypeCarrier.evaluate(b.carrier));
								}
								const kind = typeInfo.length === 0 ?
									getCompletionItemKind(typeInfo[0].type) :
									vscodeLanguageServer.CompletionItemKind.Variable;
								const signature = SignatureFinder.computeSignature(node, propertyBinders);
								completionItems.push({
									label: propertyName,
									kind,
									data: {signature}
								});
							}
						}
					}				
					
				} else {
					Ast.findVisibleSymbols(node)
					.forEach(symbol => {
						if(Symbol.isAnonymous(symbol)) { return; }
						if(completionItems.find(c => c.label === symbol.name)) { return; }
						const binders = Ast.findActiveTypeBinders(node, symbol);
						if(!binders.length) { return ; }
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

module.exports = Completion;