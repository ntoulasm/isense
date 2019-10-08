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
Symbol.createSymbol = function(name, start, end, isConst = false, visibleOffset = start) {
    return {
        name,
        start,
        end,
        isConst,
        visibleOffset
    };
};

module.exports = Symbol;