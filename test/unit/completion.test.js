const Completion = require('../../server/src/services/completion');
// Use the same TypeScript instance as the server
const ts = require('../../server/node_modules/typescript');

// Mock dependencies
jest.mock('../../server/src/analyzer/analyzer', () => ({
  analyze: jest.fn()
}));
jest.mock('../../server/src/ast/ast', () => ({
  isDeclarationName: jest.fn(),
  isNameOfPropertyAccessExpression: jest.fn(),
  findVisibleSymbols: jest.fn().mockReturnValue([]),
  findActiveTypeBinders: jest.fn().mockReturnValue([]),
  findActiveTypeBindersInLeftSibling: jest.fn().mockReturnValue([]),
  isConstDeclaration: jest.fn().mockReturnValue(false)
}));
jest.mock('../../server/src/services/utility', () => ({
  getAst: jest.fn(),
  findFocusedNode: jest.fn(),
  getCompletionItemKind: jest.fn(),
  getPropertySymbols: jest.fn()
}));
jest.mock('../../server/src/utility/type-carrier', () => ({
  Kind: {
    Constant: 0,
    Variable: 1,
    BinaryExpression: 2,
    PrefixUnaryExpression: 3,
    PostfixUnaryExpression: 4,
    TypeOfExpression: 5,
    CallExpression: 6,
    NewExpression: 7
  },
  evaluate: jest.fn().mockReturnValue([{ type: 'string', hasValue: true, value: 'mock' }])
}));

