# iSense Improvement Proposals

This document outlines architectural improvements, performance optimizations, better heuristics, and UX enhancements to make iSense more powerful and production-ready.

## Architectural Improvements

### 1. Incremental Analysis System

**Problem**: Currently re-analyzes entire file on every change.

**Proposal**:

```
1. Track scope modification:
   - Hash each scope's text content
   - Compare hashes on document change
   - Mark changed scopes as "dirty"

2. Dependency graph:
   - Track which scopes depend on others
   - Function calls create dependencies
   - Property access creates dependencies

3. Incremental re-analysis:
   - Re-analyze only dirty scopes
   - Re-analyze scopes that depend on dirty scopes
   - Propagate changes through dependency graph

4. Persistent cache:
   - Save analysis results to .isense/ directory
   - Load on project open
   - Invalidate on file change
```

**Benefits**:

- 10-100x faster on large files
- Responsive IntelliSense even on huge codebases

**Inspiration**: TypeScript's incremental compilation, Rust's query system

---

### 2. Module Resolution and Cross-File Analysis

**Problem**: Each file analyzed in isolation. Imports not followed.

**Proposal**:

```
1. Build module graph:
   - Parse import/export statements
   - Resolve paths (support node_modules, relative paths)
   - Track module dependencies

2. Export analysis:
   - Track exported symbols
   - Store type signatures in index
   - Share between files

3. Import resolution:
   - When analyzing `import { foo } from './bar'`:
     - Load bar.js analysis results
     - Find exported symbol 'foo'
     - Import type into current file

4. Workspace-wide cache:
   - Single analysis cache for all files
   - Share common dependencies (e.g., lodash types)
```

**Benefits**:

- Accurate types for imported values
- Workspace-wide refactoring support
- Better code navigation

**Inspiration**: TypeScript's module resolution, rust-analyzer's cross-crate analysis

---

### 3. Constraint-Based Type Inference

**Problem**: Current heuristic-based inference is fragile and incomplete.

**Proposal**:

```
1. Constraint generation:
   - For each expression, generate type constraints
   - Example: `x + y` generates:
     - constraint: hasAddOperator(x, y, result)
     - Could be: number + number = number
     - Or: string + string = string
     - Or: string + any = string

2. Constraint solving:
   - Collect all constraints
   - Solve using unification algorithm
   - Handle subtyping (object ≤ any)
   - Support union types

3. Error reporting:
   - Unsolvable constraints = type errors
   - Better error messages from failed unification
```

**Benefits**:

- More accurate type inference
- Handles complex patterns
- Foundation for advanced features

**Inspiration**: Hindley-Milner type inference, OCaml/Haskell

---

### 4. Data Flow Analysis

**Problem**: Don't track how values flow through program.

**Proposal**:

```
1. Build Static Single Assignment (SSA) form:
   - Each variable has unique definition site
   - φ (phi) nodes at control flow joins
   - Makes data flow explicit

2. Def-Use chains:
   - For each definition, track all uses
   - For each use, track all reaching definitions

3. Value flow tracking:
   - Track how values propagate through assignments
   - Handle object mutations correctly
   - Understand aliasing

4. Taint analysis:
   - Track "tainted" values (user input, etc.)
   - Useful for security analysis
```

**Benefits**:

- Better mutation tracking
- Alias analysis
- Security diagnostics
- Foundation for refactoring

**Inspiration**: LLVM, V8 compiler optimizations

---

### 5. Abstract Interpretation Framework

**Problem**: Ad-hoc analysis, hard to extend.

**Proposal**:

```
1. Abstract domains:
   - Define abstract value representations
   - Number: concrete value, range, top (any number)
   - String: concrete, regex pattern, top
   - Object: structure, top

2. Abstract operations:
   - Define operations on abstract values
   - Plus(Number[0..10], Number[5..15]) = Number[5..25]
   - Widening for loops (approximate to top)

3. Fixpoint iteration:
   - Re-analyze until types stabilize
   - Handle loops correctly

4. Pluggable analyzers:
   - Different domains for different properties
   - Type domain, nullability domain, security domain
```

**Benefits**:

- Principled analysis
- Handle loops correctly
- Extensible framework

**Inspiration**: Abstract interpretation theory, Infer static analyzer

---

## Performance Optimizations

### 1. Analysis Result Caching

**Current**: No caching, re-analyze on every request.

**Optimization**:

