# iSense Architecture

This document provides a detailed technical overview of iSense's architecture, module organization, data flow, and design decisions.

## System Overview

iSense is built on the **Language Server Protocol (LSP)** architecture, consisting of two main components:

1. **Client** (VS Code extension) - Communicates with VS Code
2. **Server** (Language server) - Performs analysis and provides IntelliSense features

```
┌─────────────────────────────────────┐
│       VS Code Application           │
│  ┌───────────────────────────────┐  │
│  │  iSense Extension (Client)    │  │
│  │  - Activates on .js files     │  │
│  │  - Manages language client    │  │
│  │  - Handles custom commands    │  │
│  └───────────────┬───────────────┘  │
└──────────────────┼──────────────────┘
                   │ LSP over IPC
        ┌──────────┼──────────┐
        │  Language Server     │
        │  ┌────────────────┐  │
        │  │  Request       │  │
        │  │  Handlers      │  │
        │  │  (server.js)   │  │
        │  └────┬───────────┘  │
        │       │              │
        │  ┌────▼───────────┐  │
        │  │   Analyzer     │  │
        │  │   Engine       │  │
        │  └────┬───────────┘  │
        │       │              │
        │  ┌────▼───────────┐  │
        │  │    Services    │  │
        │  │  (Completion,  │  │
        │  │  Hover, etc.)  │  │
        │  └────────────────┘  │
        └─────────────────────┘
```

## Module Breakdown

### Client Module (`/client`)

**Purpose**: VS Code extension interface

**Key File**: [`extension.js`](./client/src/extension.js)

**Responsibilities**:

- Activate when JavaScript files are opened
- Start the language server process
- Create and manage the language client connection
- Register custom commands:
    - `extension.generateDot` - Generate AST visualization
    - `extension.generateISenseDot` - Generate ISense-annotated AST
    - `extension.goToOffset` - Navigate by character offset
- Display status bar with current cursor offset
- Handle custom server notifications

**Data Flow**:

```
User Action → VS Code → Extension → Language Client → Language Server
                                                      ↓
                                    Response ← ← ← ← ←
```

### Server Module (`/server`)

The server is composed of several subsystems:

#### 1. Server Core (`server.js`)

**Purpose**: LSP protocol handler and orchestrator

**Key Responsibilities**:

- Initialize LSP connection and capabilities
- Handle document lifecycle (open, change, close)
- Parse JavaScript files into ASTs using TypeScript compiler
- Store ASTs in global `asts` object keyed by URI
- Dispatch LSP requests to service modules
- Manage diagnostics (parse errors and analysis warnings)
- Handle incremental text changes efficiently

**Data Structures**:

- `asts` - Map of file URIs to `ts.SourceFile` AST objects
- `documentSettings` - Per-document configuration cache
- Each AST is augmented with iSense-specific properties:
    - `ast.binders` - Type binding information
    - `ast.analyzeDiagnostics` - Analysis errors
    - `ast.symbolTable` - Symbol declarations

**Document Change Handling**:

```javascript
onDidChangeTextDocument(change) {
  1. Get existing AST for file
  2. Apply incremental text changes
  3. Reparse only if needed
  4. Clear outdated metadata
  5. Trigger reanalysis on next request
}
```

#### 2. Analyzer Subsystem (`/analyzer`)

**Purpose**: Static analysis and type inference engine

##### Core Components

###### [`analyzer.js`](./server/src/analyzer/analyzer.js)

**Purpose**: Main analysis orchestrator

**Key Functions**:

- `analyze(ast)` - Entry point for analyzing a source file
- `analyzeInternal(node)` - Recursive AST traversal and analysis
- `call(call, callee, thisObject)` - Function call simulation
- `newExpression(node)` - Constructor invocation handling
- `assign(node, symbol, carrier)` - Assignment and type binding
- `setProperty(node, object, name, rvalue, carrier)` - Property assignment tracking

**Analysis Strategy**:

