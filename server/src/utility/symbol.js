const Symbol = {};

/**
 * @typedef isense.symbol
 * @property {string} name
 * @property {number} start
 * @property {number} end
 * @property {boolean} isConst
 * @property {boolean} isInitialized
 */

/**
 * @param {string} name
 * @param {number} start
 * @param {number} end
 * @param {boolean} [isConst = false]
 * @param {boolean} [isInitialized = false]
 * 
 * @returns {isense.symbol}
 */
Symbol.createSymbol = function(name, start, end, isConst = false, isInitialized = true) {
    return {
        name,
        start,
        end,
        isConst,
        isInitialized,
        typeCarriers: []
    };
};

module.exports = Symbol;