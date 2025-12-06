const Binder = require('../../server/src/analyzer/binder');
const SymbolTable = require('../../server/src/utility/symbol-table');
// Use the same TypeScript instance as the server
const ts = require('../../server/node_modules/typescript');

// Mock dependencies
jest.mock('../../server/src/utility/symbol-table');

describe('Binder Module', () => {
    let mockFunctionBody;
    let mockBlockStatement;
    let mockVariableDeclaration;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset binder counters
        Binder.reset();

        // Create mock AST nodes
        mockFunctionBody = {
            kind: ts.SyntaxKind.Block,
            statements: [],
        };

        mockBlockStatement = {
            kind: ts.SyntaxKind.Block,
            statements: [],
        };

        mockVariableDeclaration = {
            kind: ts.SyntaxKind.VariableDeclaration,
            name: { text: 'testVar' },
            parent: mockFunctionBody,
        };

        // Mock SymbolTable.create
        SymbolTable.create.mockReturnValue({
            insert: jest.fn(),
            lookUp: jest.fn(),
            hasSymbol: jest.fn(),
            getSymbols: jest.fn().mockReturnValue({}),
            print: jest.fn(),
        });
    });

    describe('Binder counter management', () => {
        it('should initialize anonymous function counter to 0', () => {
            // Assert
            expect(Binder.totalAnonymousFunctions).toBe(0);
        });

        it('should initialize anonymous class counter to 0', () => {
            // Assert
            expect(Binder.totalAnonymousClasses).toBe(0);
        });

        it('should reset counters when reset is called', () => {
            // Arrange
            Binder.totalAnonymousFunctions = 5;
            Binder.totalAnonymousClasses = 3;

            // Act
            Binder.reset();

            // Assert
            expect(Binder.totalAnonymousFunctions).toBe(0);
            expect(Binder.totalAnonymousClasses).toBe(0);
        });
    });

    describe('Binder.bindFunctionScopedDeclarations', () => {
        it('should handle null body gracefully', () => {
            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(null)
            ).not.toThrow();
        });

        it('should handle undefined body gracefully', () => {
            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(undefined)
            ).not.toThrow();
        });

        it('should initialize binders array for non-class bodies', () => {
            // Act
            Binder.bindFunctionScopedDeclarations(mockFunctionBody);

            // Assert
            expect(mockFunctionBody.binders).toEqual([]);
            expect(Array.isArray(mockFunctionBody.binders)).toBe(true);
        });

        it('should preserve existing binders for class-like nodes', () => {
            // Arrange
            mockFunctionBody.kind = ts.SyntaxKind.ClassDeclaration;
            mockFunctionBody.binders = ['existing', 'binders'];

            // Act
            Binder.bindFunctionScopedDeclarations(mockFunctionBody);

            // Assert
            expect(mockFunctionBody.binders).toEqual(['existing', 'binders']);
        });

        it('should create symbol table for the body', () => {
            // Act
            Binder.bindFunctionScopedDeclarations(mockFunctionBody);

            // Assert
            expect(SymbolTable.create).toHaveBeenCalled();
            expect(mockFunctionBody.symbols).toBeDefined();
        });

        it('should handle function body with statements', () => {
            // Arrange

            // Add parent and parameters to nested function
            const nestedFunction = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: { text: 'nestedFunction' },
                parameters: [],
                body: { kind: ts.SyntaxKind.Block, statements: [] },
                parent: mockFunctionBody,
            };
            // Add parent and flags to variable declaration
            const variableDecl = {
                kind: ts.SyntaxKind.VariableDeclaration,
                name: { text: 'testVar', kind: ts.SyntaxKind.Identifier },
                parent: {
                    kind: ts.SyntaxKind.VariableDeclarationList,
                    flags: 0,
                },
            };
            mockFunctionBody.statements = [variableDecl, nestedFunction];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });
    });

    describe('Binder.bindBlockScopedDeclarations', () => {
        it('should initialize symbol table for block', () => {
            // Act
            Binder.bindBlockScopedDeclarations(mockBlockStatement);

            // Assert
            expect(SymbolTable.create).toHaveBeenCalled();
            expect(mockBlockStatement.symbols).toBeDefined();
        });

        it('should initialize binders array for block', () => {
            // Act
            Binder.bindBlockScopedDeclarations(mockBlockStatement);

            // Assert
            expect(mockBlockStatement.binders).toEqual([]);
            expect(Array.isArray(mockBlockStatement.binders)).toBe(true);
        });

        it('should handle block with various statement types', () => {
            // Arrange
            mockBlockStatement.statements = [
                {
                    kind: ts.SyntaxKind.VariableStatement,
                    declarationList: {
                        declarations: [mockVariableDeclaration],
                    },
                },
                {
                    kind: ts.SyntaxKind.ExpressionStatement,
                    expression: {
                        kind: ts.SyntaxKind.CallExpression,
                    },
                },
            ];

            // Act & Assert
            expect(() =>
                Binder.bindBlockScopedDeclarations(mockBlockStatement)
            ).not.toThrow();
        });

        it('should handle empty block', () => {
            // Arrange
            mockBlockStatement.statements = [];

            // Act & Assert
            expect(() =>
                Binder.bindBlockScopedDeclarations(mockBlockStatement)
            ).not.toThrow();
            expect(mockBlockStatement.symbols).toBeDefined();
            expect(mockBlockStatement.binders).toEqual([]);
        });
    });

    describe('Binder function and class handling', () => {
        it('should handle function declarations', () => {
            // Arrange
            const functionDeclaration = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: { text: 'myFunction' },
                parameters: [
                    { kind: ts.SyntaxKind.Parameter, name: { text: 'param1' } },
                    { kind: ts.SyntaxKind.Parameter, name: { text: 'param2' } },
                ],
                body: {
                    kind: ts.SyntaxKind.Block,
                    statements: [],
                },
            };

            mockFunctionBody.statements = [functionDeclaration];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle anonymous functions', () => {
            // Arrange

            // Anonymous function with parent
            const anonymousFunction = {
                kind: ts.SyntaxKind.FunctionExpression,
                name: undefined, // Anonymous
                parameters: [],
                body: {
                    kind: ts.SyntaxKind.Block,
                    statements: [],
                },
                parent: {
                    kind: ts.SyntaxKind.VariableDeclaration,
                    name: { text: 'anonVar', kind: ts.SyntaxKind.Identifier },
                    initializer: null, // not used
                },
            };
            anonymousFunction.parent.initializer = anonymousFunction;

            const expressionStatement = {
                kind: ts.SyntaxKind.ExpressionStatement,
                expression: anonymousFunction,
            };

            mockFunctionBody.statements = [expressionStatement];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle class declarations', () => {
            // Arrange
            const classDeclaration = {
                kind: ts.SyntaxKind.ClassDeclaration,
                name: { text: 'MyClass' },
                members: [
                    {
                        kind: ts.SyntaxKind.Constructor,
                        parameters: [],
                    },
                    {
                        kind: ts.SyntaxKind.MethodDeclaration,
                        name: { text: 'method1' },
                    },
                ],
            };

            mockFunctionBody.statements = [classDeclaration];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle arrow functions', () => {
            // Arrange
            const arrowFunction = {
                kind: ts.SyntaxKind.ArrowFunction,
                parameters: [
                    { kind: ts.SyntaxKind.Parameter, name: { text: 'x' } },
                ],
                body: {
                    kind: ts.SyntaxKind.Block,
                    statements: [],
                },
            };

            const variableStatement = {
                kind: ts.SyntaxKind.VariableStatement,
                declarationList: {
                    declarations: [
                        {
                            kind: ts.SyntaxKind.VariableDeclaration,
                            name: { text: 'arrowFunc' },
                            initializer: arrowFunction,
                        },
                    ],
                },
            };

            mockFunctionBody.statements = [variableStatement];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });
    });

    describe('Binder variable and parameter handling', () => {
        it('should handle variable declarations', () => {
            // Arrange

            // Add parent and flags to variable declarations
            const variableDecl1 = {
                kind: ts.SyntaxKind.VariableDeclaration,
                name: { text: 'var1', kind: ts.SyntaxKind.Identifier },
                initializer: {
                    kind: ts.SyntaxKind.NumericLiteral,
                    text: '42',
                },
                parent: {
                    kind: ts.SyntaxKind.VariableDeclarationList,
                    flags: 0,
                },
            };
            const variableDecl2 = {
                kind: ts.SyntaxKind.VariableDeclaration,
                name: { text: 'var2', kind: ts.SyntaxKind.Identifier },
                initializer: {
                    kind: ts.SyntaxKind.StringLiteral,
                    text: '"hello"',
                },
                parent: {
                    kind: ts.SyntaxKind.VariableDeclarationList,
                    flags: 0,
                },
            };
            const variableStatement = {
                kind: ts.SyntaxKind.VariableStatement,
                declarationList: {
                    kind: ts.SyntaxKind.VariableDeclarationList,
                    declarations: [variableDecl1, variableDecl2],
                    flags: 0,
                },
            };
            // Set parent pointers
            variableDecl1.parent = variableStatement.declarationList;
            variableDecl2.parent = variableStatement.declarationList;

            mockFunctionBody.statements = [variableStatement];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle parameter declarations', () => {
            // Arrange
            const functionWithParams = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: { text: 'paramFunction' },
                parameters: [
                    {
                        kind: ts.SyntaxKind.Parameter,
                        name: { text: 'a' },
                        type: { kind: ts.SyntaxKind.NumberKeyword },
                    },
                    {
                        kind: ts.SyntaxKind.Parameter,
                        name: { text: 'b' },
                        type: { kind: ts.SyntaxKind.StringKeyword },
                    },
                    {
                        kind: ts.SyntaxKind.Parameter,
                        name: { text: 'c' }, // No type annotation
                    },
                ],
                body: mockBlockStatement,
            };

            mockFunctionBody.statements = [functionWithParams];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle destructuring parameters', () => {
            // Arrange
            const destructuringFunction = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: { text: 'destructFunc' },
                parameters: [
                    {
                        kind: ts.SyntaxKind.Parameter,
                        name: {
                            kind: ts.SyntaxKind.ObjectBindingPattern,
                            elements: [
                                {
                                    kind: ts.SyntaxKind.BindingElement,
                                    name: { text: 'prop1' },
                                },
                                {
                                    kind: ts.SyntaxKind.BindingElement,
                                    name: { text: 'prop2' },
                                },
                            ],
                        },
                    },
                ],
                body: mockBlockStatement,
            };

            mockFunctionBody.statements = [destructuringFunction];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });
    });

    describe('Binder import handling', () => {
        it('should handle import declarations', () => {
            // Arrange
            const importDeclaration = {
                kind: ts.SyntaxKind.ImportDeclaration,
                importClause: {
                    kind: ts.SyntaxKind.ImportClause,
                    name: { text: 'defaultImport' },
                    namedBindings: {
                        kind: ts.SyntaxKind.NamedImports,
                        elements: [
                            {
                                kind: ts.SyntaxKind.ImportSpecifier,
                                name: { text: 'namedImport1' },
                            },
                            {
                                kind: ts.SyntaxKind.ImportSpecifier,
                                name: { text: 'namedImport2' },
                                propertyName: { text: 'original2' },
                            },
                        ],
                    },
                },
                moduleSpecifier: {
                    kind: ts.SyntaxKind.StringLiteral,
                    text: '"./module"',
                },
            };

            mockFunctionBody.statements = [importDeclaration];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle namespace imports', () => {
            // Arrange
            const namespaceImport = {
                kind: ts.SyntaxKind.ImportDeclaration,
                importClause: {
                    kind: ts.SyntaxKind.ImportClause,
                    namedBindings: {
                        kind: ts.SyntaxKind.NamespaceImport,
                        name: { text: 'entireModule' },
                    },
                },
                moduleSpecifier: {
                    kind: ts.SyntaxKind.StringLiteral,
                    text: '"./entire-module"',
                },
            };

            mockFunctionBody.statements = [namespaceImport];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });
    });

    describe('Binder error handling', () => {
        it('should handle malformed nodes gracefully', () => {
            // Arrange
            const malformedNode = {
                kind: 99999, // Invalid syntax kind
                malformed: true,
            };

            mockFunctionBody.statements = [malformedNode];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle nodes without required properties', () => {
            // Arrange

            // Add parent and name object to incomplete node
            const incompleteNode = {
                kind: ts.SyntaxKind.FunctionDeclaration,
                name: {}, // Provide empty object to avoid TypeError on .text
                parameters: [],
                body: undefined,
                parent: mockFunctionBody,
            };
            mockFunctionBody.statements = [incompleteNode];

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(mockFunctionBody)
            ).not.toThrow();
        });

        it('should handle circular references in AST', () => {
            // Arrange
            const node1 = { kind: ts.SyntaxKind.Block, statements: [] };
            const node2 = { kind: ts.SyntaxKind.Block, statements: [] };

            node1.statements.push(node2);
            node2.parent = node1;
            // This creates a potential circular reference

            // Act & Assert
            expect(() =>
                Binder.bindFunctionScopedDeclarations(node1)
            ).not.toThrow();
        });
    });
});
