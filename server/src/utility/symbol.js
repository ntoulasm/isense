const Symbol = {};

/**
 * @typedef isense.symbol
 * @property {string} name
 * @property {ts.Node} declaration
 */

/**
 * @param {string} name
 * @param {ts.Node} declaration
 *
 * @returns {isense.symbol}
 */
Symbol.create = (name, declaration) => {
	const symbol = {};

	symbol.name = name;
	symbol.declaration = declaration;
	symbol.binders = [];

	return symbol;
};

Symbol.isAnonymous = symbol => {
	const first = symbol.name[0];
	return first === '(' || first === '<';
};

module.exports = Symbol;