```javascript
// server.js
const analysisCache = new Map();

function getCachedAnalysis(ast) {
  const hash = hashContent(ast.getFullText());

  if (analysisCache.has(hash)) {
    return analysisCache.get(hash);
  }

  Analyzer.analyze(ast);
  analysisCache.set(hash, {
    binders: ast.binders,
    diagnostics: ast.analyzeDiagnostics,
    timestamp: Date.now()
  });

  return analysisCache.get(hash);
}

// Invalidate on change
onDidChangeTextDocument(change) {
  const ast = asts[change.textDocument.uri];
  const hash = hashContent(ast.getFullText());
  analysisCache.delete(hash);
}
```

**Expected speedup**: 100x for repeated queries

---

### 2. Lazy Function Analysis

**Current**: Analyze all functions eagerly.

**Optimization**:

```javascript
// analyzer.js
function analyzeInternal(node) {
    if (ts.isFunctionLike(node)) {
        // Don't analyze body immediately
        node.lazyAnalyze = () => {
            if (!node.analyzed) {
                analyzeFunctionBody(node);
                node.analyzed = true;
            }
        };
        return; // Skip children
    }
    ts.forEachChild(node, analyzeInternal);
}

// Analyze on demand
function call(call, callee, thisObject) {
    if (callee.lazyAnalyze) {
        callee.lazyAnalyze(); // Analyze now
    }
    // ... rest of call simulation
}
```

**Expected speedup**: 2-5x for large files with many functions

---

### 3. Binder Indexing

**Current**: Linear search through all binders.

**Optimization**:

```javascript
// ast.js
class BinderIndex {
    constructor() {
        this.bySymbol = new Map(); // symbol name -> binders[]
    }

    add(binder) {
        const name = binder.symbol.name;
        if (!this.bySymbol.has(name)) {
            this.bySymbol.set(name, []);
        }
        this.bySymbol.get(name).push(binder);
    }

    find(symbolName, node) {
        const candidates = this.bySymbol.get(symbolName) || [];
        return candidates.filter(b => isActive(b, node));
    }
}

// Attach to each scope
scope.binderIndex = new BinderIndex();
```

**Expected speedup**: 10x for symbol resolution in large scopes

---

### 4. Worker Thread Analysis

**Current**: Blocks main thread.

**Optimization**:

```javascript
// server.js
const { Worker } = require('worker_threads');
const analysisWorker = new Worker('./analysis-worker.js');

function analyzeAsync(ast) {
    return new Promise(resolve => {
        analysisWorker.postMessage({
            type: 'analyze',
            code: ast.getFullText(),
            fileName: ast.fileName,
        });

        analysisWorker.once('message', result => {
            // Apply results to AST
            applyAnalysisResults(ast, result);
            resolve();
        });
    });
}
```

**Benefits**:

- Non-blocking analysis
- Utilize multi-core CPUs
- Better responsiveness

---

### 5. AST Reuse with Incremental Parsing

**Current**: Full reparse on every change.

**Optimization**:

```javascript
// server.js
const ts = require('typescript');

let previousAst = null;

function incrementalParse(fileName, text, change) {
    if (!previousAst) {
        return ts.createSourceFile(
            fileName,
            text,
            ts.ScriptTarget.ES2015,
            true
        );
    }

    const changeRange = {
        span: {
            start: change.rangeOffset,
            length: change.rangeLength,
        },
        newLength: change.text.length,
    };

    return ts.updateSourceFile(previousAst, text, changeRange);
}
```

**Expected speedup**: 2-10x for small edits

---

## Better Heuristics for Untyped JS

### 1. Contextual Parameter Inference

**Current**: Basic operator-based heuristics.

**Improvement**:

```javascript
// Analyze call sites during initial scan
function inferParameterTypes(func) {
    const callSites = findAllCallSites(func);
    const argumentTypes = callSites.map(call => {
        return call.arguments.map(arg => evaluateType(arg));
    });

    // For each parameter position, find most common type
    const paramTypes = func.parameters.map((param, i) => {
        const types = argumentTypes.map(
            args => args[i] || TypeInfo.createUndefined()
        );
        return findMostCommonType(types);
    });

    return paramTypes;
}
```

**Example**:

```javascript
function process(data) {
    /* ... */
}

process({ id: 1, name: 'test' }); // Call site 1
process({ id: 2, name: 'foo' }); // Call site 2

// Infer: data: { id: number, name: string }
```

---

### 2. Property Shape Inference

**Current**: Track individual property assignments.

**Improvement**:

```javascript
// Infer common object shapes
function inferObjectShape(objectCreations) {
    const shapes = objectCreations.map(obj => getProperties(obj));
    const commonProperties = intersect(...shapes);

    return {
        required: commonProperties,
        optional: union(...shapes).filter(p => !commonProperties.includes(p)),
    };
}
```

