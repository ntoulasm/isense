# Sample JavaScript Files

# Example JavaScript Files

This directory contains various JavaScript files used for testing and demonstrating the iSense language server capabilities. These files serve as examples for manual testing of features like:

- Code completion
- Signature help  
- Go to definition
- Hover information
- Error diagnostics
- Code actions

## Organization

- **Root files**: Basic JavaScript examples covering common patterns
- **demo/**: Files specifically created for demonstrating language server features
- **rwt/**: Real-world test files that represent actual usage scenarios

## Usage

These example files can be opened in VS Code with the iSense extension to manually test and verify language server functionality. They complement the automated tests in the `test/` directory by providing interactive examples.

## How to Use

1. Open VS Code in the project root directory
2. Start the language server by running the extension (F5)
3. Open any of these sample files
4. Test language features like:
   - Hover for type information
   - Code completion (Ctrl+Space)
   - Go to definition (F12)
   - Signature help (Ctrl+Shift+Space)
   - Document outline (Ctrl+Shift+O)
   - Code actions (Ctrl+.)

## Sample Categories

### Basic Language Features
- **expressions.js** - Various expression types and operators
- **constructors.js** - Constructor functions and classes
- **block.js** - Block scoping examples
- **if_statement.js** - Conditional statements
- **for-statement.js** - Loop constructs
- **switch-statement.js** - Switch/case statements
- **return.js** - Return statement analysis

### Advanced Analysis
- **parameter-inference.js** - Function parameter type inference
- **dynamic_properties.js** - Dynamic property assignment
- **non_pure_functions.js** - Functions with side effects
- **recursive-assignment.js** - Complex recursive assignments

### Language Server Features
- **signature_help.js** - Function signature help examples
- **goto-definition.js** - Symbol definition examples
- **code-action.js** - Code action scenarios
- **outline.js** - Document symbol examples
- **import.js** - Import/export scenarios

### Demo Files
- **demo.js** - Main demonstration file
- **demo/** - Additional demo examples
- **test.js** - General testing scenarios
- **temp-test.js** - Temporary testing file

## Tips for Testing

1. **Hover Testing**: Hover over variables, functions, and properties to see type information
2. **Completion Testing**: Type partial identifiers and press Ctrl+Space
3. **Definition Testing**: Right-click on symbols and select "Go to Definition"
4. **Signature Help**: Type function names and opening parentheses to see parameter info
5. **Error Testing**: Introduce syntax errors to test error reporting

## Adding New Examples

When creating new example files:
- Focus on specific language features
- Include comments explaining the test scenarios
- Use realistic code patterns
- Test edge cases and complex scenarios

## Related Files

- `/test/` - Automated tests for memory management and performance
- `/server/` - Language server implementation
- `/client/` - VS Code extension client code