1. **Binding Phase** (via Binder): Create symbol tables
2. **Analysis Phase**:
    - Traverse AST in execution order
    - Maintain call stack and function stack
    - Track control flow (if/switch statements)
    - Simulate function calls by replicating and analyzing callee body
    - Bind inferred types to symbols via TypeBinders
    - Detect unreachable code
    - Infer parameter types from usage

**Type Binding Mechanism**:

```javascript
// Every assignment creates a TypeBinder
const binder = {
  parent: assignmentNode,      // AST node where assignment occurs
  symbol: targetSymbol,         // Symbol being assigned to
  carrier: typeCarrier,         // Type information (constant, variable, expression)
  conditions: [...],            // Control flow conditions active at this point
  sideEffect: true/false        // Whether this has side effects
}
// Binders are attached to the scope node
node.binders.push(binder);
```

###### [`binder.js`](./server/src/analyzer/binder.js)

**Purpose**: Symbol table construction and scoping

**Key Functions**:

- `bindFunctionScopedDeclarations(body)` - Bind var declarations and functions
- `bindBlockScopedDeclarations(block)` - Bind let/const and class declarations
- `reset()` - Clear state between files

**Binding Strategy**:

- **Function-scoped**: `var`, function declarations, parameters
- **Block-scoped**: `let`, `const`, classes
- Creates symbols for all declarations
- Handles imports (ES6 modules)
- Generates anonymous names for unnamed functions/classes
- Initializes `binders` array on each scope

**Symbol Structure**:

```javascript
Symbol = {
  name: "variableName",
  declaration: astNode,           // Declaration site
  scope: scopeNode,               // Containing scope
  kind: ts.SyntaxKind.*,
  flags: Symbol.Flags.*
}
```

###### [`call.js`](./server/src/analyzer/call.js)

**Purpose**: Call site metadata management (partial implementation)

**Intended Use**: Track function calls for "go to call site" feature

- Stores call-to-callee mapping
- Updates on document changes
- Currently not fully integrated

##### Analysis Features

**Parameter Type Inference**:

```javascript
function example(x, y) {
	x + 1; // x inferred as number (from + operator)
	y.toUpperCase(); // y inferred as string (from method call)
}
```

Implementation:

- Detects operations on parameters (arithmetic, method calls)
- Creates "induced binders" with inferred types
- Checks if in original function (not in call simulation)

**Control Flow Tracking**:

- Tracks active conditions in `binder.conditions` array
- Handles `if`/`else`, `switch`, ternary operators
- Marks unreachable code after `return`, `break`, `continue`
- Types are narrowed based on active conditions

**Function Call Simulation**:

```
1. Clone callee function body (using Replicator)
2. Copy parameter types from call arguments
3. Define 'this' object
4. Analyze cloned body
5. Extract return type
6. Propagate side effects
```

#### 3. AST Subsystem (`/ast`)

##### [`ast.js`](./server/src/ast/ast.js)

**Purpose**: AST utilities and queries

**Key Capabilities**:

- **Symbol Resolution**:
    - `findVisibleSymbols(node)` - All symbols visible from a position
    - `lookUp(node, name)` - Resolve identifier to symbol
- **Type Binder Queries**:
    - `findActiveTypeBinders(node, symbol)` - Find type bindings for a symbol
    - Handle complex control flow (if/switch/loops)
    - Consider block scoping and shadowing
- **Node Navigation**:
    - `findInnerMostNode(ast, offset)` - Find node at cursor position
    - `findChildren(node)`, `findSiblings(node)`
    - `findLeftSibling(node)`, `findRightMostDescendant(node)`
- **AST Augmentation**:
    - `addTypeBinder(node, binder)` - Attach type binding
    - `addCallSite(callee, call)` - Track function calls
    - `addAnalyzeDiagnostic(ast, diagnostic)` - Record errors

**Active Type Binder Search Algorithm**:

```
findActiveTypeBinders(node, symbol):
  1. Start from current node
  2. Search left sibling for binders
  3. If in control flow (if/switch):
     - Check branch conditions
     - Search within branch
     - Search in previous branches
  4. Move up to parent scope
  5. Repeat until reaching function/file boundary
  6. Include binders from parent scopes
  7. Filter by control flow conditions
```

