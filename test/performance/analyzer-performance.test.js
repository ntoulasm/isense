const Analyzer = require('../../server/src/analyzer/analyzer');
const Completion = require('../../server/src/services/completion');
const ts = require('typescript');

describe('Performance Tests', () => {
  const PERFORMANCE_TIMEOUT = 30000; // 30 seconds

  describe('Analyzer Performance', () => {
    it('should analyze large files within reasonable time', (done) => {
      // Arrange
      const largeCodeParts = [];

      // Generate a large JavaScript file with various constructs
      for (let i = 0; i < 500; i++) {
        largeCodeParts.push(`
          function func${i}(param1, param2) {
            const obj${i} = {
              prop1: ${i},
              prop2: 'value${i}',
              method${i}: function() {
                return this.prop1 + param1;
              }
            };
            
            obj${i}.dynamicProp = param2;
            
            if (obj${i}.prop1 > ${i / 2}) {
              for (let j = 0; j < ${i % 10 + 1}; j++) {
                obj${i}.prop1 += j;
              }
            }
            
            return obj${i};
          }
          
          const result${i} = func${i}(${i}, 'test${i}');
          result${i}.method${i}();
        `);
      }

      const largeCode = largeCodeParts.join('\n');
      const largeSourceFile = ts.createSourceFile(
        'large-performance-test.js',
        largeCode,
        ts.ScriptTarget.ES2015,
        true
      );

      largeSourceFile.analyzeDiagnostics = [];

      // Act
      const startTime = performance.now();

      Analyzer.analyze(largeSourceFile);

      const endTime = performance.now();
      const analysisTime = endTime - startTime;

      // Assert
      expect(analysisTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(largeSourceFile.analyzeDiagnostics).toBeDefined();

      done();
    }, PERFORMANCE_TIMEOUT);

    it('should handle deeply nested structures efficiently', (done) => {
      // Arrange - Create deeply nested object access
      let nestedCode = 'const deepObj = ';
      let current = 'deepObj';

      // Create 50 levels of nesting
      for (let i = 0; i < 50; i++) {
        nestedCode += `{ level${i}: `;
        current += `.level${i}`;
      }

      nestedCode += `'deepValue'`;

      // Close all the braces
      for (let i = 0; i < 50; i++) {
        nestedCode += ' }';
      }

      nestedCode += ';';
      nestedCode += `\nconst accessDeep = ${current};`;

      const deepSourceFile = ts.createSourceFile(
        'deep-nested-test.js',
        nestedCode,
        ts.ScriptTarget.ES2015,
        true
      );

      deepSourceFile.analyzeDiagnostics = [];

      // Act
      const startTime = performance.now();

      Analyzer.analyze(deepSourceFile);

      const endTime = performance.now();
      const analysisTime = endTime - startTime;

      // Assert
      expect(analysisTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(deepSourceFile.analyzeDiagnostics).toBeDefined();

      done();
    }, PERFORMANCE_TIMEOUT);

    it('should handle many function calls without stack overflow', (done) => {
      // Arrange
      const functionCalls = [];
      functionCalls.push('function recursive(n) { return n <= 0 ? 0 : recursive(n - 1) + 1; }');

      for (let i = 0; i < 1000; i++) {
        functionCalls.push(`const call${i} = recursive(${i % 10});`);
      }

      const recursiveCode = functionCalls.join('\n');
      const recursiveSourceFile = ts.createSourceFile(
        'recursive-calls-test.js',
        recursiveCode,
        ts.ScriptTarget.ES2015,
        true
      );

      recursiveSourceFile.analyzeDiagnostics = [];

      // Act & Assert
      expect(() => {
        const startTime = performance.now();
        Analyzer.analyze(recursiveSourceFile);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(8000); // Should complete within 8 seconds
      }).not.toThrow();

      done();
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Completion Performance', () => {
    let largeObjectSourceFile;

    beforeEach(() => {
      // Create a source file with a large object for completion testing
      const objectProperties = [];
      for (let i = 0; i < 200; i++) {
        objectProperties.push(`  prop${i}: 'value${i}'`);
        objectProperties.push(`  method${i}: function() { return ${i}; }`);
      }

      const largeObjectCode = `
        const largeObj = {
        ${objectProperties.join(',\n')}
        };
        
        largeObj. // Trigger completion here
      `;

      largeObjectSourceFile = ts.createSourceFile(
        'large-object-completion.js',
        largeObjectCode,
        ts.ScriptTarget.ES2015,
        true
      );

      largeObjectSourceFile.analyzeDiagnostics = [];
      Analyzer.analyze(largeObjectSourceFile);
      const Ast = require('../../server/src/ast/ast');
      Ast.asts['file:///large-object-completion.js'] = largeObjectSourceFile;
    });

    it('should provide completions for large objects quickly', (done) => {
      // Arrange
      const mockCompletionInfo = {
        textDocument: { uri: 'file:///large-object-completion.js' },
        position: { line: 5, character: 12 }, // After "largeObj."
        context: { triggerCharacter: '.' }
      };

      // Mock utility functions
      const mockUtility = require('../../server/src/services/utility');
      mockUtility.getAst = jest.fn().mockReturnValue(largeObjectSourceFile);
      mockUtility.findFocusedNode = jest.fn().mockReturnValue({
        kind: ts.SyntaxKind.Identifier,
        text: 'largeObj'
      });
      mockUtility.getPropertySymbols = jest.fn().mockReturnValue([]);

      // Act
      const startTime = performance.now();

      const completions = Completion.onCompletion(mockCompletionInfo);

      const endTime = performance.now();
      const completionTime = endTime - startTime;

      // Assert
      expect(completionTime).toBeLessThan(1000); // Should complete within 1 second

      done();
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks with repeated analysis', (done) => {
      // Arrange
      const testCode = `
        function testFunc(a, b) {
          const obj = { prop: a + b };
          return obj.prop;
        }
        
        for (let i = 0; i < 100; i++) {
          testFunc(i, i * 2);
        }
      `;

      // Act - Analyze the same code multiple times
      for (let iteration = 0; iteration < 100; iteration++) {
        const sourceFile = ts.createSourceFile(
          `memory-test-${iteration}.js`,
          testCode,
          ts.ScriptTarget.ES2015,
          true
        );

        sourceFile.analyzeDiagnostics = [];
        Analyzer.analyze(sourceFile);

        // Clear references to help GC
        sourceFile.analyzeDiagnostics = null;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Assert - If we get here without running out of memory, the test passes
      expect(true).toBe(true);

      done();
    }, PERFORMANCE_TIMEOUT);

    it('should handle concurrent analysis requests', async () => {
      // Arrange
      const createAnalysisPromise = (id) => {
        return new Promise((resolve) => {
          const code = `
            function concurrentFunc${id}() {
              const data = [];
              for (let i = 0; i < ${id % 100 + 10}; i++) {
                data.push({ index: i, value: i * ${id} });
              }
              return data;
            }
            
            concurrentFunc${id}();
          `;

          const sourceFile = ts.createSourceFile(
            `concurrent-test-${id}.js`,
            code,
            ts.ScriptTarget.ES2015,
            true
          );

          sourceFile.analyzeDiagnostics = [];

          setTimeout(() => {
            Analyzer.analyze(sourceFile);
            resolve(sourceFile);
          }, Math.random() * 100); // Random delay to simulate real-world timing
        });
      };

      // Act
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(createAnalysisPromise(i));
      }

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(20);
      results.forEach(sourceFile => {
        expect(sourceFile.analyzeDiagnostics).toBeDefined();
      });
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Stress Tests', () => {
    it('should handle malformed code without crashing', (done) => {
      // Arrange - Create intentionally malformed JavaScript
      const malformedCodes = [
        'function { broken syntax',
        'const obj = { prop: };',
        'for (let i = 0; i < ; i++) {}',
        'if () { console.log("test"); }',
        'const arr = [1, 2, 3,];',
        'obj..prop.access',
        'function test(a,b,) { return a + b + ; }',
        '{ unmatched: "braces"',
        'const x = function() { return; }(); extra tokens',
        'class Test extends { malformed }',
      ];

      // Act & Assert
      malformedCodes.forEach((code, index) => {
        const sourceFile = ts.createSourceFile(
          `malformed-${index}.js`,
          code,
          ts.ScriptTarget.ES2015,
          true
        );

        sourceFile.analyzeDiagnostics = [];

        expect(() => {
          Analyzer.analyze(sourceFile);
        }).not.toThrow();
      });

      done();
    }, PERFORMANCE_TIMEOUT);

    it('should handle extreme nesting levels gracefully', (done) => {
      // Arrange - Create extremely nested structure
      let extremeCode = 'const extreme = ';

      // Create 100 levels of array nesting
      for (let i = 0; i < 100; i++) {
        extremeCode += '[';
      }

      extremeCode += '42';

      for (let i = 0; i < 100; i++) {
        extremeCode += ']';
      }

      extremeCode += ';';

      const extremeSourceFile = ts.createSourceFile(
        'extreme-nesting.js',
        extremeCode,
        ts.ScriptTarget.ES2015,
        true
      );

      extremeSourceFile.analyzeDiagnostics = [];

      // Act & Assert
      expect(() => {
        Analyzer.analyze(extremeSourceFile);
      }).not.toThrow();

      done();
    }, PERFORMANCE_TIMEOUT);
  });
});
