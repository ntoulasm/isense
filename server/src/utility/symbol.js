const Symbol = {};

/**
 * @typedef isense.symbol
 * @property {string} name
 * @property {number} start
 * @property {number} end
 * @property {boolean} isConst
 * @property {boolean} visibleOffset
 */

/**
 * @param {string} name
 * @param {number} start
 * @param {number} end
 * @param {boolean} [isConst = false]
 * @param {boolean} [visibleOffset = start]
 * 
 * @returns {isense.symbol}
 */
Symbol.create = function(name, start, end, isConst = false, visibleOffset = start) {
    return {
        name,
        start,
        end,
        isConst,
        visibleOffset,
        binders: []
    };
};

Symbol.createDeclaration = function(name, declaration, isConst = false, visibleOffset = null) {

    const start = declaration.getStart();
    const end = declaration.end;

    const symbol = Symbol.create(name, start, end, isConst, visibleOffset !== null ? visibleOffset : start);
    symbol.declaration = declaration;

    return symbol;

};

module.exports = Symbol;