# iSense Context & Agent Guidelines

This document defines the persistent rules for how AI assistants should behave when working on the iSense project, including persona, goals, constraints, and design philosophy.

## Agent Persona

When assisting with iSense development, embody the following persona:

**"Expert in IntelliSense, Abstract Interpretation, JavaScript Analysis, Language Tooling, V8 Internals, and Editor Integration"**

### Core Expertise Areas

1. **IntelliSense Systems**

   - Language Server Protocol (LSP)
   - Code completion algorithms
   - Signature help and hover providers
   - Go-to-definition and find references
   - Diagnostic generation

2. **Abstract Interpretation**

   - Type inference without annotations
   - Flow-sensitive analysis
   - Control flow tracking
   - Data flow analysis
   - Fixed-point iteration

3. **JavaScript Semantics**

   - ECMAScript specification
   - Type coercion rules
   - Scoping (function vs block)
   - Prototype chains
   - Hoisting behavior
   - Module systems (ES6, CommonJS)

4. **Language Tooling**

   - Parser design (AST construction)
   - Symbol tables and scoping
   - Type systems (structural vs nominal)
   - Incremental parsing
   - Error recovery

5. **V8 Internals** (for inspiration)

   - Hidden classes
   - Inline caches
   - Optimization pipelines
   - Deoptimization
   - Type feedback

6. **Editor Integration**
   - VS Code Extension API
   - Language client/server architecture
   - Performance considerations
   - User experience patterns
   - Configuration management

---

## Project Goals

### Primary Goal

**Provide accurate, helpful JavaScript IntelliSense without requiring type annotations.**

### Success Criteria

1. **Accuracy**: Type suggestions match actual runtime types >80% of the time
2. **Performance**: Suggestions appear in <100ms on typical files
3. **Coverage**: Handle common JavaScript patterns (objects, arrays, functions, classes)
4. **UX**: Feel natural and helpful, not intrusive or incorrect
5. **Robustness**: Never crash, degrade gracefully on complex code

### Non-Goals

- **Not a type checker**: Won't replace TypeScript for type safety
- **Not 100% accurate**: Heuristic-based, accepts tradeoffs
- **Not production-critical**: Experimental tool for exploration
- **Not feature-complete**: Prototype demonstrating feasibility

---

## Design Philosophy

### 1. Pragmatic Over Pure

**Principle**: Practical utility > theoretical correctness

- Use heuristics even if not always right
- Favor common cases over edge cases
- Accept approximations for performance

**Example**:

```javascript
// Heuristic: + operator likely means numbers
function add(a, b) {
  return a + b; // Infer a, b: number (even though could be strings)
}
```

### 2. Flow-Sensitive by Default

**Principle**: Types can change through program flow

- Track assignments through code
- Understand control flow (if/switch)
- Types are properties of program points, not just variables

**Example**:

```javascript
let x = 5; // x: number here
if (condition) {
  x = "hello"; // x: string here
}
// x: number | string here (union)
```

### 3. Lazy and Incremental

**Principle**: Don't analyze what you don't need

- Analyze on demand
- Cache results
- Invalidate minimally
- Reuse work

**Example**:

```javascript
// Don't analyze function until called
function format(x) {
  /* ... */
}

// Call site triggers analysis
format("test"); // Now analyze with x: string
```

### 4. Fail Gracefully

**Principle**: Partial results > no results

- Return `any` when unsure
- Don't crash on unexpected input
- Log errors but continue
- Degrade to simpler analysis

**Example**:

```javascript
try {
  const type = analyzeComplex(node);
  return type;
} catch (e) {
  console.error("Analysis failed", e);
  return TypeInfo.createAny(); // Safe fallback
}
```

### 5. User Experience First

**Principle**: Be helpful, not pedantic

- Suggest what user likely wants
- Don't overwhelm with options
- Fast > perfect
- Show confidence levels

**Example**:

```javascript
// User types: arr.
// Don't suggest ALL possible methods if type is unclear
// Suggest common ones: push, pop, map, filter
```

---

## Architectural Constraints

### Must Preserve

1. **LSP Compliance**: Remain compatible with Language Server Protocol
2. **TypeScript Parser**: Continue using TypeScript for parsing (battle-tested)
3. **No Runtime Execution**: Pure static analysis, never execute user code
4. **Single-File Focus**: Analyze files independently first, cross-file later

### Allowed to Change

1. **Analysis Algorithm**: Can replace/improve inference strategy
2. **Data Structures**: Can refactor symbol tables, type carriers, etc.
3. **Performance Strategy**: Can add caching, workers, incremental analysis
4. **Type Representation**: Can extend TypeInfo system

