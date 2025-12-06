# iSense Suggestion Engine

This document provides a deep dive into how iSense's suggestion engine works internally, including parsing, analysis, type inference, and the handling of untyped JavaScript.

## Overview

The suggestion engine is the core of iSense. It transforms raw JavaScript source code into type-annotated suggestions through a multi-phase pipeline:

```
JavaScript Source
    ↓
[1] PARSING → AST (Abstract Syntax Tree)
    ↓
[2] BINDING → Symbol Tables & Scopes
    ↓
[3] ANALYSIS → Type Inference & Flow Tracking
    ↓
[4] QUERYING → Suggestion Generation
    ↓
IntelliSense Results
```

## Phase 1: Parsing

### Parser: TypeScript Compiler API

iSense uses TypeScript's parser (`typescript` npm package) to parse JavaScript:

```javascript
const ts = require('typescript');

const ast = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.ES2015, // Support ES6+
    true, // setParentNodes
    ts.ScriptKind.JS
);
```

**Why TypeScript's Parser?**

- Battle-tested, high-quality JavaScript parser
- Handles all JavaScript + JSX
- Provides rich AST with parent pointers
- Includes error recovery (partial ASTs for invalid code)
- Same parser used by VS Code's built-in JS support

**AST Structure**:

```javascript
// Example: const x = 5 + 3;
{
  kind: SyntaxKind.VariableStatement,
  declarationList: {
    kind: SyntaxKind.VariableDeclarationList,
    declarations: [{
      kind: SyntaxKind.VariableDeclaration,
      name: { kind: SyntaxKind.Identifier, text: "x" },
      initializer: {
        kind: SyntaxKind.BinaryExpression,
        left: { kind: SyntaxKind.NumericLiteral, text: "5" },
        operator: SyntaxKind.PlusToken,
        right: { kind: SyntaxKind.NumericLiteral, text: "3" }
      }
    }]
  }
}
```

### Parse Diagnostics

TypeScript parser provides syntax errors:

```javascript
if (ast.parseDiagnostics.length > 0) {
    // Convert to LSP diagnostics
    // Display in VS Code problems panel
}
```

