const Ast = require('../ast/ast');
const TypeInfo = require('./type-info');
const TypeCarrier = require('./type-carrier');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

const Signature = {};

// ----------------------------------------------------------------------------

let objectNesting = 0;
const seen = new WeakSet();

// ----------------------------------------------------------------------------

Signature.compute = (node, symbol, typeInfo, typeSeparator = ' || ', computeValues = true) => {

	let firstTime = true;
	let signature = isConstant(symbol) ? 'const ' : '';

	for(const t of typeInfo) {
		if(firstTime) { 
			signature += `${symbol.name}: `;
			firstTime = false;
		} else {
			signature += typeSeparator;
		}
		signature += `${TypeInfo.typeToString(t)}`;
		if(computeValues && t.hasValue) {
			signature += (' = ' + stringifyValue(node, t));
		}

	}
	
    return signature;
	
}

// ----------------------------------------------------------------------------

function stringifyValue(node, typeInfo) {
	switch(typeInfo.type) {
		case TypeInfo.Type.Number:
		case TypeInfo.Type.Boolean:
			return String(typeInfo.value);
		case TypeInfo.Type.String:
			return String(typeInfo.value);
		case TypeInfo.Type.Array:
			// TODO: 
			return '';
		case TypeInfo.Type.Object:
			return stringifyObject(node, typeInfo);
		case TypeInfo.Type.Function:
		case TypeInfo.Type.Class:
			return typeInfo.value.getText();
		case TypeInfo.Type.Null:
		case TypeInfo.Type.Undefined: 
		case TypeInfo.Type.Any:
			return '';
		default: console.assert(false);
	}
}

// ----------------------------------------------------------------------------

function stringifyObject(node, typeInfo) {

	if(seen.has(typeInfo)) { return '[Circural Reference]'; }
	else { seen.add(typeInfo); }

	if(typeInfo.properties.getSymbols().length === 0) { return ''; }

	++objectNesting;
	let comma = false;
	let text = `{\n`;

	for(const [,property] of Object.entries(typeInfo.properties.getSymbols())) {
		
		// If binders are empty the property is not declared yet.
		const binders = Ast.findActiveTypeBindersInLeftSibling(
			Ast.AdjustObjectPropertyStartingSearchNode(node), 
			property
		);
		if(!binders.length) { continue; }

		if(comma) { text += ',\n'; }
		comma = true;
		
		for(const b of binders) {
			text += computeSpaces();
			text += Signature.compute(node, property, TypeCarrier.evaluate(b.carrier));
		}

	}

	--objectNesting;
	text += `\n${computeSpaces()}}`;
	seen.delete(typeInfo);
	
	return text;

}

// ----------------------------------------------------------------------------

function isConstant(symbol) {
	const declaration = symbol.declaration;
	return declaration &&
		declaration.kind === ts.SyntaxKind.VariableDeclaration &&
		Ast.isConstDeclaration(declaration.parent);
}

// ----------------------------------------------------------------------------

function computeSpaces() {
    let spaces = '';
    for(let i = 0; i < objectNesting; ++i) {
        spaces += '  ';
    }
    return spaces;
};

// ----------------------------------------------------------------------------

module.exports = Signature;