##### [`replicator.js`](./server/src/ast/replicator.js)

**Purpose**: Clone AST nodes for call simulation

**Why Needed**: When simulating a function call, we need to analyze the function body with the call-specific parameter types. Cloning allows isolated analysis without mutating the original AST.

**Key Functions**:

- `replicate(node, options)` - Clone any AST node
- `replicateNode(node, options)` - Generic node cloning
- `replicateNodeArray(nodes, options)` - Clone node arrays
- Handles 100+ TypeScript syntax kinds

**Options**:

- `setOriginal: true` - Link clone to original via `node.original`
- `onReplicate(original, clone)` - Callback after cloning
- Used to copy iSense metadata (binders, symbols)

**Current Issues**:

- 50+ TODOs for unimplemented node types
- Some TypeScript-specific constructs not handled
- "TODO: copy properties" comments for many node types

#### 4. Utility Subsystem (`/utility`)

##### [`type-info.js`](./server/src/utility/type-info.js)

**Purpose**: Type representation

**Type System**:

```javascript
TypeInfo.Type = {
	Class,
	Function,
	Number,
	String,
	Boolean,
	Array,
	Object,
	Undefined,
	Null,
	Any,
};

TypeInfo = {
	type: TypeInfo.Type,
	value: actualValue, // e.g., 42, "hello", true
	hasValue: boolean, // true if value is known
	properties: SymbolTable, // For Object type
	constructorName: string, // For Object type
};
```

**Type Operations**:

- `toNumber(info)`, `toString(info)`, `toBoolean(info)` - Type coercion
- `typeToString(info)` - Human-readable type name
- `hasUniqueType(typeInfoArray)` - Check for single unified type

##### [`type-carrier.js`](./server/src/utility/type-carrier.js)

**Purpose**: Type propagation and expression evaluation

**Carrier Types**:

```javascript
TypeCarrier.Kind = {
	Constant, // Literal values: 42, "hello"
	Variable, // Symbol references
	BinaryExpression, // a + b, x === y
	PrefixUnaryExpression, // -x, !flag
	PostfixUnaryExpression, // i++, j--
};
```

**Purpose**: Delay evaluation until needed

- **Constant carrier**: Already has type info
- **Variable carrier**: Needs symbol lookup + binder evaluation
- **Expression carrier**: Needs operand evaluation + operator logic

**Expression Evaluation**:

```javascript
evaluate(carrier):
  switch(carrier.kind):
    Constant: return carrier.info
    Variable:
      1. Find active binders for symbol
      2. Recursively evaluate each binder's carrier
      3. Combine results (union type)
    BinaryExpression:
      1. Evaluate left and right
      2. Apply operator semantics
      3. Return result type
    ...
```

**Operator Handling**:

- Arithmetic: `+`, `-`, `*`, `/`, `%` → number (usually)
- String `+`: string concatenation
- Comparison: `===`, `!==`, `<`, `>` → boolean
- Logical: `&&`, `||` → operand types
- Bitwise: `&`, `|`, `^` → number

##### [`symbol.js`](./server/src/utility/symbol.js) & [`symbol-table.js`](./server/src/utility/symbol-table.js)

**Purpose**: Symbol management

**Symbol Table**:

- Hash map from name to array of symbols (handles shadowing)
- Operations: `define`, `resolve`, `mergeInPlace`, `forEach`
- Used for scopes and object properties

**Symbol Properties**:

- Name, declaration node, scope, kind
- Flags: `Exported`, `FreeVariable`, `Parameter`, etc.

##### [`signature.js`](./server/src/utility/signature.js)

**Purpose**: Generate human-readable type signatures

**Example Output**:

```
variableName: number | string
functionName(x: number, y: string): boolean
```

Used in hover and completion detail text.

##### [`es5-lib.js`](./server/src/utility/es5-lib.js)

**Purpose**: Built-in JavaScript types and methods