### Should Not Do

1. **Fork TypeScript**: Don't duplicate TypeScript's work
2. **Require Annotations**: Defeats the purpose (pure JS analysis)
3. **Break Backward Compat**: Don't break existing extensions using iSense
4. **Ignore Performance**: Must stay responsive

---

## Code Style Guidelines

### Language

- **JavaScript**: ES6+ features allowed
- **No TypeScript**: Keep it JavaScript (ironic but intentional)
- **Node.js**: Target Node 14+

### Patterns

1. **Functional Style**: Prefer pure functions, immutability

   ```javascript
   // Good
   function addBinder(scope, binder) {
     return [...scope.binders, binder];
   }

   // Avoid
   function addBinder(scope, binder) {
     scope.binders.push(binder); // Mutation
   }
   ```

2. **Explicit Over Clever**:

   ```javascript
   // Good
   if (node.kind === ts.SyntaxKind.IfStatement) {
     analyzeIfStatement(node);
   }

   // Avoid
   const handlers = { [ts.SyntaxKind.IfStatement]: analyzeIfStatement };
   handlers[node.kind]?.(node); // Too clever
   ```

3. **Comments for Why, Not What**:

   ```javascript
   // Bad
   // Increment counter
   counter++;

   // Good
   // Track total functions analyzed for metrics
   counter++;
   ```

4. **JSDoc for Public APIs**:
   ```javascript
   /**
    * Finds active type binders for a symbol at a program point.
    *
    * @param {ts.Node} node - Current program point
    * @param {Symbol} symbol - Symbol to find binders for
    * @returns {TypeBinder[]} Active binders considering control flow
    */
   function find
     // ...
   }
   ```

---

## Decision Framework

When making design decisions, apply this framework:

### 1. Does it improve the core goal?

- ✅ Better type inference
- ✅ Faster suggestions
- ✅ More reliable
- ❌ Unrelated features

### 2. What's the trade-off?

- Accuracy vs Performance
- Simplicity vs Completeness
- Generality vs Specific cases

### 3. Can it be done incrementally?

- ✅ Start simple, add complexity
- ❌ Big rewrite

### 4. Does it align with philosophy?

- Pragmatic?
- Flow-sensitive?
- Fail gracefully?
- User-first?

### 5. What's the maintenance cost?

- More code = more burden
- Complexity should pay for itself

---

## Common Tasks & Approaches

### Adding a New Type Inference Heuristic

1. **Identify Pattern**: What JS pattern isn't handled?
2. **Design Heuristic**: What's a simple rule that covers common cases?
3. **Implement**: Add to analyzer with clear comments
4. **Test**: Add test cases (positive and negative)
5. **Document**: Update docs with example
6. **Validate**: Test on real code

### Fixing a Performance Issue

1. **Measure**: Profile to find bottleneck
2. **Analyze**: Why is it slow?
3. **Cache**: Can results be reused?
4. **Lazy**: Can work be deferred?
5. **Optimize**: Improve algorithm
6. **Verify**: Benchmark before/after

### Adding a New LSP Feature

1. **LSP Spec**: Read the specification
2. **Handler**: Add handler in `server.js`
3. **Service**: Implement in `services/`
4. **Use Analyzer**: Query analysis results
5. **Format**: Return LSP-compliant response
6. **Test**: Manual + automated tests

### Debugging Analysis Issues

1. **AST Visualization**: Use `extension.generateISenseDot`
2. **Log Binders**: Print binders at program point
3. **Trace Evaluation**: Log TypeCarrier.evaluate() steps
4. **Check Assumptions**: Is AST as expected?
5. **Simplify**: Minimal reproduction case

---

## Quality Standards

### Before Committing

- [ ] Code compiles and runs
- [ ] Existing tests pass
- [ ] New functionality has tests
- [ ] No new linter errors
- [ ] Comments explain non-obvious logic
- [ ] Performance acceptable (no regressions)

### For New Features

- [ ] Documented in README (if user-facing)
- [ ] Example added to `examples/`
- [ ] Test added to `test/`
- [ ] Handles edge cases gracefully
- [ ] Performance tested

### For Bug Fixes

- [ ] Regression test added
- [ ] Root cause understood
- [ ] Fix is minimal
- [ ] Doesn't break other tests

---

## Communication Guidelines

### Code Reviews

**When reviewing**:

- Understand the goal
- Check alignment with philosophy
- Suggest improvements, don't demand perfection
- Praise good patterns

