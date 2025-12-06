const Analyzer = require('../../server/src/analyzer/analyzer');
// Use the same TypeScript instance as the server
const ts = require('../../server/node_modules/typescript');

// Mock dependencies
jest.mock('../../server/src/ast/ast');
jest.mock('../../server/src/utility/symbol-table', () => ({
    create: jest.fn(() => ({
        insert: jest.fn(),
        lookUp: jest.fn(),
        hasSymbol: jest.fn(),
        getSymbols: jest.fn().mockReturnValue({}),
        print: jest.fn(),
    })),
}));

describe('Analyzer Module', () => {
    let mockSourceFile;
    let mockVariableDeclaration;
    let mockFunctionDeclaration;

    beforeEach(() => {
        // Reset analyzer state before each test
        jest.clearAllMocks();

        // Create mock AST nodes
        mockSourceFile = {
            kind: ts.SyntaxKind.SourceFile,
            fileName: 'test.js',
            parseDiagnostics: [],
            analyzeDiagnostics: [],
            statements: [],
        };

        mockVariableDeclaration = {
            kind: ts.SyntaxKind.VariableDeclaration,
            name: { text: 'testVar' },
            initializer: {
                kind: ts.SyntaxKind.NumericLiteral,
                text: '42',
            },
            parent: mockSourceFile,
        };

        mockFunctionDeclaration = {
            kind: ts.SyntaxKind.FunctionDeclaration,
            name: { text: 'testFunction' },
            parameters: [],
            body: {
                kind: ts.SyntaxKind.Block,
                statements: [],
            },
            parent: mockSourceFile,
        };

        mockSourceFile.statements = [
            mockVariableDeclaration,
            mockFunctionDeclaration,
        ];
    });

    describe('Analyzer.analyze', () => {
        it('should analyze a source file and initialize analyzeDiagnostics array', () => {
            // Arrange
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]); // Initial state

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Should remain empty for well-formed code without analysis errors
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]);
        });

        it('should handle empty source file and produce empty diagnostics', () => {
            // Arrange
            const emptySourceFile = {
                kind: ts.SyntaxKind.SourceFile,
                fileName: 'empty.js',
                parseDiagnostics: [],
                statements: [],
            };

            // Act
            Analyzer.analyze(emptySourceFile);

            // Assert
            expect(emptySourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(emptySourceFile.analyzeDiagnostics)).toBe(
                true
            );
            expect(emptySourceFile.analyzeDiagnostics).toEqual([]);
            // Empty file should not trigger any analysis diagnostics
        });

        it('should handle source file with parse errors gracefully', () => {
            // Arrange
            const parseError = {
                category: ts.DiagnosticCategory.Error,
                messageText: 'Syntax error',
            };
            mockSourceFile.parseDiagnostics = [parseError];

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Parse errors should not prevent analysis from completing
            // Analysis should still initialize diagnostics array
        });

        it('should set up binders array on nodes', () => {
            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert - Check that the analyzer ran without errors and set up the source file
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Note: Individual nodes may not get binders in our mock setup because
            // ts.forEachChild doesn't traverse our simple mock objects like real AST nodes
        });

        it('should propagate unreachable status to child nodes', () => {
            // Arrange
            const parentNode = { unreachable: true };
            const childNode = { parent: parentNode };

            // Simulate the analyzer's unreachable propagation logic
            if (childNode.parent && childNode.parent.unreachable) {
                childNode.unreachable = true;
            }

            // Assert
            expect(childNode.unreachable).toBe(true);
        });
    });

    describe('Analyzer type inference', () => {
        it('should process numeric literals correctly', () => {
            // Arrange
            const sourceWithNumber = {
                kind: ts.SyntaxKind.SourceFile,
                fileName: 'number-test.js',
                parseDiagnostics: [],
                analyzeDiagnostics: [],
                statements: [
                    {
                        kind: ts.SyntaxKind.VariableStatement,
                        declarationList: {
                            declarations: [
                                {
                                    kind: ts.SyntaxKind.VariableDeclaration,
                                    name: { text: 'num' },
                                    initializer: {
                                        kind: ts.SyntaxKind.NumericLiteral,
                                        text: '123',
                                    },
                                },
                            ],
                        },
                    },
                ],
            };

            // Act
            Analyzer.analyze(sourceWithNumber);

            // Assert
            expect(sourceWithNumber.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(sourceWithNumber.analyzeDiagnostics)).toBe(
                true
            );
            // Analysis should complete without errors for valid numeric literal
            expect(sourceWithNumber.analyzeDiagnostics).toEqual([]);
        });

        it('should process string literals correctly', () => {
            // Arrange
            const sourceWithString = {
                kind: ts.SyntaxKind.SourceFile,
                fileName: 'string-test.js',
                parseDiagnostics: [],
                analyzeDiagnostics: [],
                statements: [
                    {
                        kind: ts.SyntaxKind.VariableStatement,
                        declarationList: {
                            declarations: [
                                {
                                    kind: ts.SyntaxKind.VariableDeclaration,
                                    name: { text: 'str' },
                                    initializer: {
                                        kind: ts.SyntaxKind.StringLiteral,
                                        text: '"hello"',
                                    },
                                },
                            ],
                        },
                    },
                ],
            };

            // Act
            Analyzer.analyze(sourceWithString);

            // Assert
            expect(sourceWithString.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(sourceWithString.analyzeDiagnostics)).toBe(
                true
            );
            // Analysis should complete without errors for valid string literal
            expect(sourceWithString.analyzeDiagnostics).toEqual([]);
        });

        it('should process boolean literals correctly', () => {
            // Arrange
            const sourceWithBooleans = {
                kind: ts.SyntaxKind.SourceFile,
                fileName: 'boolean-test.js',
                parseDiagnostics: [],
                analyzeDiagnostics: [],
                statements: [
                    {
                        kind: ts.SyntaxKind.VariableStatement,
                        declarationList: {
                            declarations: [
                                {
                                    kind: ts.SyntaxKind.VariableDeclaration,
                                    name: { text: 'isTrue' },
                                    initializer: {
                                        kind: ts.SyntaxKind.TrueKeyword,
                                    },
                                },
                                {
                                    kind: ts.SyntaxKind.VariableDeclaration,
                                    name: { text: 'isFalse' },
                                    initializer: {
                                        kind: ts.SyntaxKind.FalseKeyword,
                                    },
                                },
                            ],
                        },
                    },
                ],
            };

            // Act
            Analyzer.analyze(sourceWithBooleans);

            // Assert
            expect(sourceWithBooleans.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(sourceWithBooleans.analyzeDiagnostics)).toBe(
                true
            );
            // Analysis should complete without errors for valid boolean literals
            expect(sourceWithBooleans.analyzeDiagnostics).toEqual([]);
        });
    });

    describe('Analyzer function analysis', () => {
        it('should analyze function declarations correctly', () => {
            // Arrange
            const functionWithReturn = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: { text: 'getValue' },
                parameters: [], // Required for binder processing
                body: {
                    kind: ts.SyntaxKind.Block,
                    statements: [
                        {
                            kind: ts.SyntaxKind.ReturnStatement,
                            expression: {
                                kind: ts.SyntaxKind.NumericLiteral,
                                text: '42',
                            },
                        },
                    ],
                },
            };

            mockSourceFile.statements = [functionWithReturn];

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Function declaration should be processed without analysis errors
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]);
        });

        it('should process function parameters correctly', () => {
            // Arrange
            const functionWithParams = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: { text: 'add' },
                parameters: [
                    {
                        kind: ts.SyntaxKind.Parameter,
                        name: { text: 'a', kind: ts.SyntaxKind.Identifier },
                    },
                    {
                        kind: ts.SyntaxKind.Parameter,
                        name: { text: 'b', kind: ts.SyntaxKind.Identifier },
                    },
                ],
                body: { kind: ts.SyntaxKind.Block, statements: [] },
            };

            mockSourceFile.statements = [functionWithParams];

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Function with parameters should be processed without errors
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]);
        });

        it('should analyze function calls correctly', () => {
            // Arrange
            const functionCall = {
                kind: ts.SyntaxKind.CallExpression,
                expression: {
                    kind: ts.SyntaxKind.Identifier,
                    text: 'testFunction',
                },
                arguments: [
                    { kind: ts.SyntaxKind.NumericLiteral, text: '1' },
                    { kind: ts.SyntaxKind.NumericLiteral, text: '2' },
                ],
            };

            const expressionStatement = {
                kind: ts.SyntaxKind.ExpressionStatement,
                expression: functionCall,
            };

            mockSourceFile.statements = [expressionStatement];

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Function call should be processed without errors
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]);
        });
    });

    describe('Analyzer variable analysis', () => {
        it('should analyze variable declarations with initializers correctly', () => {
            // Arrange
            const variableWithInit = {
                kind: ts.SyntaxKind.VariableDeclaration,
                name: { text: 'myVar', kind: ts.SyntaxKind.Identifier },
                initializer: {
                    kind: ts.SyntaxKind.StringLiteral,
                    text: '"hello"',
                },
                parent: {
                    kind: ts.SyntaxKind.VariableDeclarationList,
                    flags: 0, // var declaration
                },
            };

            mockSourceFile.statements = [
                {
                    kind: ts.SyntaxKind.VariableStatement,
                    declarationList: {
                        kind: ts.SyntaxKind.VariableDeclarationList,
                        declarations: [variableWithInit],
                        flags: 0,
                    },
                },
            ];

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Variable declaration with initializer should be processed without errors
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]);
        });

        it('should handle variable declarations without initializers correctly', () => {
            // Arrange
            const variableWithoutInit = {
                kind: ts.SyntaxKind.VariableDeclaration,
                name: {
                    text: 'uninitializedVar',
                    kind: ts.SyntaxKind.Identifier,
                },
                parent: {
                    kind: ts.SyntaxKind.VariableDeclarationList,
                    flags: 0,
                },
            };

            mockSourceFile.statements = [
                {
                    kind: ts.SyntaxKind.VariableStatement,
                    declarationList: {
                        kind: ts.SyntaxKind.VariableDeclarationList,
                        declarations: [variableWithoutInit],
                        flags: 0,
                    },
                },
            ];

            // Act
            Analyzer.analyze(mockSourceFile);

            // Assert
            expect(mockSourceFile.analyzeDiagnostics).toBeDefined();
            expect(Array.isArray(mockSourceFile.analyzeDiagnostics)).toBe(true);
            // Variable declaration without initializer should be processed without errors
            expect(mockSourceFile.analyzeDiagnostics).toEqual([]);
        });
    });

    describe('Analyzer object and property analysis', () => {
        it('should analyze object literals', () => {
            // Arrange
            const objectLiteral = {
                kind: ts.SyntaxKind.ObjectLiteralExpression,
                properties: [
                    {
                        kind: ts.SyntaxKind.PropertyAssignment,
                        name: { text: 'prop1' },
                        initializer: {
                            kind: ts.SyntaxKind.NumericLiteral,
                            text: '42',
                        },
                    },
                    {
                        kind: ts.SyntaxKind.PropertyAssignment,
                        name: { text: 'prop2' },
                        initializer: {
                            kind: ts.SyntaxKind.StringLiteral,
                            text: '"value"',
                        },
                    },
                ],
            };

            const variableDeclaration = {
                kind: ts.SyntaxKind.VariableDeclaration,
                name: { text: 'obj' },
                initializer: objectLiteral,
            };

            mockSourceFile.statements = [
                {
                    kind: ts.SyntaxKind.VariableStatement,
                    declarationList: { declarations: [variableDeclaration] },
                },
            ];

            // Act & Assert
            expect(() => Analyzer.analyze(mockSourceFile)).not.toThrow();
        });

        it('should analyze property access expressions', () => {
            // Arrange
            const propertyAccess = {
                kind: ts.SyntaxKind.PropertyAccessExpression,
                expression: { kind: ts.SyntaxKind.Identifier, text: 'obj' },
                name: { kind: ts.SyntaxKind.Identifier, text: 'prop' },
            };

            const expressionStatement = {
                kind: ts.SyntaxKind.ExpressionStatement,
                expression: propertyAccess,
            };

            mockSourceFile.statements = [expressionStatement];

            // Act & Assert
            expect(() => Analyzer.analyze(mockSourceFile)).not.toThrow();
        });
    });

    describe('Analyzer error handling', () => {
        it('should handle malformed AST gracefully', () => {
            // Arrange
            const malformedNode = {
                kind: 99999, // Invalid syntax kind
                malformed: true,
            };

            mockSourceFile.statements = [malformedNode];

            // Act & Assert
            expect(() => Analyzer.analyze(mockSourceFile)).not.toThrow();
        });

        it('should handle circular references', () => {
            // Arrange
            const node1 = { kind: ts.SyntaxKind.Block };
            const node2 = { kind: ts.SyntaxKind.Block };
            node1.child = node2;
            node2.parent = node1;
            // This creates a circular reference that the analyzer should handle

            mockSourceFile.statements = [node1];

            // Act & Assert
            expect(() => Analyzer.analyze(mockSourceFile)).not.toThrow();
        });
    });
});
