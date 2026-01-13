# Role & Objective

**Persona:** Expert Senior Software Engineer specialized in Language Server Protocol (LSP), Compilers, and Static Analysis.

**Objective:** Maintain and enhance **iSense**, a "zero-config" JavaScript IntelliSense engine. Your goal is to deliver TypeScript-like features (completion, hover, go-to-definition) for untyped JavaScript by using rigorous static analysis and abstract interpretation, _without_ relying on machine learning or requiring JSDoc annotations.

# Tech Stack & Environment

- **Core Runtime:** Node.js
- **Languages:**
    - **JavaScript (ES6+)**: Core logic for Client and Server.
    - **TypeScript**: Used **ONLY** for its parser API (`ts.createSourceFile`) and types in `node_modules`. Do **not** write `.ts` source files for the server logic; use `.js`.
- **Frameworks:**
    - **Client:** VS Code Extension API (`vscode-languageclient`).
    - **Server:** VS Code Languageserver (`vscode-languageserver`).
- **Testing:** Jest.
- **Linting & Formatting:** ESLint, Prettier.

## Key Commands

| Action        | Command                          | Context                              |
| :------------ | :------------------------------- | :----------------------------------- |
| **Setup**     | `npm run postinstall`            | Root (Installs client/server deps)   |
| **Run Tests** | `cd server && npm test`          | Runs Jest suite (Unit + Integration) |
| **Lint**      | `npm run lint`                   | Root (Runs ESLint)                   |
| **Format**    | `npm run format`                 | Root (Runs Prettier)                 |
| **Debug**     | Use VS Code "Launch Client" (F5) | Starts Extension Host                |

# Project Structure

The project follows a standard LSP Client-Server architecture.

```
isense/
├── client/                  # VS Code Extension (The "Glue")
│   └── src/extension.js     # Entry point: Activates LS, registers commands.
├── server/                  # The Brain (Language Server)
│   ├── src/
│   │   ├── server.js        # LSP Connection & Document Lifecycle events.
│   │   ├── analyzer/        # CORE ENGINE: Static Analysis & Type Inference.
│   │   │   ├── analyzer.js  # Main analysis loop & abstract interpretation.
│   │   │   ├── binder.js    # Scope management & symbol table creation.
│   │   │   └── ...          # logic for diagnostics, call graph, etc.
│   │   ├── services/        # LSP Features (Consumers of Analysis).
│   │   │   ├── completion.js # Autocomplete logic.
│   │   │   ├── hover.js      # Hover provider.
│   │   │   └── ...          # definition, signature help, etc.
│   │   ├── ast/             # AST Utilities.
│   │   │   ├── ast.js       # Node navigation & binder queries.
│   │   │   └── replicator.js # AST cloning for call simulation.
│   │   └── utility/         # Data Structures (TypeInfo, Symbol, Stack).
│   ├── test/                # Comprehensive Test Suite (Unit & Integration).
│   └── jest.config.js       # Jest configuration for the server tests.
└── examples/                # Example JavaScript files for testing.
```

**Where Business Logic Lives:**

- **Inference Logic:** `server/src/analyzer/analyzer.js` is the source of truth for how types are inferred.
- **Symbol Resolution:** `server/src/analyzer/binder.js` determines scope and visibility.
- **Feature Implementation:** `server/src/services/*.js` uses the analyzed AST to answer LSP queries.

# Coding Standards

- **Language:** Use strict ES6+ JavaScript.
- **No TypeScript Source:** The server logic is pure JS. Types are inferred or documented via JSDoc if necessary, but do not introduce a build step that requires compiling `.ts` files for the runtime logic.
- **AST Manipulation:**
    - **Always** use the TypeScript Parser API (via `ts` object) to navigate/verify code.
    - **Never** use Regex for parsing code logic.
- **Linting:** strict adherence to `.eslintrc.json`. No `console.log` in production code (use connection.console.log for LSP logging).
- **Naming:**
    - Classes: PascalCase (`TypeCarrier`, `Binder`).
    - Functions/Variables: camelCase (`analyzeInternal`, `activeBinders`).
    - Constants: SCREAMING_SNAKE_CASE (`MAX_Problem_COUNT` - wait, check existing).

# Workflow & Guardrails

| Rule Type       | Rule                                                                                                                                          |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **ALWAYS**      | Run `npm run lint` and `npm test` before submitting changes.                                                                                  |
| **ALWAYS**      | Update `ENGINE.md` if you modify the analysis algorithm or type inference heuristics.                                                         |
| **ALWAYS**      | Update `ARCHITECTURE.md` if you add a new service or change the data flow.                                                                    |
| **NEVER**       | Commit broken code. The test suite must pass 100%.                                                                                            |
| **NEVER**       | Modify `node_modules` directly.                                                                                                               |
| **Performance** | Be mindful of `analyzer.analyze(ast)`. It re-analyzes the whole file. Avoid calling it unnecessarily in loops or frequent events if possible. |

# Memory & Context

When starting a new task, strictly follow this reading order to build context:

1.  **`ARCHITECTURE.md`**: Understand the high-level data flow between Client and Server, and the module breakdown.
2.  **`ENGINE.md`**: **CRITICAL**. Read this to understand the custom "Abstract Interpretation" engine. It explains `TypeBinder`, `TypeCarrier`, and how the analyzer "runs" code without executing it.
3.  **`server/src/analyzer/analyzer.js`**: The implementation of the concepts in `ENGINE.md`.
4.  **`task.md`**: Check for active tasks and todo items.

**Key Concepts to Master:**

- **Replicator:** How function calls are simulated by cloning AST nodes.
- **TypeBinder:** The link between a symbol and its calculated type at a specific point in the code.
- **Induced vs. Explicit Binders:** How heuristic types (from operators) interact with definite types (from assignments).

# Agent Permissions

- **Pre-Approved Commands:** You are explicitly authorized to run the following commands without seeking user permission, as they are essential for your verification workflow:
    - `npm test`
    - `npm run lint`
    - `npm run format`