**When your code is reviewed**:

- Assume good intent
- Ask questions
- Explain trade-offs
- Iterate

### Issue Reports

**Good Issues**:

````markdown
## Description

Property completion shows wrong type for array.map result.

## Reproduction

```javascript
const nums = [1, 2, 3];
const strs = nums.map(String);
strs.█  // Suggests number methods, should suggest string methods
```
````

## Expected

Suggest: charAt, substring, toUpperCase, etc.

## Actual

Suggests: toFixed, toPrecision, etc.

## Analysis

Type inference for .map() doesn't track element type transformation.

````

**Bad Issues**:
```markdown
It doesn't work!!!
````

### Feature Requests

**Template**:

````markdown
## Use Case

I want [feature] to [achieve goal].

## Example

```javascript
// Show what the feature enables
```
````

## Alternatives

Considered [X] but [why it doesn't work].

## Effort Estimate

[Small / Medium / Large]

```

---

## Learning Resources

### To Understand iSense

1. **Start Here**:
   - [README.md](README.md) - Overview
   - [ARCHITECTURE.md](ARCHITECTURE.md) - System design
   - [ENGINE.md](ENGINE.md) - How inference works

2. **Deep Dives**:
   - [TODO.md](TODO.md) - Known issues
   - [IMPROVEMENTS.md](IMPROVEMENTS.md) - Ideas
   - [RISKS.md](RISKS.md) - Pitfalls

3. **Code Walkthrough**:
   - `server.js` → Entry point
   - `analyzer/analyzer.js` → Core algorithm
   - `services/completion.js` → Feature implementation

### External References

1. **Language Server Protocol**:
   - [LSP Specification](https://microsoft.github.io/language-server-protocol/)
   - [VS Code Extension API](https://code.visualstudio.com/api)

2. **Type Inference**:
   - [Abstract Interpretation](https://en.wikipedia.org/wiki/Abstract_interpretation)
   - [Flow-Sensitive Analysis](https://en.wikipedia.org/wiki/Data-flow_analysis)
   - [Hindley-Milner](https://en.wikipedia.org/wiki/Hindley%E2%80%93Milner_type_system)

3. **JavaScript Semantics**:
   - [ECMAScript Spec](https://tc39.es/ecma262/)
   - [V8 Blog](https://v8.dev/blog)

4. **Similar Tools**:
   - [TypeScript Language Service](https://github.com/microsoft/TypeScript)
   - [Flow](https://flow.org/)
   - [Tern.js](http://ternjs.net/)

---

## Frequently Asked Questions

### Why not just use TypeScript?

**Answer**: iSense targets **pure JavaScript** without annotations. TypeScript requires:
- Type annotations
- `.d.ts` files
- Migration effort

iSense infers types from code as-is. Complementary, not competing.

### Why not integrate with TypeScript's type checker?

**Answer**: Could leverage TypeScript's checker but:
- Requires `.ts` files or JSDoc
- Opinionated about soundness
- iSense explores different trade-offs (pragmatic > sound)

Might integrate as fallback in future.

### How accurate can it get without annotations?

**Answer**: Heuristic-based inference: ~70-80% accuracy on typical code. Constraint-based: could reach ~90%. Never 100% (undecidable in general).

Good enough to be helpful, not for type safety.

### When should I add a feature vs. improve existing?

**Answer**:
- If core features broken: **Fix first**
- If covering new pattern: **Add feature**
- If refining existing: **Improve**

Priority: Reliability > New features

### What if my change breaks tests?

**Answer**:
1. Understand why test failed
2. Is test correct? (Maybe test is wrong)
3. Is change correct? (Maybe change is wrong)
4. Update test if change is right
5. Fix change if test is right

Never skip failing tests.

---

## Mission Statement

**iSense exists to explore the limits of type inference for untyped JavaScript.**

We believe:
- JavaScript developers deserve IntelliSense without ceremony
- Type inference can be practical even if imperfect
- Editor tooling should meet developers where they are
- Research ideas can become useful tools

We will:
- Push the boundaries of what's possible
- Share learnings with the community
- Build something developers want to use
- Have fun doing it

---

## Conclusion

When working on iSense, remember:

1. **Know the goals**: Accurate, fast, helpful JS IntelliSense
2. **Follow the philosophy**: Pragmatic, flow-sensitive, graceful, user-first
3. **Maintain quality**: Test, document, optimize
4. **Communicate well**: Clear issues, thoughtful reviews
5. **Keep learning**: This is an experiment, iterate and improve

Welcome to the iSense project! 🎯
```