- Parses ES5 lib definitions
- Provides `console`, `Math`, `Array.prototype`, etc.
- Used as reference for global symbols

##### Other Utilities

- [`stack.js`](./server/src/utility/stack.js) - Stack data structure
- [`utility.js`](./server/src/utility/utility.js) - Helper functions (format, toArray, etc.)
- [`dot-generator.js`](./server/src/utility/dot-generator.js) - AST visualization in DOT format

#### 5. Services Subsystem (`/services`)

LSP feature implementations that use the analyzer results.

##### [`completion.js`](./server/src/services/completion.js)

**Purpose**: Code completion suggestions

**Strategies**:

1. **Identifier Completion** (plain identifier context):
    - Find all visible symbols in scope
    - For each symbol, find active type binders
    - Generate completion items with inferred types

2. **Property Completion** (after `.` operator):
    - **IMPORTANT**: Triggers analysis on every `.` press (performance issue)
    - Get type of left-hand expression
    - If object type, get properties from symbol table
    - If array/string, suggest built-in methods
    - Find active binders for each property
    - Return completion items

**Completion Item**:

```javascript
{
  label: "variableName",
  kind: CompletionItemKind.Variable,  // or Function, Property, etc.
  data: {
    signature: "variableName: number | string"
  }
}
```

##### [`signature-help.js`](./server/src/services/signature-help.js)

**Purpose**: Parameter hints during function calls

**Process**:

1. Find innermost call expression at cursor
2. Identify callee (function being called)
3. Get function parameters
4. Find active type binders for each parameter
5. Compute parameter signatures
6. Determine which parameter is active (based on comma count)

**Output**:

```
functionName(param1: number, param2: string)
             ^^^^^^^
```

##### [`hover.js`](./server/src/services/hover.js)

**Purpose**: Type information on hover

**Process**:

1. Find node at cursor position
2. If identifier: resolve symbol, find binders, compute type
3. If number/string literal: show literal type
4. Format signature
5. Return as markdown hover content

##### [`definition.js`](./server/src/services/definition.js)

**Purpose**: Go to definition

**Process**:

1. Find identifier at cursor
2. Resolve to symbol
3. Get declaration node from symbol
4. Create location (file URI + range)
5. Filter out ES5 lib definitions

##### [`document-symbol.js`](./server/src/services/document-symbol.js)

**Purpose**: Document outline / breadcrumbs

**Process**:

1. Traverse AST
2. Collect functions, classes, variables
3. Create hierarchical symbol tree
4. Return as DocumentSymbol array

##### [`code-action.js`](./server/src/services/code-action.js)

**Purpose**: Quick fixes and refactorings

**Current Capabilities**: Minimal

- Infrastructure exists
- Most logic is TODO/commented out

##### [`utility.js`](./server/src/services/utility.js)

**Shared service utilities**:

- `getAst(info)` - Get AST from LSP request
- `findFocusedNode(ast, position)` - Get node at cursor
- `getSymbolOfIdentifier(node)` - Resolve identifier
- `getPropertySymbols(node)` - Get object properties
- `createRange(symbol)` - Convert node to LSP range

## Information Flow Through the System

### Code Completion Flow

```
1. User types '.' or requests completion
   ↓
2. VS Code sends textDocument/completion request
   ↓
3. server.js receives request
   ↓
4. Calls Completion.onCompletion(info)
   ↓
5. completion.js:
   - Gets AST for document
   - Finds node at cursor position
   - Determines context (identifier vs property)
   ↓
6. If property completion:
   - Calls Analyzer.analyze(ast)  ← RE-ANALYZES ENTIRE FILE!
   - Gets type of object before '.'
   - Retrieves properties from object type
   ↓
7. For each property/symbol:
   - Calls Ast.findActiveTypeBinders(node, symbol)
     - Searches scope hierarchy
     - Filters by control flow
   - Calls TypeCarrier.evaluate(binder.carrier) for each binder
     - Recursively evaluates type expressions
     - Returns TypeInfo array
   - Calls Signature.compute() to format type
   ↓
8. Returns completion items to client
   ↓
9. User sees suggestions in VS Code
```

