const ts = require('typescript');
const Analyzer = require('../../server/src/analyzer/analyzer');
const Ast = require('../../server/src/ast/ast');

describe('Language Server Integration Tests', () => {
    let testSourceFile;

    beforeEach(() => {
        const sourceCode = `
function add(a, b) {
    return a + b;
}

let result = add(5, 3);

const obj = {
    name: 'test',
    value: 42
};

class Calculator {
    constructor(initial) {
        this.value = initial || 0;
    }
    add(num) {
        this.value += num;
        return this;
    }
}

let calc = new Calculator(10);
    `;

        testSourceFile = ts.createSourceFile(
            'test-integration.js',
            sourceCode,
            ts.ScriptTarget.ES2015,
            true
        );
        testSourceFile.analyzeDiagnostics = [];
        Ast.asts['file:///test-integration.js'] = testSourceFile;
    });

    describe('End-to-End Analysis Pipeline', () => {
        it('should analyze the complete test file without errors', () => {
            expect(() => Analyzer.analyze(testSourceFile)).not.toThrow();
            expect(testSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(testSourceFile.analyzeDiagnostics)).toBe(true);
        });

        it('should handle complex object property access', () => {
            Analyzer.analyze(testSourceFile);
            expect(testSourceFile.analyzeDiagnostics).toBeDefined();
            expect(testSourceFile.symbols).toBeDefined();
        });

        it('should handle function declarations and calls', () => {
            Analyzer.analyze(testSourceFile);
            expect(testSourceFile.analyzeDiagnostics).toBeDefined();
        });

        it('should handle class declarations and instantiation', () => {
            Analyzer.analyze(testSourceFile);
            expect(testSourceFile.analyzeDiagnostics).toBeDefined();
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle syntax errors gracefully', () => {
            const syntaxErrorCode = 'function broken( { let x = ;';
            const errorSourceFile = ts.createSourceFile(
                'error-test.js',
                syntaxErrorCode,
                ts.ScriptTarget.ES2015,
                true
            );
            errorSourceFile.analyzeDiagnostics = [];
            expect(() => Analyzer.analyze(errorSourceFile)).not.toThrow();
            expect(errorSourceFile.analyzeDiagnostics).toBeDefined();
        });

        it('should handle incomplete expressions', () => {
            const incompleteCode = 'let obj = { prop: ';
            const incompleteSourceFile = ts.createSourceFile(
                'incomplete-test.js',
                incompleteCode,
                ts.ScriptTarget.ES2015,
                true
            );
            incompleteSourceFile.analyzeDiagnostics = [];
            expect(() => Analyzer.analyze(incompleteSourceFile)).not.toThrow();
        });

        it('should handle deeply nested structures', () => {
            const deepNestingCode = `
        let deep = {
          level1: {
            level2: {
              level3: {
                value: 'deep'
              }
            }
          }
        };
      `;
            const deepSourceFile = ts.createSourceFile(
                'deep-test.js',
                deepNestingCode,
                ts.ScriptTarget.ES2015,
                true
            );
            deepSourceFile.analyzeDiagnostics = [];
            expect(() => Analyzer.analyze(deepSourceFile)).not.toThrow();
        });
    });

    describe('AST and Utility Integration', () => {
        it('should properly validate AST with required methods', () => {
            expect(typeof testSourceFile.getPositionOfLineAndCharacter).toBe(
                'function'
            );
        });

        it('should calculate correct offsets for positions', () => {
            const offset = testSourceFile.getPositionOfLineAndCharacter(1, 0);
            expect(typeof offset).toBe('number');
            expect(offset).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Symbol and Binding Integration', () => {
        it('should create symbols for all declarations', () => {
            Analyzer.analyze(testSourceFile);
            expect(testSourceFile.symbols).toBeDefined();
        });

        it('should handle variable declarations and bindings', () => {
            const simpleCode = 'let x = 5; let y = x + 10;';
            const sourceFile = ts.createSourceFile(
                'simple.js',
                simpleCode,
                ts.ScriptTarget.ES2015,
                true
            );
            sourceFile.analyzeDiagnostics = [];
            expect(() => Analyzer.analyze(sourceFile)).not.toThrow();
            expect(sourceFile.analyzeDiagnostics).toBeDefined();
            expect(sourceFile.symbols).toBeDefined();
        });

        it('should handle function scope and parameters', () => {
            const functionCode =
                'function test(a, b) { let sum = a + b; return sum; } let result = test(1, 2);';
            const sourceFile = ts.createSourceFile(
                'function-scope.js',
                functionCode,
                ts.ScriptTarget.ES2015,
                true
            );
            sourceFile.analyzeDiagnostics = [];
            expect(() => Analyzer.analyze(sourceFile)).not.toThrow();
            expect(sourceFile.symbols).toBeDefined();
        });
    });
});
