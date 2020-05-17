const Ast = require('../ast/ast');
const TypeInfo = require('../utility/type-info');
const TypeBinder = require('./type-binder');

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
			return type.hasOwnProperty('constructorName') ? type.constructorName : 'Object';
		}
		default: {
			return Object.keys(TypeBinder.Type)[type.type];
		}
	}

}

me.computeSignature = function computeSignature(node, binder, typeSeparator = ' || ', computeValues = true) {

	const symbol = binder.symbol;
	let firstTime = true;
	let signature = symbol.isConst ? 'const ' : '';

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
					if(comma) { value += ',\n'; }
					comma = true;
					value += me.computeSpaces();
					value += computeSignature(node, Ast.findClosestTypeBinder(node, property));
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

	for(const type of binder.carrier.info) {
		if(firstTime) { 
			const name = symbol.name[0] == "@" ? symbol.name.split('.')[1] : symbol.name;
			signature += `${name}: `;
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