iSense halts analysis if parse errors exist (can't reliably analyze broken AST).

## Phase 2: Binding

### Purpose: Create Symbol Tables

Before type inference, we need to know what symbols (variables, functions) exist and where they're declared.

### Binding Algorithm

Implemented in [`binder.js`](./server/src/analyzer/binder.js):

```
1. For each scope (function, block, file):

   A. Bind function-scoped declarations:
      - var declarations
      - function declarations
      - function parameters
      - imports
      → Add to scope's symbol table
      → Handle hoisting semantics

   B. Bind block-scoped declarations:
      - let/const declarations
      - class declarations
      → Add to block's symbol table
      → No hoisting

   C. Initialize binders array:
      scope.binders = [];
      // Will store type bindings during analysis

2. Recurse into nested scopes
```

### Symbol Structure

```javascript
Symbol = {
  name: "variableName",
  declaration: astNode,        // Where declared
  scope: scopeNode,            // Containing scope
  kind: ts.SyntaxKind.*,      // VariableDeclaration, etc.
  flags: {
    Exported: boolean,
    FreeVariable: boolean,     // Used but not declared locally
    Parameter: boolean
  }
}
```

### Example

```javascript
function outer(x) {
    // Scope 1 starts
    var y = 10;
    // Symbol Table for Scope 1:
    function inner(z) {
        // { x: param, y: var, inner: function }
        var w = 20; // Scope 2 starts
        return x + y + z + w; // Symbol Table for Scope 2:
    } // { z: param, w: var }
    return inner; // Scope 2 ends
} // Scope 1 ends
```

## Phase 3: Analysis & Type Inference

This is the heart of iSense. Implemented in [`analyzer.js`](./server/src/analyzer/analyzer.js).

### Analysis Strategy: Abstract Interpretation

iSense simulates code execution at an abstract level:

- Instead of running code, it tracks **possible types**
- Instead of concrete values, it tracks **type information**
- Control flow is explored, not executed

### Main Analysis Loop

```javascript
function analyzeInternal(node) {
    switch (node.kind) {
        case ts.SyntaxKind.VariableDeclaration:
            analyzeVariableDeclaration(node);
            break;

        case ts.SyntaxKind.BinaryExpression:
            analyzeBinaryExpression(node);
            break;

        case ts.SyntaxKind.CallExpression:
            analyzeCallExpression(node);
            break;

        case ts.SyntaxKind.IfStatement:
            analyzeIfStatement(node);
            break;

        case ts.SyntaxKind.PropertyAccessExpression:
            analyzePropertyAccessExpression(node);
            break;

        // ... 100+ more cases
    }

    ts.forEachChild(node, analyzeInternal); // Recurse
}
```

### Type Binding Mechanism

Every assignment creates a **TypeBinder**:

```javascript
TypeBinder = {
  parent: astNode,              // Assignment location
  symbol: Symbol,               // What's being assigned to
  carrier: TypeCarrier,         // Type information
  conditions: Condition[],      // Active control flow conditions
  sideEffect: boolean          // Has side effects?
}
```

**Why Binders?**

- Allows flow-sensitive typing (type changes over time)
- Tracks assignment history
- Associates types with program points, not just symbols

### Type Carriers: Delayed Evaluation

Instead of immediately computing types, create **carriers** that can be evaluated later:

```javascript
TypeCarrier = {
  kind: Constant | Variable | BinaryExpression | UnaryExpression,

  // For Constant:
  info: TypeInfo[],

  // For Variable:
  symbol: Symbol,
  node: AstNode,

  // For BinaryExpression:
  left: TypeCarrier,
  op: ts.SyntaxKind.*,
  right: TypeCarrier
}
```

**Evaluation**:

```javascript
TypeCarrier.evaluate(carrier) {
  switch(carrier.kind) {
    case Constant:
      return carrier.info;  // Already known

    case Variable:
      // Find all active binders for this symbol
      binders = Ast.findActiveTypeBinders(node, symbol);
      // Recursively evaluate each binder's carrier
      types = binders.flatMap(b => evaluate(b.carrier));
      return types;  // Union of all possibilities

    case BinaryExpression:
      leftTypes = evaluate(carrier.left);
      rightTypes = evaluate(carrier.right);
      // Apply operator semantics
      return applyOperator(leftTypes, carrier.op, rightTypes);
  }
}
```

### Type Inference by Example

#### Example 1: Variable Declaration

```javascript
const x = 42;
```

Analysis:

```
1. Visit VariableDeclaration node
2. Evaluate initializer (NumericLiteral)
   → TypeInfo.createNumber(42)
3. Create TypeCarrier.Constant with value 42
4. Create TypeBinder:
   - symbol: x
   - carrier: Constant(42)
   - parent: this declaration node
5. Attach binder to scope:
   scope.binders.push(binder)
```

#### Example 2: Binary Expression

```javascript
const sum = a + b;
```

Analysis:

```
1. Visit VariableDeclaration
2. Evaluate initializer (BinaryExpression)
3. Create TypeCarrier.BinaryExpression:
   - left: Variable(a)
   - op: PlusToken
   - right: Variable(b)
4. Create binder for 'sum' with this carrier
5. When queried later:
   evaluate(carrier) →
     leftTypes = evaluate(Variable(a)) → [number]
     rightTypes = evaluate(Variable(b)) → [number]
     apply + operator → [number]
   result: sum: number
```

#### Example 3: Parameter Inference

```javascript
function multiply(x, y) {
    return x * y;
}
```

Analysis:

```
1. Parameters x, y have no types initially
2. Encounter BinaryExpression: x * y
3. Operator * typically means numeric operation
4. Create "induced binder" for x:
   - carrier: Constant(TypeInfo.createNumber())
   - flags: induced = true
5. Create induced binder for y similarly
6. Return type inferred from return statement
```

This is a **heuristic**: `*` operator → probably numbers. Not always correct, but often useful.

#### Example 4: Control Flow

```javascript
let x = 5; // Binder 1: x = 5 (number)
if (condition) {
    x = 'hello'; // Binder 2: x = "hello" (string), condition: [condition === true]
}
console.log(x); // Query: x here
```

Analysis:

```
1. Binder 1 created at line 1, no conditions
2. Binder 2 created at line 3, conditions = [condition]
3. At line 5, find active binders:
   - Binder 1: active (no conditions)
   - Binder 2: active only if condition was true
4. Return union: number | string
```

#### Example 5: Function Call

```javascript
function greet(name) {
    return 'Hello, ' + name;
}
const msg = greet('Alice');
```

Analysis (call simulation):

```
1. Encounter CallExpression: greet("Alice")
2. Resolve callee: greet function
3. Clone function body (using Replicator)
4. Create binder for 'name' parameter:
   - carrier: Constant("Alice")
   - attach to cloned function
5. Analyze cloned body:
   - "Hello, " + name
   - "Hello, " is string
   - name is string (from binder)
   - + with string → concatenation
   - result: string
6. Find return statements in clone
7. Extract type from return: string
8. Create binder for msg:
   - carrier: Constant(string)
```

#### Example 6: Property Tracking

```javascript
const obj = {};
obj.x = 10;
obj.y = 'test';
```

Analysis:

```
1. obj initialized as empty object:
   TypeInfo.createObject()
   obj.type.properties = SymbolTable.create()

2. Assignment: obj.x = 10
   - Resolve obj: get object type
   - Get/create property symbol "x" in obj.type.properties
   - Create binder for obj.x with type number

3. Assignment: obj.y = "test"
   - Similar process
   - obj.type.properties now has: { x: Symbol, y: Symbol }

4. Later: obj.█ (completion)
   - Get obj type
   - Get properties from obj.type.properties
   - Suggest: x, y
```

## Phase 4: Query Processing

When VS Code requests suggestions, iSense queries the analyzed AST.

### Completion Query

```
1. User types: variable.█
2. Find node at cursor: PropertyAccessExpression
3. Get left side: variable
4. Evaluate type of variable:
   - Find active binders
   - Evaluate carriers
   - Get TypeInfo
5. If TypeInfo.type === Object:
   - Get obj.type.properties
   - For each property symbol:
     - Find active binders for property
     - Compute type signature
     - Create CompletionItem
6. Return completion items
```

### Signature Help Query

```
1. User types: functi█(arg1,
2. Find innermost CallExpression
3. Get callee: function symbol
4. Get function declaration
5. For each parameter:
   - Find active binders
   - Compute type
6. Format: functionName(param1: type1, param2: type2)
7. Determine active parameter (count commas)
8. Return signature with active parameter highlighted
```

### Hover Query

```
1. Cursor on identifier
2. Resolve to symbol
3. Find active binders for symbol
4. Evaluate types
5. Format signature
6. Return as hover content
```

## Handling Untyped JavaScript

iSense uses several techniques to infer types without annotations:

### 1. Literal Analysis

Most straightforward: literals have obvious types.

```javascript
42           → number(42)
"hello"      → string("hello")
true         → boolean(true)
[1, 2, 3]    → array
{ x: 5 }     → object { x: number }
```

### 2. Operator Heuristics

Operators hint at types:

```javascript
a + b        → Likely numbers (or strings)
x * y        → Numbers (multiplication)
s.length     → s is string or array
obj.prop     → obj is object
```

**Implementation**:

```javascript
// In analyzeInternal(BinaryExpression)
if (operatorIsArithmetic(op)) {
  // Induce parameter types as number
  if (left is parameter) {
    createInducedBinder(left, TypeInfo.createNumber());
  }
  if (right is parameter) {
    createInducedBinder(right, TypeInfo.createNumber());
  }
}
```

### 3. Method Call Inference

Method names hint at receiver types:

```javascript
text.toUpperCase()    → text is string (String.prototype.toUpperCase)
arr.push(x)           → arr is array (Array.prototype.push)
obj.hasOwnProperty(k) → obj is object (Object.prototype.hasOwnProperty)
```

**Limitation**: Requires knowing which methods belong to which types. Currently limited to built-in types.

### 4. Control Flow Analysis

Track types through branches:

```javascript
let x;
if (typeof x === 'number') {
    // In this branch: x is number
    return x * 2;
} else {
    // In this branch: x is not number
    return x;
}
```

**Implementation**:

- `typeof x === "number"` creates a **condition**
- Binders in consequent have condition attached
- Binders in alternate have negated condition
- When querying type, filter binders by satisfied conditions

### 5. Return Type Inference

Function return type = union of all returned expressions:

```javascript
function getValue(useDefault) {
    if (useDefault) {
        return 42; // return: number
    } else {
        return 'none'; // return: string
    }
}
// getValue return type: number | string
```

**Implementation**:

```javascript
// Find all return statements
returns = findAllReturns(functionBody);

// Evaluate type of each return expression
types = returns.map(ret => {
    if (ret.expression) {
        return evaluateType(ret.expression);
    } else {
        return TypeInfo.createUndefined();
    }
});

// Union all types
returnType = union(types);
```

### 6. Assignment Tracking

Track all assignments to a variable:

```javascript
let status;
status = 'pending'; // Binder 1: string
status = 404; // Binder 2: number
// status type: string | number
```

### 7. Constructor Analysis

Track property assignments in constructors:

```javascript
class Point {
    constructor(x, y) {
        this.x = x; // Point has property x
        this.y = y; // Point has property y
    }
}
```

**Implementation**:

```javascript
// When analyzing constructor:
1. Create 'this' object: TypeInfo.createObject()
2. Track assignments to this.propertyName
3. For each assignment:
   - Create symbol for property
   - Add to this.type.properties
   - Create binder with type
4. Return 'this' as constructor result type
```

### 8. Call-Site Propagation

When calling a function, propagate argument types to parameters:

```javascript
function process(data) {
    // data type unknown
}

process({ name: 'test', id: 123 });
// Call site: argument is object { name: string, id: number }
// → Propagate to 'data' parameter
```

**Implementation** (via call simulation):

```
1. Clone function body
2. For each parameter:
   - Evaluate type of corresponding argument
   - Create binder in cloned body
   - parameter.binders = [{ carrier: Constant(argType) }]
3. Analyze cloned body
4. 'data' now has type from argument
```

## Context and Inference Handling

### Context Types

1. **Declaration Context**:
    - Variable declaration: `const x = ...`
    - Infer type from initializer

2. **Assignment Context**:
    - Simple: `x = ...`
    - Property: `obj.prop = ...`
    - Element: `arr[0] = ...`

3. **Expression Context**:
    - Binary: `a + b`
    - Unary: `-x`, `!flag`
    - Call: `func(args)`
    - Property: `obj.prop`

4. **Statement Context**:
    - If/else: track branches
    - Loops: track iterations (simplified)
    - Switch: track cases
    - Return: infer function return type

### Type Inference Chain

```
Syntax → Heuristic → Type Hypothesis → Validation → Confidence

Example:
  x * 2
  ↓
  * operator → likely arithmetic
  ↓
  x is probably number
  ↓
  Check other uses of x
  ↓
  High confidence if consistent
```

### Limitations of Heuristics

Not always correct:

```javascript
function weird(a, b) {
    return a + b;
}
weird([1], [2]); // a, b are arrays, not numbers!
// Heuristic wrong: + can concatenate arrays
```

iSense doesn't validate heuristics against actual calls (yet). Relies on "most common" interpretation.

## Advanced Features

### Implicit Return Detection

Functions without explicit `return` may still return values:

```javascript
const arrow = () =\u003e 42;  // Implicit return
```

[`implicit-return-detector.js`](./server/src/analyzer/implicit-return-detector.js) handles:

- Arrow functions with expression bodies
- Checking if all code paths return
- Detecting unreachable returns

### Diagnostic Generation

Analyzer emits warnings:

```javascript
const x = 5;
x = 10; // Error: Assignment to constant variable
```

**Implementation**:

```javascript
// In assign()
if (symbol.kind === ts.SyntaxKind.VariableDeclaration) {
    if (isConst(symbol.declaration)) {
        // Create diagnostic
        const diagnostic = AnalyzeDiagnostic.create(
            node,
            DiagnosticMessages.assignmentToConst,
            [symbol.name]
        );
        Ast.addAnalyzeDiagnostic(ast, diagnostic);
    }
}
```

Currently only one diagnostic implemented. Room for many more.

### Call Graph Construction

Partial implementation in [`call.js`](./server/src/analyzer/call.js):

- Track call site → callee mapping
- Store in metadata file
- Intended for "go to call site" feature
- **Not yet integrated** with main analysis

### AST Visualization

For debugging, generate GraphViz DOT files:

```
extension.generateDot → ast-dot-generator.js
  → Generates AST structure visualization

extension.generateISenseDot → ist-dot-generator.js
  → Generates AST + iSense annotations (types, binders)
```

Useful for understanding what the analyzer sees.

## Performance Considerations

### Bottlenecks

1. **Full Re-analysis**:
    - Every completion request triggers `Analyzer.analyze(ast)`
    - Inefficient: should cache

2. **Call Simulation Overhead**:
    - Cloning AST is expensive
    - Deep call chains multiply cost

3. **Binder Search**:
    - Linear search through scope hierarchy
    - For large files, many binders to check

### Optimization Strategies (Not Implemented)

1. **Cache Analysis Results**:
    - Hash file content
    - Reuse analysis if content unchanged

2. **Incremental Analysis**:
    - Track dirty scopes
    - Only re-analyze affected parts

3. **Lazy Analysis**:
    - Analyze functions on demand
    - Don't analyze unused code

4. **Memoize TypeCarrier Evaluation**:
    - Cache evaluation results
    - Reuse for identical carriers

## Current Limitations

### 1. Incomplete AST Handling

`replicator.js` has 50+ TODOs:

```javascript
// TODO: copy properties
// TODO: add logic
// TODO: ???
```

Many node types cause cloning to fail or produce incorrect results.

### 2. Limited Type Operations

- Array string conversion incomplete
- Some type coercions not handled
- Union type refinement is basic

### 3. No Module Analysis

- Import paths not resolved
- Exported types not tracked
- No cross-file type flow

### 4. Simplified Control Flow

- Loops analyzed once (not iteratively)
- No fixed-point iteration
- Exception handling not modeled

### 5. No Async Analysis

- Promises not understood
- `async`/`await` not modeled
- Callback types not inferred

### 6. Primitive Call Graph

- Call sites tracked but not used
- No inter-procedural data flow
- Recursive calls not handled specially

## Future Engine Improvements

### Short Term

1. **Fix Replicator**: Complete all TODO items
2. **Cache Analysis**: Avoid redundant re-analysis
3. **More Diagnostics**: Expand error detection
4. **Better Heuristics**: Improve parameter inference accuracy

### Medium Term

1. **Module Resolution**: Follow imports
2. **Union Type Refinement**: Better narrowing
3. **Control Flow Graphs**: Explicit CFG construction
4. **Fixed-Point Iteration**: Analyze loops correctly

### Long Term

1. **Constraint-Based Inference**: More sophisticated typing
2. **Points-To Analysis**: Track object aliasing
3. **Incremental Parsing**: Use TypeScript incremental API
4. **Worker Thread Analysis**: Offload to background

## Conclusion

iSense's engine is a sophisticated but incomplete system for analyzing untyped JavaScript. It combines:

- Proven parsing (TypeScript compiler)
- Abstract interpretation (type inference)
- Flow-sensitive analysis (type binders)
- Heuristics (operator/method-based inference)

The core ideas are sound, but implementation has gaps. With completion of TODOs and performance optimizations, it could become a powerful tool for JavaScript developers.
