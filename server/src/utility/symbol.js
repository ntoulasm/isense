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

module.exports = Symbol;