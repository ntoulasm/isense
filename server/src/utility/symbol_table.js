const SymbolTable = {};

SymbolTable.create = function() {

	const symbolTable = {};

	const symbols = {};

    /**
     * @param {isense.Symbol} symbol
     */
    symbolTable.insert = function(symbol) {
        const name = symbol.name;
        symbols[name] = symbol;
    };

    /**
     * @param {string} name
     * 
     * @returns {isense.symbol}
     */
    symbolTable.lookUp = function(name) {
        if(symbols.hasOwnProperty(name)) {
            return symbols[name];
        } else {
            return undefined;
        }
    };

    /**
     * @returns {array<isense.symbol>}
     */
    symbolTable.getSymbols = function() {
        return symbols;
    };

    /**
     * @returns {void}
     */
    symbolTable.print = function() {
        console.log(symbolTable.getSymbols());
    };

	return symbolTable;

};

module.exports = SymbolTable;