**Example**:

```javascript
const objects = [
    { id: 1, name: 'a', age: 20 },
    { id: 2, name: 'b' },
    { id: 3, name: 'c', age: 25 },
];

// Infer: { id: number, name: string, age?: number }
```

---

### 3. Array Element Type Tracking

**Current**: Arrays typed as `any[]`.

**Improvement**:

```javascript
// Track element types
function analyzeArrayLiteral(node) {
    const elementTypes = node.elements.map(el => evaluateType(el));

    if (TypeInfo.hasUniqueType(elementTypes)) {
        return TypeInfo.createArray(elementTypes[0]);
    } else {
        return TypeInfo.createArray(TypeInfo.createUnion(elementTypes));
    }
}

// Array methods
function analyzeArrayMethod(node) {
    if (node.name.text === 'map') {
        // arr.map(fn) -> infer return type of fn
        const fn = node.arguments[0];
        const returnType = inferReturnType(fn);
        return TypeInfo.createArray(returnType);
    }
}
```

**Example**:

```javascript
const numbers = [1, 2, 3]; // number[]
const strings = numbers.map(String); // string[]
```

---

### 4. Named Pattern Inference

**Current**: No inference from naming patterns.

**Improvement**:

```javascript
// Infer types from variable names
const nameHeuristics = {
  /.*Count$/i: TypeInfo.Type.Number,
  /.*Index$/i: TypeInfo.Type.Number,
  /.*Name$/i: TypeInfo.Type.String,
  /^is[A-Z].*/: TypeInfo.Type.Boolean,
  /^has[A-Z].*/: TypeInfo.Type.Boolean,
  /.*Callback$/: TypeInfo.Type.Function,
  /.*Array$/: TypeInfo.Type.Array
};

function inferFromName(name) {
  for (const [pattern, type] of Object.entries(nameHeuristics)) {
    if (pattern.test(name)) {
      return TypeInfo.create(type);
    }
  }
  return TypeInfo.createAny();
}
```

**Example**:

```javascript
function setCount(newCount) {
    // Infer: newCount: number
    // ...
}

function isValid(input) {
    // Infer: returns boolean
    // ...
}
```

---

### 5. Common Pattern Recognition

**Improvement**:

```javascript
// Recognize common JavaScript patterns
const patterns = {
    // Default parameter
    'param || defaultValue': param =>
        TypeInfo.createUnion([evaluateType(param), evaluateType(defaultValue)]),

    // Null check
    'obj && obj.prop': obj => TypeInfo.makeNullable(evaluateType(obj)),

    // Array check
    'Array.isArray(x)': x => TypeInfo.createArray(),
};
```

---

## Ideas Inspired by Other IntelliSense Engines

### 1. From TypeScript Language Service

**Idea**: **Quick Info from Docs**

- TypeScript shows JSDoc in hover
- Could parse JSDoc even without type checking
- Display documentation in suggestions

**Implementation**:

```javascript
// Parse JSDoc comments
function getDocumentation(symbol) {
    const node = symbol.declaration;
    const jsDoc = ts.getJSDocCommentsAndTags(node);
    return jsDoc.map(doc => doc.comment).join('\n');
}
```

---

### 2. From rust-analyzer

**Idea**: **Expand Macro / Inline Function**

- rust-analyzer can show function body inline
- For iSense: Show inferred types in call

**Implementation**:

```javascript
// Code lens showing inferred types
function getTypeCodeLens(node) {
    if (ts.isFunctionDeclaration(node)) {
        const paramTypes = inferParameterTypes(node);
        const returnType = inferReturnType(node);

        return {
            range: createRange(node),
            command: {
                title: `(${paramTypes.join(', ')}) => ${returnType}`,
                command: 'isense.showInferredTypes',
            },
        };
    }
}
```

---

### 3. From Jedi (Python IntelliSense)

**Idea**: **Goto Definition with Imports**

- Jedi follows imports across files
- Shows definition even in dependencies

**Implementation**:

- Resolve module paths
- Parse imported files
- Navigate to definition in other file

---

### 4. From Pylance (Python)

**Idea**: **Type Narrowing with isinstance**

- Python: `if isinstance(x, str): ...`
- JavaScript equivalent: `if (typeof x === "string")`

**Implementation**: Already partially done, expand to:

```javascript
// Array.isArray narrowing
if (Array.isArray(x)) {
    // x is array here
}

// instanceof narrowing
if (x instanceof MyClass) {
    // x is MyClass here
}
```

---