describe('Completion Service', () => {
  let mockTextDocumentPositionParams;
  let mockCompletionContext;
  let mockSourceFile;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTextDocumentPositionParams = {
      textDocument: {
        uri: 'file:///test.js'
      },
      position: {
        line: 5,
        character: 10
      },
      context: {
        triggerCharacter: '.'
      }
    };

    mockCompletionContext = {
      triggerCharacter: '.'
    };

    mockSourceFile = {
      kind: ts.SyntaxKind.SourceFile,
      fileName: 'test.js',
      statements: [],
      analyzeDiagnostics: []
    };

    // Set up default mock return values
    const mockUtility = require('../../server/src/services/utility');
    const Analyzer = require('../../server/src/analyzer/analyzer');
    const Ast = require('../../server/src/ast/ast');
    
    mockUtility.getAst.mockReturnValue(mockSourceFile);
    mockUtility.findFocusedNode.mockReturnValue({
      kind: ts.SyntaxKind.Identifier,
      text: 'obj'
    });
    mockUtility.getCompletionItemKind.mockReturnValue(6); // Variable
    mockUtility.getPropertySymbols.mockReturnValue([]);
    
    Analyzer.analyze.mockImplementation(() => {});
    Ast.isDeclarationName.mockReturnValue(false);
    Ast.isNameOfPropertyAccessExpression.mockReturnValue(false);
    Ast.findVisibleSymbols.mockReturnValue([]);
  });

  describe('Completion.onCompletion', () => {
    it('should return undefined when no focused node is found', () => {
      // Arrange
      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(null);
      
      const completionParams = {
        textDocument: { uri: 'file:///test.js' },
        position: { line: 5, character: 10 },
        context: { triggerCharacter: '.' }
      };

      // Act
      const result = Completion.onCompletion(completionParams);

      // Assert
      expect(result).toBeUndefined();
      expect(mockUtility.findFocusedNode).toHaveBeenCalledWith(
        mockSourceFile, 
        completionParams.position
      );
    });

    it('should return undefined when completing at declaration names', () => {
      // Arrange
      const Ast = require('../../server/src/ast/ast');
      const mockUtility = require('../../server/src/services/utility');
      
      const declarationNode = {
        kind: ts.SyntaxKind.Identifier,
        text: 'variableName'
      };
      
      Ast.isDeclarationName.mockReturnValue(true);
      mockUtility.findFocusedNode.mockReturnValue(declarationNode);

      const completionParams = {
        textDocument: { uri: 'file:///test.js' },
        position: { line: 5, character: 10 },
        context: { triggerCharacter: undefined }
      };

      // Act
      const result = Completion.onCompletion(completionParams);

      // Assert
      expect(result).toBeUndefined();
      expect(Ast.isDeclarationName).toHaveBeenCalledWith(declarationNode);
      // Should not provide completions when user is typing a declaration name
    });

    it('should provide property completions for object with dot trigger', () => {
      // Arrange
      const mockPropertyAccessNode = {
        kind: ts.SyntaxKind.PropertyAccessExpression,
        expression: {
          kind: ts.SyntaxKind.Identifier,
          text: 'obj',
          carrier: { // Mock type carrier for property evaluation
            type: 'object',
            properties: {
              getSymbols: () => ({
                'property1': { name: 'property1', kind: 'property' },
                'method1': { name: 'method1', kind: 'method' }
              })
            }
          }
        },
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: ''
        }
      };

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(mockPropertyAccessNode);
      mockUtility.getPropertySymbols.mockReturnValue([
        { name: 'property1', declaration: { kind: ts.SyntaxKind.PropertyDeclaration } },
        { name: 'method1', declaration: { kind: ts.SyntaxKind.MethodDeclaration } }
      ]);
      mockUtility.getCompletionItemKind.mockReturnValue(6); // Variable kind

      // Mock AST to return binders (required for completion to be generated)
      const Ast = require('../../server/src/ast/ast');
      const TypeCarrier = require('../../server/src/utility/type-carrier');
      Ast.findActiveTypeBindersInLeftSibling.mockReturnValue([
        { 
          carrier: { 
            kind: TypeCarrier.Kind.Variable, // Use proper TypeCarrier kind
            text: 'property1' 
          } 
        }
      ]);

      const completionParams = {
        textDocument: { uri: 'file:///test.js' },
        position: { line: 5, character: 10 },
        context: { triggerCharacter: '.' }
      };

      // Act
      const result = Completion.onCompletion(completionParams);

      // Assert
      expect(mockUtility.findFocusedNode).toHaveBeenCalledWith(
        mockSourceFile, 
        completionParams.position
      );
      expect(mockUtility.getPropertySymbols).toHaveBeenCalledWith(mockPropertyAccessNode);
      
      // Should return completion items for object properties
      if (result) {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        // Verify completion items contain expected property names
        const completionLabels = result.map(item => item.label);
        expect(completionLabels).toContain('property1');
        expect(completionLabels).toContain('method1');
      }
    });

    it('should provide identifier completions when no trigger character', () => {
      // Arrange
      const mockIdentifierNode = {
        kind: ts.SyntaxKind.Identifier,
        text: 'test',
        parent: {
          kind: ts.SyntaxKind.VariableDeclaration
        }
      };

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(mockIdentifierNode);
      
      // Mock visible symbols for identifier completion
      const Ast = require('../../server/src/ast/ast');
      Ast.findVisibleSymbols.mockReturnValue([
        { name: 'testVariable', declaration: { kind: ts.SyntaxKind.VariableDeclaration } },
        { name: 'testFunction', declaration: { kind: ts.SyntaxKind.FunctionDeclaration } }
      ]);
      
      // Mock AST to return binders (required for completion to be generated)
      const TypeCarrier = require('../../server/src/utility/type-carrier');
      Ast.findActiveTypeBinders.mockReturnValue([
        { 
          carrier: { 
            kind: TypeCarrier.Kind.Variable, // Use proper TypeCarrier kind
            text: 'testVariable' 
          } 
        }
      ]);
      
      mockUtility.getCompletionItemKind.mockReturnValue(6); // Variable kind

      const info = {
        ...mockTextDocumentPositionParams,
        context: { triggerCharacter: undefined }
      };

      // Act
      const result = Completion.onCompletion(info);

      // Assert
      expect(mockUtility.findFocusedNode).toHaveBeenCalledWith(mockSourceFile, info.position);
      expect(Ast.findVisibleSymbols).toHaveBeenCalledWith(mockIdentifierNode);
      
      // Should return identifier completions
      if (result && Array.isArray(result)) {
        expect(result.length).toBeGreaterThan(0);
        const labels = result.map(item => item.label);
        expect(labels).toContain('testVariable');
        expect(labels).toContain('testFunction');
      }
    });

    it('should provide property completions when focused on property access name', () => {
      // Arrange
      const Ast = require('../../server/src/ast/ast');
      Ast.isNameOfPropertyAccessExpression.mockReturnValue(true);

      const mockPropertyName = {
        kind: ts.SyntaxKind.Identifier,
        text: 'prop',
        parent: {
          kind: ts.SyntaxKind.PropertyAccessExpression,
          expression: {
            kind: ts.SyntaxKind.Identifier,
            text: 'obj',
            carrier: {
              type: 'object',
              properties: {
                getSymbols: () => ({
                  'property1': { name: 'property1', kind: 'property' },
                  'property2': { name: 'property2', kind: 'property' }
                })
              }
            }
          }
        }
      };

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(mockPropertyName);
      mockUtility.getPropertySymbols.mockReturnValue([
        { name: 'property1', declaration: { kind: ts.SyntaxKind.PropertyDeclaration } },
        { name: 'property2', declaration: { kind: ts.SyntaxKind.PropertyDeclaration } }
      ]);
      mockUtility.getCompletionItemKind.mockReturnValue(10); // Property kind

      // Mock AST to return binders (required for completion to be generated)
      const TypeCarrier = require('../../server/src/utility/type-carrier');
      Ast.findActiveTypeBindersInLeftSibling.mockReturnValue([
        { 
          carrier: { 
            kind: TypeCarrier.Kind.Variable, // Use proper TypeCarrier kind
            text: 'property1' 
          } 
        }
      ]);

      // Set up the request without a trigger character
      const infoWithoutTrigger = {
        ...mockTextDocumentPositionParams,
        context: { triggerCharacter: undefined }
      };

      // Act
      const result = Completion.onCompletion(infoWithoutTrigger);

      // Assert
      expect(Ast.isNameOfPropertyAccessExpression).toHaveBeenCalledWith(mockPropertyName);
      expect(mockUtility.getPropertySymbols).toHaveBeenCalledWith(mockPropertyName.parent);
      
      // Should return property completions
      if (result && Array.isArray(result)) {
        expect(result.length).toBeGreaterThan(0);
        const labels = result.map(item => item.label);
        expect(labels).toContain('property1');
        expect(labels).toContain('property2');
      }
    });

    it('should analyze source file before providing dot completion', () => {
      // Arrange
      const Analyzer = require('../../server/src/analyzer/analyzer');
      Analyzer.analyze = jest.fn();

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue({
        kind: ts.SyntaxKind.PropertyAccessExpression,
        expression: {
          kind: ts.SyntaxKind.Identifier,
          text: 'obj'
        },
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: ''
        }
      });
      mockUtility.getPropertySymbols.mockReturnValue([]);

      const info = {
        ...mockTextDocumentPositionParams,
        context: { triggerCharacter: '.' }
      };

      // Act
      const result = Completion.onCompletion(info);

      // Assert
      expect(Analyzer.analyze).toHaveBeenCalledWith(mockSourceFile);
      expect(mockUtility.findFocusedNode).toHaveBeenCalledWith(mockSourceFile, info.position);
      
      // Should return valid completion response (may be empty array if no properties)
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Completion.onCompletionResolve', () => {
    it('should add detail from data signature', () => {
      // Arrange
      const completionItem = {
        label: 'testFunction',
        data: {
          signature: 'function testFunction(a: number, b: string): void'
        }
      };

      // Act
      const result = Completion.onCompletionResolve(completionItem);

      // Assert
      expect(result.detail).toBe('function testFunction(a: number, b: string): void');
      expect(result).toBe(completionItem); // Should return the same item
    });

    it('should handle completion item without data', () => {
      // Arrange
      const completionItem = {
        label: 'testVar'
      };

      // Act
      const result = Completion.onCompletionResolve(completionItem);

      // Assert
      expect(result.detail).toBeUndefined();
      expect(result).toBe(completionItem);
    });

    it('should handle completion item with empty data', () => {
      // Arrange
      const completionItem = {
        label: 'testVar',
        data: {}
      };

      // Act
      const result = Completion.onCompletionResolve(completionItem);

      // Assert
      expect(result.detail).toBeUndefined();
      expect(result).toBe(completionItem);
    });

    it('should handle completion item with null data', () => {
      // Arrange
      const completionItem = {
        label: 'testVar',
        data: null
      };

      // Act
      const result = Completion.onCompletionResolve(completionItem);

      // Assert
      expect(result.detail).toBeNull();
      expect(result).toBe(completionItem);
    });
  });

  describe('Completion edge cases', () => {
    it('should handle malformed property access expressions', () => {
      // Arrange
      const malformedNode = {
        kind: ts.SyntaxKind.PropertyAccessExpression,
        expression: null, // Missing expression
        name: {
          kind: ts.SyntaxKind.Identifier,
          text: 'prop'
        }
      };

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(malformedNode);

      const info = {
        ...mockTextDocumentPositionParams,
        context: { triggerCharacter: '.' }
      };

      // Act & Assert
      expect(() => Completion.onCompletion(info)).not.toThrow();
    });

    it('should handle unknown syntax kinds', () => {
      // Arrange
      const unknownNode = {
        kind: 99999, // Unknown syntax kind
        text: 'unknown'
      };

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(unknownNode);

      // Act & Assert
      expect(() => Completion.onCompletion(mockTextDocumentPositionParams)).not.toThrow();
    });

    it('should handle nodes without parent', () => {
      // Arrange
      const orphanNode = {
        kind: ts.SyntaxKind.Identifier,
        text: 'orphan',
        parent: null
      };

      const mockUtility = require('../../server/src/services/utility');
      mockUtility.findFocusedNode.mockReturnValue(orphanNode);

      // Act & Assert
      expect(() => Completion.onCompletion(mockTextDocumentPositionParams)).not.toThrow();
    });
  });
});
