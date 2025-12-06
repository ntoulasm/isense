const SymbolTable = require('../../server/src/utility/symbol-table');
const Symbol = require('../../server/src/utility/symbol');
const ts = require('typescript');

describe('SymbolTable Module', () => {
	let symbolTable;
	let testSymbol1;
	let testSymbol2;

	beforeEach(() => {
		// Create fresh symbol table and test symbols for each test
		symbolTable = SymbolTable.create();
		testSymbol1 = Symbol.create('function1', {
			kind: ts.SyntaxKind.FunctionDeclaration,
		});
		testSymbol2 = Symbol.create('variable1', {
			kind: ts.SyntaxKind.VariableDeclaration,
		});
	});

	describe('SymbolTable.create', () => {
		it('should create an empty symbol table', () => {
			// Act
			const newTable = SymbolTable.create();

			// Assert
			expect(newTable).toBeDefined();
			expect(newTable.insert).toBeInstanceOf(Function);
			expect(newTable.lookUp).toBeInstanceOf(Function);
			expect(newTable.hasSymbol).toBeInstanceOf(Function);
			expect(newTable.getSymbols).toBeInstanceOf(Function);
			expect(newTable.print).toBeInstanceOf(Function);
			expect(Object.keys(newTable.getSymbols())).toHaveLength(0);
		});
	});

	describe('insert', () => {
		it('should insert a symbol into the table', () => {
			// Act
			symbolTable.insert(testSymbol1);

			// Assert
			const symbols = symbolTable.getSymbols();
			expect(symbols['function1']).toBe(testSymbol1);
		});

		it('should overwrite existing symbol with same name', () => {
			// Arrange
			const anotherSymbol = Symbol.create('function1', {
				kind: ts.SyntaxKind.ClassDeclaration,
			});
			symbolTable.insert(testSymbol1);

			// Act
			symbolTable.insert(anotherSymbol);

			// Assert
			const symbols = symbolTable.getSymbols();
			expect(symbols['function1']).toBe(anotherSymbol);
			expect(symbols['function1']).not.toBe(testSymbol1);
		});

		it('should handle multiple symbols', () => {
			// Act
			symbolTable.insert(testSymbol1);
			symbolTable.insert(testSymbol2);

			// Assert
			const symbols = symbolTable.getSymbols();
			expect(Object.keys(symbols)).toHaveLength(2);
			expect(symbols['function1']).toBe(testSymbol1);
			expect(symbols['variable1']).toBe(testSymbol2);
		});
	});

	describe('lookUp', () => {
		beforeEach(() => {
			symbolTable.insert(testSymbol1);
			symbolTable.insert(testSymbol2);
		});

		it('should return symbol when it exists', () => {
			// Act
			const result = symbolTable.lookUp('function1');

			// Assert
			expect(result).toBe(testSymbol1);
		});

		it('should return undefined when symbol does not exist', () => {
			// Act
			const result = symbolTable.lookUp('nonexistent');

			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined for empty string', () => {
			// Act
			const result = symbolTable.lookUp('');

			// Assert
			expect(result).toBeUndefined();
		});

		it('should handle case sensitivity', () => {
			// Act
			const result = symbolTable.lookUp('Function1'); // Different case

			// Assert
			expect(result).toBeUndefined();
		});
	});

	describe('hasSymbol', () => {
		beforeEach(() => {
			symbolTable.insert(testSymbol1);
		});

		it('should return true when symbol exists in table', () => {
			// Act
			const result = symbolTable.hasSymbol(testSymbol1);

			// Assert
			expect(result).toBe(true);
		});

		it('should return false when symbol does not exist in table', () => {
			// Act
			const result = symbolTable.hasSymbol(testSymbol2);

			// Assert
			expect(result).toBe(false);
		});

		it('should return false for null symbol', () => {
			// Act
			const result = symbolTable.hasSymbol(null);

			// Assert
			expect(result).toBe(false);
		});
	});

	describe('getSymbols', () => {
		it('should return empty object for empty table', () => {
			// Act
			const symbols = symbolTable.getSymbols();

			// Assert
			expect(symbols).toEqual({});
		});

		it('should return all symbols in table', () => {
			// Arrange
			symbolTable.insert(testSymbol1);
			symbolTable.insert(testSymbol2);

			// Act
			const symbols = symbolTable.getSymbols();

			// Assert
			expect(Object.keys(symbols)).toHaveLength(2);
			expect(symbols['function1']).toBe(testSymbol1);
			expect(symbols['variable1']).toBe(testSymbol2);
		});
	});

	describe('SymbolTable.copy', () => {
		beforeEach(() => {
			symbolTable.insert(testSymbol1);
			symbolTable.insert(testSymbol2);
		});

		it('should create a deep copy of symbol table', () => {
			// Act
			const copy = SymbolTable.copy(symbolTable);

			// Assert
			expect(copy).toBeDefined();
			expect(copy).not.toBe(symbolTable);

			const originalSymbols = symbolTable.getSymbols();
			const copiedSymbols = copy.getSymbols();

			expect(Object.keys(copiedSymbols)).toHaveLength(
				Object.keys(originalSymbols).length
			);
			expect(copiedSymbols['function1']).toBe(testSymbol1);
			expect(copiedSymbols['variable1']).toBe(testSymbol2);
		});

		it('should not affect original when modifying copy', () => {
			// Arrange
			const copy = SymbolTable.copy(symbolTable);
			const newSymbol = Symbol.create('newSymbol', {});

			// Act
			copy.insert(newSymbol);

			// Assert
			expect(Object.keys(symbolTable.getSymbols())).toHaveLength(2);
			expect(Object.keys(copy.getSymbols())).toHaveLength(3);
			expect(symbolTable.lookUp('newSymbol')).toBeUndefined();
			expect(copy.lookUp('newSymbol')).toBe(newSymbol);
		});

		it('should handle empty symbol table copy', () => {
			// Arrange
			const emptyTable = SymbolTable.create();

			// Act
			const copy = SymbolTable.copy(emptyTable);

			// Assert
			expect(Object.keys(copy.getSymbols())).toHaveLength(0);
		});
	});
});
