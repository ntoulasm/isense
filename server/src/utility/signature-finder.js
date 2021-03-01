const Ast = require('../ast/ast');
const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const TypeBinder = require('./type-binder');
const ts = require('typescript');

const me = {};

let objectNesting = 0;
me.computeSpaces = () => {
    let spaces = "";
    for(let i = 0; i < objectNesting; ++i) {
        spaces += "    ";
    }
    return spaces;
};

me.typeToString = type => {
	switch(type.type) {
		case TypeInfo.Type.Object: {
			return type.constructorName || 'Object';
		}
		default: {
			return Object.keys(TypeBinder.Type)[type.type];
		}
	}

}

function isConstant(symbol) {
	const declaration = symbol.declaration;
	return declaration && declaration.kind === ts.SyntaxKind.VariableDeclaration && Ast.isConstDeclaration(declaration.parent);
}

me.computeSignature = function computeSignature(node, symbol, typeInfo, typeSeparator = ' || ', computeValues = true) {

	let firstTime = true;
	let signature = isConstant(symbol) ? 'const ' : '';

	function computeSignatureValue(type) {

		switch(type.type) {
			case TypeInfo.Type.Number:
			case TypeInfo.Type.Boolean: {
				return type.hasValue ? ` = ${String(type.value)}` : '';
			}
			case TypeInfo.Type.String: {
				return type.hasValue ? ` = '${String(type.value)}'` : '';
			}
			case TypeInfo.Type.Array: {
				// TODO: 
				return '';
			}
			case TypeInfo.Type.Object: {

				if(!type.hasValue) { return ''; }
				if(type.properties.getSymbols().length === 0) { return ''; }

				++objectNesting;
				let comma = false;
				let value = ` = {\n`;

				for(const [,property] of Object.entries(type.properties.getSymbols())) {
					
					// If binders are empty the property is not declared yet.
					const binders = Ast.findActiveTypeBindersInLeftSibling(Ast.AdjustObjectPropertyStartingSearchNode(node), property);
					if(!binders.length) { continue; }

					if(comma) { value += ',\n'; }
					comma = true;
					
					for(const b of binders) {
						value += me.computeSpaces();
						value += computeSignature(node, property, TypeCarrier.evaluate(b.carrier));
					}

				}
	
				--objectNesting;
				value += `\n${me.computeSpaces()}}`;
				return value;

			}
			case TypeInfo.Type.Function:
			case TypeInfo.Type.Class: {
				return type.value ? ` = ${type.value.getText()}` : '';
			}
			case TypeInfo.Type.Null:
			case TypeInfo.Type.Undefined: 
			case TypeInfo.Type.Any: {
				return '';
			}
			default: {
				console.assert(false);
			}
		}
	}

	for(const type of typeInfo) {
		if(firstTime) { 
			signature += `${symbol.name}: `;
			firstTime = false;
		} else {
			signature += typeSeparator;
		}
		signature += `${TypeInfo.typeToString(type)}`;
		computeValues && (signature += computeSignatureValue(type));
	}
	
    return signature;
}

module.exports = me;