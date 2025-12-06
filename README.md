# iSense

![CI](https://github.com/ntoulasm/isense/actions/workflows/ci.yml/badge.svg)

**Intelligent Code Analysis for JavaScript without Type Annotations**

iSense is an experimental Visual Studio Code extension that provides IntelliSense capabilities for JavaScript code **without requiring TypeScript or JSDoc annotations**. It uses advanced static analysis, type inference, and flow-sensitive analysis to understand your JavaScript code and provide intelligent code completion, hover information, and diagnostics.

## The Problem It Solves

Traditional JavaScript IntelliSense relies heavily on:

- TypeScript type annotations
- JSDoc comments
- Type definition files (`.d.ts`)

**iSense takes a different approach**: It analyzes your pure JavaScript code to infer types, track data flow, and understand program behavior through:

- **Abstract interpretation** of code execution paths
- **Flow-sensitive type analysis** that tracks how types change through control flow
- **Heuristic-based inference** from usage patterns
- **AST-based analysis** using TypeScript's parser

This makes iSense particularly useful for:

- Legacy JavaScript codebases without type annotations
- Rapid prototyping where adding types slows development
- Learning projects where you want helpful suggestions without ceremony
- Understanding how type inference works under the hood

## High-Level Features

### 🎯 Core IntelliSense Features

- **Code Completion**: Context-aware suggestions for variables, properties, and functions
- **Signature Help**: Parameter hints for function calls with inferred types
- **Hover Information**: Type information on hover, even for untyped code
- **Go to Definition**: Navigate to symbol declarations
- **Document Outline**: Hierarchical view of code structure
- **Diagnostics**: Error detection (e.g., assignment to const variables)
- **Code Actions**: Quick fixes for common issues

### 🔍 Advanced Analysis Capabilities

- **Parameter Type Inference**: Infers parameter types from how they're used
- **Return Type Inference**: Deduces return types from function bodies
- **Property Tracking**: Tracks dynamic property assignments on objects
- **Control Flow Analysis**: Understands `if`, `switch`, loops, and early returns
- **Constructor Analysis**: Handles both ES6 classes and function constructors
- **Scope Analysis**: Tracks function-scoped and block-scoped declarations
- **Call Graph Analysis**: Analyzes function calls to propagate type information

## How It Differs from Standard IntelliSense

| Feature                 | Standard JS IntelliSense     | iSense                             |
| ----------------------- | ---------------------------- | ---------------------------------- |
| **Requires types**      | Yes (TypeScript, JSDoc)      | No - pure JavaScript               |
| **Type inference**      | Basic, relies on annotations | Advanced flow-sensitive analysis   |
| **Control flow**        | Limited                      | Tracks through conditionals, loops |
| **Parameter inference** | Minimal                      | Infers from usage patterns         |
| **Dynamic properties**  | Requires declaration         | Tracks assignments                 |
| **Analysis approach**   | Type checker                 | Abstract interpreter               |

### Key Technical Differences

1. **Flow-Sensitive Analysis**: iSense tracks how types change through your program:

    ```javascript
    let x = 5; // iSense knows x: number
    if (condition) {
        x = 'hello'; // iSense knows x: string here
    }
    // iSense knows x: number | string here
    ```

2. **Heuristic Type Inference**: Infers parameter types from operations:

    ```javascript
    function add(a, b) {
        return a + b; // iSense infers a, b likely: number from + operator
    }
    ```

3. **Property Tracking**: Follows dynamic property creation:
    ```javascript
    const obj = {};
    obj.name = 'test'; // iSense tracks that obj has property 'name'
    obj.na; // Suggests 'name'
    ```

## Example Usage

### Variable Type Inference

```javascript
const num = 42; // Inferred as number
const str = 'hello'; // Inferred as string
const arr = [1, 2, 3]; // Inferred as array
const obj = { x: 10 }; // Inferred as object with property x
```

### Function Parameter Inference

```javascript
function multiply(a, b) {
    return a * b; // Parameters inferred as number from * operator
}

function greet(name) {
    console.log('Hello ' + name); // name inferred as string from concatenation
}
```

### Control Flow Tracking

```javascript
function process(value) {
    if (typeof value === 'number') {
        return value * 2; // value known as number here
    } else if (typeof value === 'string') {
        return value.toUpperCase(); // value known as string here
    }
}
```

### Class and Constructor Tracking

```javascript
class Point {
    constructor(x, y) {
        this.x = x; // iSense tracks Point instances have x, y
        this.y = y;
    }
}

const p = new Point(10, 20);
p.x; // iSense suggests x and y properties
```

## Current State of the Project

### ✅ Working Features

- AST parsing and traversal using TypeScript compiler API
- Symbol table and scope management
- Type inference for primitives, objects, arrays, functions
- Flow-sensitive type binding and tracking
- Code completion for variables and properties
- Signature help for function calls
- Go to definition
- Document outline/symbols
- Basic diagnostics
- Test infrastructure with unit, integration, and performance tests

### ⚠️ Limitations & Known Issues

- **Incomplete AST replication**: The `replicator.js` has 50+ TODOs for unimplemented node types
- **Limited type operations**: Array type conversions, some type coercions incomplete
- **No union type refinement**: Doesn't narrow union types in all branches
- **Performance**: Reanalyzes on every completion request (should cache)
- **No persistent metadata**: Call site metadata not yet saved
- **Missing refactorings**: Code action system is minimal
- **Limited ES6+ support**: Some modern JavaScript features not fully handled

### 🚧 Work in Progress

- Enhanced parameter type inference from call sites
- Better handling of recursive assignments
- Improved diagnostic messages
- Performance optimizations
- Extended language feature support

## Installation & Development

### Prerequisites

- Node.js 14+
- Visual Studio Code 1.52+

### Setup

```bash
# Install dependencies
npm install

# Open in VS Code
code .

# Press F5 to launch Extension Development Host
```

### Disable Built-in TypeScript Extension

In the Extension Development Host:

1. Open Extensions view (View → Extensions)
2. Search `@builtin typescript`
3. Disable "TypeScript and JavaScript Language Features"
4. Reload VS Code

### Running Tests

```bash
cd test
npm install
node run-tests.js              # All tests
node run-tests.js --unit       # Unit tests only
node run-tests.js --coverage   # With coverage report
```

## Architecture Overview

```
isense/
├── client/              # VS Code extension client
│   └── src/
│       └── extension.js # Extension activation & language client
├── server/              # Language server
│   └── src/
│       ├── server.js        # LSP server & request handlers
│       ├── analyzer/        # Static analysis engine
│       │   ├── analyzer.js      # Main analysis orchestrator
│       │   ├── binder.js        # Symbol binding & scopes
│       │   └── call.js          # Call graph metadata
│       ├── ast/             # AST manipulation
│       │   ├── ast.js           # AST utilities & queries
│       │   └── replicator.js    # AST cloning for analysis
│       ├── services/        # LSP service implementations
│       │   ├── completion.js
│       │   ├── signature-help.js
│       │   ├── hover.js
│       │   ├── definition.js
│       │   └── code-action.js
│       └── utility/         # Core data structures
│           ├── type-info.js     # Type representation
│           ├── type-carrier.js  # Type propagation
│           ├── symbol.js        # Symbol utilities
│           └── symbol-table.js  # Symbol storage
├── examples/            # Test cases for manual verification
└── test/               # Automated test suite
    ├── unit/
    ├── integration/
    └── performance/
```

## Technology Stack

- **Runtime**: Node.js
- **Parser**: TypeScript Compiler API (`typescript` package)
- **Protocol**: Language Server Protocol (LSP)
- **Client**: VS Code Extension API
- **Testing**: Jest

## Contributing

This is an experimental research project exploring type inference for JavaScript. Contributions welcome, especially in:

- Improving type inference accuracy
- Adding support for more JavaScript patterns
- Performance optimizations
- Test coverage
- Documentation

## License

MIT License - see [LICENSE](LICENSE) file

## Acknowledgments

iSense uses the TypeScript compiler's parser but implements its own type analysis system. It's inspired by academic research in abstract interpretation and type inference for dynamic languages.
