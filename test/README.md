# Quick Test Setup & Execution Guide

## Prerequisites

Ensure you have Node.js installed (version 14 or higher).

## Installation

```bash
cd test
npm install
```

## Quick Commands

### Run All Tests

```bash
cd test
node run-tests.js
```

### Run Specific Test Types

```bash
# Unit tests only (fast)
node run-tests.js --unit

# Integration tests only
node run-tests.js --integration

# Performance tests only
node run-tests.js --performance

# All tests with coverage report
node run-tests.js --coverage
```

### Run Individual Tests

```bash
# Working unit tests:
npx jest unit/symbol.test.js --no-coverage
npx jest unit/symbol-table.test.js --no-coverage
npx jest unit/type-info.test.js --no-coverage
npx jest unit/stack.test.js --no-coverage
```

### Development Mode

```bash
# Watch mode for active development
node run-tests.js --watch
```

### Direct Jest Commands

```bash
# Run specific test file
npx jest unit/symbol.test.js

# Run tests matching pattern
npx jest --testNamePattern="Symbol"

# Run with verbose output
npx jest --verbose

# Run with coverage
npx jest --coverage
```

## Expected Output

- ✅ All tests should pass (for working modules)
- 📊 Coverage should be >85% for core modules
- ⚡ Performance tests should complete within time limits
- 🐛 Error handling tests should verify graceful degradation

## Troubleshooting

### If tests fail to run:

1. Check Node.js version: `node --version` (should be 14+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check TypeScript is available: `npx tsc --version`

### If specific tests fail:

1. Run individual test: `npx jest path/to/failing-test.test.js`
2. Add `--verbose` flag for detailed output
3. Check mock setup in `setup.js`

### Jest Extension in VS Code:

1. Install "Jest" extension by Orta
2. Open test files to see inline test results
3. Use VS Code Test Explorer for visual test running
4. Run individual tests with the "Run" buttons that appear above test functions

### Performance test timeouts:

- Performance tests may take longer on slower machines
- Increase timeout in `jest.config.js` if needed
- Skip performance tests during development: `node run-tests.js --unit`

## Test Structure Overview

```
test/
├── unit/                    # Fast, isolated tests
├── integration/             # End-to-end workflow tests
├── performance/             # Stress and benchmark tests
├── setup.js                 # Test environment configuration
├── jest.config.js           # Jest test runner settings
└── run-tests.js             # Custom test runner script
```

### Run All Tests

```bash
cd test
node run-tests.js
```

### Run with VS Code Jest Extension

1. Open any `.test.js` file in VS Code
2. Look for "Run" and "Debug" buttons above each test
3. Click "Run" to execute individual tests
4. Use Test Explorer sidebar for overview

The test suite validates core functionality and provides a foundation for testing the complete language server as more implementations are added.

## Writing New Tests

### Unit Test Template

```javascript
const ModuleToTest = require("../../server/src/path/to/module");

describe("Module Name", () => {
  let mockData;

  beforeEach(() => {
    // Setup test data
    mockData = createMockData();
  });

  describe("function name", () => {
    it("should handle normal case", () => {
      // Arrange
      const input = "test input";

      // Act
      const result = ModuleToTest.functionName(input);

      // Assert
      expect(result).toBe("expected output");
    });

    it("should handle edge case", () => {
      // Test edge cases
    });
  });
});
```

### Integration Test Template

```javascript
describe("Feature Integration", () => {
  let testSourceFile;

  beforeEach(() => {
    // Create comprehensive test code
    const sourceCode = `/* test JavaScript code */`;
    testSourceFile = ts.createSourceFile(
      "test.js",
      sourceCode,
      ts.ScriptTarget.ES2015,
      true
    );
    testSourceFile.analyzeDiagnostics = [];
  });

  it("should handle complete workflow", () => {
    // Test full analysis pipeline
    Analyzer.analyze(testSourceFile);

    // Test service integrations
    const completions = Completion.onCompletion(mockInfo);

    expect(completions).toBeDefined();
  });
});
```

### Performance Test Template

```javascript
describe("Performance Test", () => {
  const TIMEOUT = 30000;

  it(
    "should complete within time limit",
    (done) => {
      // Arrange
      const largeInput = generateLargeInput();

      // Act
      const startTime = performance.now();
      performOperation(largeInput);
      const endTime = performance.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(5000);
      done();
    },
    TIMEOUT
  );
});
```


## Contributing

When adding new functionality:

1. **Write unit tests** for new modules/functions
2. **Add integration tests** for new language features
3. **Include performance tests** for critical paths
4. **Update documentation** with test descriptions
5. **Verify coverage** meets project standards