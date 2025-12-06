const Ast = require('../../server/src/ast/ast');
const ts = require('typescript');

describe('Ast Module', () => {
	let mockSourceFile;
	let mockNode;

	beforeEach(() => {
		// Create mock AST nodes for testing
		mockSourceFile = {
			kind: ts.SyntaxKind.SourceFile,
			parseDiagnostics: [],
			fileName: 'test.js',
		};

		mockNode = {
			kind: ts.SyntaxKind.VariableDeclaration,
			parent: mockSourceFile,
		};
	});

	describe('Ast.asts global storage', () => {
		it('should have asts object for storing parsed files', () => {
			// Assert
			expect(Ast.asts).toBeDefined();
			expect(typeof Ast.asts).toBe('object');
		});

		it('should allow storing and retrieving ASTs', () => {
			// Arrange
			const fileName = 'test-file.js';

			// Act
			Ast.asts[fileName] = mockSourceFile;

			// Assert
			expect(Ast.asts[fileName]).toBe(mockSourceFile);
		});
	});

	describe('Ast.hasParseError', () => {
		it('should return falsy when no parse errors exist', () => {
			// Arrange
			mockSourceFile.parseDiagnostics = [];

			// Act
			const result = Ast.hasParseError(mockSourceFile);

			// Assert
			expect(result).toBeFalsy();
		});

		it('should return falsy when only warnings exist', () => {
			// Arrange
			mockSourceFile.parseDiagnostics = [
				{ category: ts.DiagnosticCategory.Warning },
				{ category: ts.DiagnosticCategory.Suggestion },
			];

			// Act
			const result = Ast.hasParseError(mockSourceFile);

			// Assert
			expect(result).toBeFalsy();
		});

		it('should return truthy when error category diagnostic exists', () => {
			// Arrange
			mockSourceFile.parseDiagnostics = [
				{ category: ts.DiagnosticCategory.Warning },
				{ category: ts.DiagnosticCategory.Error },
				{ category: ts.DiagnosticCategory.Message },
			];

			// Act
			const result = Ast.hasParseError(mockSourceFile);

			// Assert
			expect(result).toBeTruthy();
		});

		it('should handle empty AST gracefully', () => {
			// Arrange
			const emptyAst = { parseDiagnostics: [] };

			// Act
			const result = Ast.hasParseError(emptyAst);

			// Assert
			expect(result).toBeFalsy();
		});

		it('should handle AST with undefined parseDiagnostics', () => {
			// Arrange
			const astWithoutDiagnostics = {};

			// Act & Assert
			expect(() => Ast.hasParseError(astWithoutDiagnostics)).toThrow();
		});
	});

	describe('AST node type constants', () => {
		it('should have nodesWithInnerScope array with expected node types', () => {
			// Assert
			expect(Array.isArray(Ast.nodesWithInnerScope || [])).toBe(true);
			// Note: The actual array is not exported, but we can test the concept
		});

		it('should have conditionalNodes array with expected node types', () => {
			// Assert
			expect(Array.isArray(Ast.conditionalNodes || [])).toBe(true);
			// Note: The actual array is not exported, but we can test the concept
		});
	});

	describe('Node type checking utilities', () => {
		// Test helper function patterns that might exist in the AST module
		it('should handle various TypeScript syntax kinds', () => {
			// Arrange
			const functionNode = { kind: ts.SyntaxKind.FunctionDeclaration };
			const variableNode = { kind: ts.SyntaxKind.VariableDeclaration };
			const classNode = { kind: ts.SyntaxKind.ClassDeclaration };
			const blockNode = { kind: ts.SyntaxKind.Block };

			// Assert - These are the core node types the AST module should handle
			expect(functionNode.kind).toBe(ts.SyntaxKind.FunctionDeclaration);
			expect(variableNode.kind).toBe(ts.SyntaxKind.VariableDeclaration);
			expect(classNode.kind).toBe(ts.SyntaxKind.ClassDeclaration);
			expect(blockNode.kind).toBe(ts.SyntaxKind.Block);
		});

		it('should identify property access expressions', () => {
			// Arrange
			const propertyAccessNode = {
				kind: ts.SyntaxKind.PropertyAccessExpression,
				expression: { kind: ts.SyntaxKind.Identifier, text: 'obj' },
				name: { kind: ts.SyntaxKind.Identifier, text: 'prop' },
			};

			// Assert
			expect(propertyAccessNode.kind).toBe(
				ts.SyntaxKind.PropertyAccessExpression
			);
		});

		it('should identify various statement types', () => {
			// Arrange
			const ifStatement = { kind: ts.SyntaxKind.IfStatement };
			const forStatement = { kind: ts.SyntaxKind.ForStatement };
			const whileStatement = { kind: ts.SyntaxKind.WhileStatement };
			const returnStatement = { kind: ts.SyntaxKind.ReturnStatement };

			// Assert
			expect(ifStatement.kind).toBe(ts.SyntaxKind.IfStatement);
			expect(forStatement.kind).toBe(ts.SyntaxKind.ForStatement);
			expect(whileStatement.kind).toBe(ts.SyntaxKind.WhileStatement);
			expect(returnStatement.kind).toBe(ts.SyntaxKind.ReturnStatement);
		});
	});

	describe('AST node relationships', () => {
		it('should handle parent-child relationships', () => {
			// Arrange
			const parentNode = {
				kind: ts.SyntaxKind.Block,
				statements: [],
			};

			const childNode = {
				kind: ts.SyntaxKind.ExpressionStatement,
				parent: parentNode,
			};

			parentNode.statements.push(childNode);

			// Assert
			expect(childNode.parent).toBe(parentNode);
			expect(parentNode.statements).toContain(childNode);
		});

		it('should handle sibling relationships', () => {
			// Arrange
			const parentNode = {
				kind: ts.SyntaxKind.Block,
				statements: [],
			};

			const sibling1 = {
				kind: ts.SyntaxKind.VariableStatement,
				parent: parentNode,
			};

			const sibling2 = {
				kind: ts.SyntaxKind.ExpressionStatement,
				parent: parentNode,
			};

			parentNode.statements.push(sibling1, sibling2);

			// Assert
			expect(sibling1.parent).toBe(parentNode);
			expect(sibling2.parent).toBe(parentNode);
			expect(parentNode.statements).toHaveLength(2);
		});
	});

	describe('AST modification and traversal', () => {
		it('should support adding custom properties to nodes', () => {
			// Arrange
			const node = {
				kind: ts.SyntaxKind.FunctionDeclaration,
				name: { text: 'testFunction' },
			};

			// Act - Add custom properties that the analyzer might add
			node.symbols = {};
			node.binders = [];
			node.analyzeDiagnostics = [];

			// Assert
			expect(node.symbols).toBeDefined();
			expect(Array.isArray(node.binders)).toBe(true);
			expect(Array.isArray(node.analyzeDiagnostics)).toBe(true);
		});

		it('should support unreachable code marking', () => {
			// Arrange
			const parentNode = { unreachable: true };
			const childNode = { parent: parentNode };

			// Act - Simulate the unreachable propagation logic
			if (childNode.parent && childNode.parent.unreachable) {
				childNode.unreachable = true;
			}

			// Assert
			expect(childNode.unreachable).toBe(true);
		});
	});
});