### Type Inference Flow

```
1. File opened → parser creates AST
   ↓
2. analyzer.analyze(ast) called:
   ↓
   A. BINDING PHASE:
      - Binder.bindFunctionScopedDeclarations(ast)
      - Binder.bindBlockScopedDeclarations(ast)
      - Symbol tables created, all declarations recorded
   ↓
   B. ANALYSIS PHASE:
      - Define 'this' object for file scope
      - Call analyzeInternal(ast)
        - Recursive traversal
        - For each node type:

          VARIABLE DECLARATION:
          1. Get initializer expression
          2. Evaluate to type (via TypeCarrier)
          3. Create TypeBinder linking symbol to type
          4. Attach to scope node

          ASSIGNMENT:
          1. Resolve left-hand side (symbol or property)
          2. Evaluate right-hand side type
          3. Create binder
          4. Track in scope or object properties

          BINARY EXPRESSION:
          1. Infer parameter types if using parameters
          2. Create TypeCarrier for expression
          3. Expression can be evaluated later

          IF STATEMENT:
          1. Analyze condition
          2. Add condition to binder.conditions
          3. Analyze consequent
          4. Add negated condition
          5. Analyze alternate
          6. Merge types from branches

          FUNCTION CALL:
          1. Resolve callee symbol
          2. Get callee function declaration
          3. Clone function body (Replicator)
          4. Copy argument types to parameters
          5. Analyze cloned body
          6. Extract return type from binders
          7. Create binder for call expression

          CLASS/CONSTRUCTOR:
          1. Create 'this' object (TypeInfo.createObject)
          2. Analyze body
          3. Track properties assigned to 'this'
          4. Return 'this' object as instance type
   ↓
3. AST now has binders attached to all scopes
   ↓
4. Service queries binders to answer requests
```

## How JavaScript is Analyzed Without Types

iSense uses several techniques to infer types from untyped JavaScript:

### 1. Literal Value Tracking

```javascript
const x = 42; // TypeInfo.createNumber(42) - knows value!
const s = 'hello'; // TypeInfo.createString("hello")
```

### 2. Operator-Based Inference

```javascript
function add(a, b) {
	return a + b;
}
// Analysis sees: a and b used with +
// Heuristic: + with no string context → likely numbers
// Creates induced binder: a: number, b: number
```

### 3. Method Call Inference

```javascript
function upper(text) {
	return text.toUpperCase();
}
// Sees: text.toUpperCase()
// Knows: toUpperCase() is a String method
// Infers: text: string
```

### 4. Property Access Tracking

```javascript
const obj = {};
obj.name = 'John';
obj.age = 30;
// Creates object type with properties:
// obj: { name: string, age: number }
```

### 5. Constructor Tracking

```javascript
class Person {
	constructor(name) {
		this.name = name; // Track assignment to 'this'
	}
}
// Person instances have: { name: any }
```

### 6. Control Flow Narrowing

```javascript
function process(x) {
	if (typeof x === 'number') {
		// In this branch: x is narrowed to number type
		return x * 2;
	}
}
// Condition recorded in binder, type refined
```

### 7. Return Type Inference

```javascript
function calculate() {
	if (condition) {
		return 42; // number
	} else {
		return 'error'; // string
	}
}
// Result type: number | string (union)
```

### 8. Call-Site Propagation

```javascript
const result = add(10, 20);
// When analyzing add(), parameters get types from arguments
// Then result gets return type from add's analysis
```

## Heuristics and Scoring

iSense does **not** use machine learning or statistical scoring. Instead:

### Type Confidence

- **Has Value** (`hasValue: true`): High confidence (literal value known)
- **Unique Type** (`TypeInfo.hasUniqueType`): All binders agree on type
- **Union Type**: Multiple possible types (less confidence)
- **Any Type**: Unknown (no information)

### Binder Prioritization

When multiple binders exist for a symbol:

```javascript
function compareBinders(b1, b2) {
	return b1.parent.end - b2.parent.end;
}
// Later binders (closer to current position) sorted first
```

