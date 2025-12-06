const Symbol = require('../../server/src/utility/symbol');
const ts = require('typescript');

describe('Symbol Module', () => {
    describe('Symbol.create', () => {
        it('should create a symbol with name and declaration', () => {
            // Arrange
            const name = 'testSymbol';
            const declaration = { kind: ts.SyntaxKind.VariableDeclaration };

            // Act
            const symbol = Symbol.create(name, declaration);

            // Assert
            expect(symbol).toBeDefined();
            expect(symbol.name).toBe(name);
            expect(symbol.declaration).toBe(declaration);
            expect(symbol.binders).toEqual([]);
            expect(Array.isArray(symbol.binders)).toBe(true);
        });

        it('should create symbol with empty string name', () => {
            // Arrange
            const name = '';
            const declaration = { kind: ts.SyntaxKind.FunctionDeclaration };

            // Act
            const symbol = Symbol.create(name, declaration);

            // Assert
            expect(symbol.name).toBe('');
            expect(symbol.declaration).toBe(declaration);
        });

        it('should create symbol with null declaration', () => {
            // Arrange
            const name = 'nullDeclSymbol';
            const declaration = null;

            // Act
            const symbol = Symbol.create(name, declaration);

            // Assert
            expect(symbol.name).toBe(name);
            expect(symbol.declaration).toBe(null);
        });
    });

    describe('Symbol.isAnonymous', () => {
        it('should return true for anonymous function symbols starting with (', () => {
            // Arrange
            const symbol = Symbol.create('(anonymous)', {});

            // Act
            const result = Symbol.isAnonymous(symbol);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true for anonymous class symbols starting with <', () => {
            // Arrange
            const symbol = Symbol.create('<anonymous class>', {});

            // Act
            const result = Symbol.isAnonymous(symbol);

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for named symbols', () => {
            // Arrange
            const symbol = Symbol.create('namedFunction', {});

            // Act
            const result = Symbol.isAnonymous(symbol);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for empty name', () => {
            // Arrange
            const symbol = Symbol.create('', {});

            // Act
            const result = Symbol.isAnonymous(symbol);

            // Assert
            expect(result).toBe(false);
        });

        it('should handle symbols with special characters in middle of name', () => {
            // Arrange
            const symbol = Symbol.create('my(function)', {});

            // Act
            const result = Symbol.isAnonymous(symbol);

            // Assert
            expect(result).toBe(false);
        });
    });
});
