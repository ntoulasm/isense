const SymbolTable = {};

SymbolTable.create = function () {
	const symbolTable = {};
	symbolTable.private = {};

	symbolTable.private.symbols = {};

	/**
	 * @param {isense.Symbol} symbol
	 */
	symbolTable.insert = function (symbol) {
		const name = symbol.name;
		symbolTable.private.symbols[name] = symbol;
	};

	/**
	 * @param {string} name
	 *
	 * @returns {isense.symbol}
	 */
	symbolTable.lookUp = function (name) {
		if (symbolTable.private.symbols.hasOwnProperty(name)) {
			return symbolTable.private.symbols[name];
		} else {
			return undefined;
		}
	};

	symbolTable.hasSymbol = symbol => {
		for (const [, s] of Object.entries(symbolTable.private.symbols)) {
			if (symbol === s) {
				return true;
			}
		}
		return false;
	};

	/**
	 * @returns {array<isense.symbol>}
	 */
	symbolTable.getSymbols = function () {
		return symbolTable.private.symbols;
	};

	/**
	 * @returns {void}
	 */
	symbolTable.print = function () {
		console.log(symbolTable.getSymbols());
	};

	return symbolTable;
};

SymbolTable.copy = symbolTable => {
	const copy = SymbolTable.create();

	for (const [, symbol] of Object.entries(symbolTable.getSymbols())) {
		copy.insert(symbol);
	}

	return copy;
};

module.exports = SymbolTable;