### Induced vs. Explicit Binders

- **Explicit**: From actual assignments → higher priority
- **Induced**: From heuristics (operator usage) → lower priority
- Code checks: `hasInducedBinders(binders)` to prefer explicit

## File Layout Explanation

```
isense/
│
├── client/                          # VS Code Extension
│   ├── src/extension.js             # Extension main, language client setup
│   └── package.json                 # Client dependencies
│
├── server/                          # Language Server
│   ├── src/
│   │   ├── server.js                # LSP server, document lifecycle, handlers
│   │   │
│   │   ├── analyzer/                # Analysis Engine
│   │   │   ├── analyzer.js          # Main analyzer, call simulation
│   │   │   ├── binder.js            # Symbol binding and scopes
│   │   │   ├── call.js              # Call graph metadata (partial)
│   │   │   ├── analyze-diagnostic.js # Diagnostic creation utilities
│   │   │   ├── diagnostic-codes.js  # Error code constants
│   │   │   ├── diagnostic-messages.js # Error message templates
│   │   │   └── implicit-return-detector.js # Detects missing returns
│   │   │
│   │   ├── ast/                     # AST Manipulation
│   │   │   ├── ast.js               # AST utilities, symbol/binder queries
│   │   │   ├── replicator.js        # AST cloning for call simulation
│   │   │   ├── ast-dot-generator.js # AST → GraphViz DOT
│   │   │   └── ist-dot-generator.js # iSense AST → DOT (with types)
│   │   │
│   │   ├── services/                # LSP Service Implementations
│   │   │   ├── completion.js        # Code completion
│   │   │   ├── signature-help.js    # Parameter hints
│   │   │   ├── hover.js             # Hover type information
│   │   │   ├── definition.js        # Go to definition
│   │   │   ├── document-symbol.js   # Document outline
│   │   │   ├── code-action.js       # Quick fixes (minimal)
│   │   │   └── utility.js           # Shared service utilities
│   │   │
│   │   ├── utility/                 # Core Data Structures
│   │   │   ├── type-info.js         # Type representation
│   │   │   ├── type-carrier.js      # Type propagation and evaluation
│   │   │   ├── symbol.js            # Symbol structure and utilities
│   │   │   ├── symbol-table.js      # Symbol storage (hash map)
│   │   │   ├── type-binder.js       # Type binding structure
│   │   │   ├── signature.js         # Type signature formatting
│   │   │   ├── stack.js             # Stack data structure
│   │   │   ├── utility.js           # Helper functions
│   │   │   ├── es5-lib.js           # Built-in JS types
│   │   │   └── dot-generator.js     # GraphViz utilities
│   │   │
│   │   └── primitive-type-info/
│   │       └── number-methods.js    # Number.prototype methods
│   │
│   └── package.json                 # Server dependencies
│
├── examples/                        # Test Cases for Manual Verification
│   ├── README.md                    # Usage guide
│   ├── demo/                        # Demo files
│   ├── rwt/                         # Real-world test cases
│   └── *.js                         # Various feature examples
│
├── test/                            # Automated Test Suite
│   ├── unit/                        # Unit tests for individual modules
│   ├── integration/                 # End-to-end workflow tests
│   ├── performance/                 # Performance benchmarks
│   ├── jest.config.js               # Test runner configuration
│   ├── setup.js                     # Test environment setup
│   ├── run-tests.js                 # Custom test runner
│   └── README.md                    # Test documentation
│
├── .vscode/                         # VS Code workspace settings
├── package.json                     # Root package (extension manifest)
├── README.md                        # Project overview
├── CHANGELOG.md                     # Version history
└── LICENSE                          # GPL-3.0 license
```

### Key Module Dependencies

