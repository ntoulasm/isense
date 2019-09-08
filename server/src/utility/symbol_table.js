const SymbolTable = {};

SymbolTable.createSymbolTable = function(outer = undefined) {

	const symbolTable = {};

	const symbols = {};
    const inner = [];

    symbolTable.insert = function(name, symbol) {
        symbols[name] = symbol;
    };

    /**
     * @param {string} name
     */
    symbolTable.lookUp = function(name) {
        if(symbols.hasOwnProperty(name)) {
            return symbols[name];
        } else if(outer !== undefined) {
            return outer.lookUp(name);
        } else {
            return undefined;
        }
    };

    symbolTable.push = function() {
        const innerSymbolTable = SymbolTable.createSymbolTable(symbolTable);
        inner.push(innerSymbolTable);
        return innerSymbolTable;
    };

    symbolTable.getInner = function() {
        return inner;
    };

    symbolTable.getSymbols = function() {
        return symbols;
    };

    symbolTable.print = function() {
        console.log(symbolTable.getSymbols());
		for(const innerSymbolTable of inner) {
            innerSymbolTable.print();
        }
    };

	return symbolTable;

};

module.exports = SymbolTable;