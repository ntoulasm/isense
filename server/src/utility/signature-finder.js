const Ast = require('../ast/ast');
const TypeCarrier = require('./type_carrier');

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

	switch(type.id) {
		case TypeCarrier.Type.Object: {
			return type.hasOwnProperty('constructorName') ? type.constructorName : 'Object';
		}
		default: {
			return Object.keys(TypeCarrier.Type)[type.id];
		}
	}

}

me.computeSignature = function computeSignature(node, typeCarrier, typeSeparator = ' || ', computeValues = true) {

	const symbol = typeCarrier.getSymbol();
	let firstTime = true;
	let signature = symbol.isConst ? 'const ' : '';

	function computeSignatureValue(type) {

		switch(type.id) {
			case TypeCarrier.Type.Number:
			case TypeCarrier.Type.Boolean: {
				return type.hasOwnProperty("value") ? ` = ${String(type.value)}` : '';
			}
			case TypeCarrier.Type.String: {
				return type.hasOwnProperty("value") ? ` = '${String(type.value)}'` : '';
			}
			case TypeCarrier.Type.Array: {
				// TODO: 
				return '';
			}
			case TypeCarrier.Type.Object: {

				if(!type.hasOwnProperty('value')) { return ''; }
				if(type.properties.getSymbols().length === 0) { return ''; }

				++objectNesting;
				let comma = false;
				let value = ` = {\n`;

				for(const [,property] of Object.entries(type.properties.getSymbols())) {
					if(comma) { value += ',\n'; }
					comma = true;
					value += me.computeSpaces();
					value += computeSignature(node, Ast.findClosestTypeCarrier(node, property));
				}
	
				--objectNesting;
				value += `\n${me.computeSpaces()}}`;
				return value;

			}
			case TypeCarrier.Type.Function:
			case TypeCarrier.Type.Class: {
				return type.node ? '' : ` = ${type.node.text}`;
			}
			case TypeCarrier.Type.Null:
			case TypeCarrier.Type.Undefined: 
			case TypeCarrier.Type.Any: {
				return '';
			}
			default: {
				console.assert(false);
			}
		}
	}

	for(const type of typeCarrier.getTypes()) {
		if(firstTime) { 
			const name = symbol.name[0] == "@" ? symbol.name.split('.')[1] : symbol.name;
			signature += `${name}: `;
			firstTime = false;
		} else {
			signature += typeSeparator;
		}
        signature += `${TypeCarrier.typeToString(type)}`;
		computeValues && (signature += computeSignatureValue(type));
	}

    return signature;
}

module.exports = me;