### 5. From Kite (AI-Powered)

**Idea**: **ML-Based Suggestions**

- Train model on millions of JavaScript repos
- Predict likely types from context
- Augment heuristics with learned patterns

**Implementation**:

- Collect corpus (GitHub public JS code)
- Extract typing examples
- Train neural network
- Embed in extension (or server-side API)

---

## UX and Developer Experience Enhancements

### 1. Configuration Options

**Proposal**: Add settings to control behavior

```json
{
    "isense.analysis.depth": 5, // Max call chain depth
    "isense.analysis.timeout": 5000, // Max analysis time (ms)
    "isense.inference.useHeuristics": true,
    "isense.inference.useCallSites": true,
    "isense.cache.enabled": true,
    "isense.cache.location": ".isense/",
    "isense.diagnostics.level": "warning", // "off", "warning", "error"
    "isense.completion.maxSuggestions": 50
}
```

---

### 2. Analysis Progress Indicator

**Proposal**: Show progress for long analyses

```javascript
// server.js
connection.sendNotification('isense/analysisStarted', { fileName });

// ... during analysis
connection.sendNotification('isense/analysisProgress', {
    fileName,
    percent: 50,
    message: 'Analyzing function calls...',
});

connection.sendNotification('isense/analysisComplete', { fileName });
```

**Display**: Progress bar in VS Code status bar

---

### 3. Type Inspection Panel

**Proposal**: Dedicated panel showing inferred types

```
┌─────────────────────────────────┐
│ iSense Type Inspector           │
├─────────────────────────────────┤
│ Symbol: calculate               │
│ Type: (a: number, b: number)    │
│       => number | string        │
│                                 │
│ Inferred from:                  │
│ ✓ Line 5: return a + b          │
│ ✓ Line 7: return "error"        │
│                                 │
│ Call sites:                     │
│ • file.js:20 - calculate(1, 2)  │
│ • file.js:30 - calculate(x, y)  │
└─────────────────────────────────┘
```

---

### 4. Inline Type Hints

**Proposal**: Show inferred types inline (like Rust)

```javascript
function process(data) {
    // ^^^^  { id: number, name: string }
    return data.id * 2;
    // ^^^^^^  number
}
```

**Implementation**: Using `vscode.languages.registerInlayHintsProvider`

---

### 5. Quick Fixes and Refactorings

**Proposal**: Expand code actions

- **Add type comment**: Insert JSDoc with inferred type
- **Generate interface**: Create interface from object shape
- **Inline variable**: Replace variable with its value
- **Extract to function**: Extract selection to function
- **Convert to arrow**: Convert function to arrow function

**Example**:

```javascript
// Before
const obj = { name: 'test', age: 30 };

// Code action: "Generate interface"

// After
/**
 * @typedef {Object} Person
 * @property {string} name
 * @property {number} age
 */
const obj = { name: 'test', age: 30 };
```

---

### 6. Documentation Generation

**Proposal**: Generate docs from inferred types

```javascript
// Input
function calculate(a, b) {
    return a + b;
}

// Code action: "Generate documentation"

// Output
/**
 * Calculate function
 * @param {number} a - First operand
 * @param {number} b - Second operand
 * @returns {number} The sum
 */
function calculate(a, b) {
    return a + b;
}
```

---

## Conclusion

These improvements would transform iSense from an interesting prototype to a production-ready tool:

**High-Impact Improvements**:

1. Incremental analysis (performance)
2. Module resolution (accuracy)
3. Analysis caching (performance)
4. Better parameter inference (accuracy)
5. Configuration options (UX)

**Next Steps**:

1. Prototype incremental analysis
2. Implement analysis caching
3. Add module resolution
4. Expand diagnostic coverage
5. Improve test coverage

See [TODO.md](TODO.md) for specific tasks and [RISKS.md](RISKS.md) for potential pitfalls.

Implemented in [`replicator.js`](./server/src/analyzer/replicator.js).
Implemented in [`binder.js`](./server/src/analyzer/binder.js).
Implemented in [`type-info.js`](./server/src/utility/type-info.js).
Implemented in [`type-carrier.js`](./server/src/utility/type-carrier.js).
Implemented in [`completion.js`](./server/src/services/completion.js).
Implemented in [`signature-help.js`](./server/src/services/signature-help.js).
Implemented in [`hover.js`](./server/src/services/hover.js).
Implemented in [`definition.js`](./server/src/services/definition.js).
Implemented in [`document-symbol.js`](./server/src/services/document-symbol.js).
Implemented in [`code-action.js`](./server/src/services/code-action.js).
