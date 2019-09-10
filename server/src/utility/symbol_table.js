const SymbolTable = {};

SymbolTable.createSymbolTable = function() {

	const symbolTable = {};

	const symbols = {};

    symbolTable.insert = function(name, symbol) {
        symbols[name] = symbol;
    };

    /**
     * @param {string} name
     */
    symbolTable.lookUp = function(name) {
        if(symbols.hasOwnProperty(name)) {
            return symbols[name];
        } else {
            return undefined;
        }
    };

    symbolTable.getSymbols = function() {
        return symbols;
    };

    symbolTable.print = function() {
        console.log(symbolTable.getSymbols());
    };

	return symbolTable;

};

module.exports = SymbolTable;