```
server.js
  ↓
  ├─→ Analyzer (analyzer.js)
  │     ├─→ Binder (binder.js)
  │     ├─→ Ast (ast.js)
  │     │     └─→ SymbolTable, Symbol
  │     ├─→ Replicator (replicator.js)
  │     ├─→ TypeInfo, TypeCarrier
  │     └─→ AnalyzeDiagnostic
  │
  └─→ Services
        ├─→ Completion → Analyzer, Ast, TypeCarrier, Signature
        ├─→ SignatureHelp → Analyzer, Ast, TypeCarrier, Signature
        ├─→ Hover → Ast, Signature
        ├─→ Definition → Ast, Symbol
        ├─→ DocumentSymbol → Ast
        └─→ CodeAction → Ast, AnalyzeDiagnostic
```

## Design Patterns & Principles

### 1. **AST Augmentation Pattern**

Rather than creating parallel data structures, iSense augments TypeScript's AST nodes:

```javascript
node.binders = [...];       // Type bindings
node.symbolTable = {...};   // Symbol declarations
node.iSenseSymbol = {...};  // Symbol metadata
```

### 2. **Lazy Evaluation via Type Carriers**

Don't evaluate types until needed:

```javascript
// Instead of: type = evaluate(a + b) immediately
// Use: carrier = createBinaryExpression(a, +, b)
// Evaluate only when: TypeCarrier.evaluate(carrier)
```

### 3. **Flow-Sensitive Binding**

Types are bound to program points, not symbols globally:

```javascript
let x = 5; // Binder 1: x → number (at line 1)
if (condition) {
	x = 'hello'; // Binder 2: x → string (at line 3, if condition)
}
// To get type of x: find active binders considering control flow
```

### 4. **Call Simulation via Cloning**

Analyze function calls polymorphically:

- Clone function body
- Inject call-specific parameter types
- Analyze clone in isolation
- Extract return type
- Don't mutate original

### 5. **Symbol Table Hierarchy**

Scopes form a tree:

```
File Scope
  ├─ Function Scope
  │    ├─ Block Scope (if statement)
  │    └─ Block Scope (for loop)
  └─ Function Scope
```

Symbol resolution walks up the tree.

## Performance Characteristics

### Bottlenecks

1. **Full Re-analysis on Property Completion**:
    - Currently: `Analyzer.analyze(ast)` called on every `.` press
    - Should: Analyze once, cache results, invalidate on change

2. **Call Simulation Overhead**:
    - Cloning AST is expensive
    - Deep recursion for nested calls
    - No memoization of call results

3. **Binder Search Complexity**:
    - For each symbol reference, search all parent scopes
    - For each scope, filter by control flow
    - O(scopes × binders) per query

4. **No Incremental Analysis**:
    - Text edits invalidate entire file analysis
    - Should: Only re-analyze affected scopes

### Optimization Opportunities

1. **Caching**:
    - Cache analysis results per file
    - Cache TypeCarrier evaluations
    - Cache symbol resolution

2. **Incremental Analysis**:
    - Track which scopes are affected by edits
    - Only re-analyze dirty scopes

3. **Demand-Driven Analysis**:
    - Don't analyze unused functions
    - Analyze on demand when referenced

4. **Call Graph Pruning**:
    - Limit call simulation depth
    - Detect recursive calls early

## Limitations

See [RISKS.md](RISKS.md) for detailed technical debt and architectural concerns.

### Known Issues

1. **Incomplete Replicator**: Many AST node types not handled
2. **No Union Type Refinement**: Type narrowing is basic
3. **Limited ES6+ Support**: Some modern features missing
4. **No Async/Await Analysis**: Promises not well understood
5. **No Module Resolution**: Import paths not followed
6. **Primitive Call Graph**: Call site tracking not used
7. **Minimal Diagnostics**: Only one error type implemented

## Future Architectural Improvements

1. **Persistent Analysis Cache**: Save analysis results to disk
2. **Incremental Parser**: Use TypeScript's incremental parsing
3. **Worker Thread Analysis**: Offload heavy analysis
4. **Streaming Analysis**: Analyze as file loads
5. **Constraint-Based Inference**: More sophisticated type inference
6. **Data Flow Analysis**: Track data dependencies
7. **Points-To Analysis**: Track object aliasing
