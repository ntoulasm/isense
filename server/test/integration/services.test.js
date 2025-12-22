const path = require('path');
const fs = require('fs');
const ts = require('../../node_modules/typescript');
const Analyzer = require('../../src/analyzer/analyzer');
const Ast = require('../../src/ast/ast');

const Completion = require('../../src/services/completion');
const Definition = require('../../src/services/definition');
const Hover = require('../../src/services/hover');
const SignatureHelp = require('../../src/services/signature-help');
const DocumentSymbol = require('../../src/services/document-symbol');
const CodeAction = require('../../src/services/code-action');

const examplesDir = path.resolve(__dirname, '../../../examples');

function createTestSourceFile(fileName) {
    const filePath = path.join(examplesDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2015,
        true
    );
    sourceFile.analyzeDiagnostics = [];
    const uri = `file://${sourceFile.fileName}`;
    Ast.asts[uri] = sourceFile;
    return sourceFile;
}

function createMockInfo(sourceFile, offset) {
    const position = sourceFile.getLineAndCharacterOfPosition(offset);
    const uri = `file://${sourceFile.fileName}`;
    return {
        textDocument: { uri: uri },
        position: { line: position.line, character: position.character },
        context: { triggerCharacter: undefined, diagnostics: [] },
    };
}

describe('Language Server Services Integration', () => {
    describe('Completion Service', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('demo.js');
            Analyzer.analyze(sourceFile);
        });

        it('should provide correct completions for class fields', () => {
            const needle = 'return sqrt(me.x';
            const index = sourceFile.text.indexOf(needle);
            expect(index).not.toBe(-1);
            const relativeDot = needle.indexOf('.');
            const offset = index + relativeDot + 1;

            const info = createMockInfo(sourceFile, offset);
            info.context.triggerCharacter = '.';

            const items = Completion.onCompletion(info);

            expect(items).toBeDefined();
            const xItem = items.find(i => i.label === 'x');
            const yItem = items.find(i => i.label === 'y');

            expect(xItem).toBeDefined();
            expect(yItem).toBeDefined();
        });

        it('should suggest local variables within a function scope', () => {
            const sourceWithLocal = createTestSourceFile('completion_extra.js');
            Analyzer.analyze(sourceWithLocal);

            const needle = 'localV // marker';
            const index = sourceWithLocal.text.indexOf(needle);
            const offset = index + 6; // at end of 'localV'

            const info = createMockInfo(sourceWithLocal, offset);
            const items = Completion.onCompletion(info);

            expect(items).toBeDefined();
            const local = items.find(i => i.label === 'localVariable');
            expect(local).toBeDefined();
        });
    });

    describe('Definition Service', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('goto-definition.js');
            Analyzer.analyze(sourceFile);
        });

        it('should resolve to the exact definition of createPoint function', () => {
            const needle = 'line.begin = createPoint(';
            const index = sourceFile.text.indexOf(needle);
            expect(index).not.toBe(-1);
            const offset = index + 15;

            const info = createMockInfo(sourceFile, offset);
            const definition = Definition.onDefinition(info);

            expect(definition).toBeDefined();
            expect(definition.uri).toContain('goto-definition.js');
            expect(definition.range.start.line).toBe(16);
        });
    });

    describe('Hover Service', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('demo.js');
            Analyzer.analyze(sourceFile);
        });

        it('should provide type information in hover', () => {
            const needle = 'let x = add(1, 4)';
            const index = sourceFile.text.indexOf(needle);
            expect(index).not.toBe(-1);
            const offset = index + 4;

            const info = createMockInfo(sourceFile, offset);
            const hover = Hover.onHover(info);

            expect(hover).toBeDefined();
            const contents = hover.contents;

            let text = '';
            if (Array.isArray(contents)) {
                text = contents.map(c => c.value || c).join('\n');
            } else if (typeof contents === 'object') {
                text = contents.value || '';
            } else {
                text = String(contents);
            }

            expect(text).toMatch(/\b(let|var|const)\s+x\b|x:/);
        });
    });

    describe('Signature Help Service', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('signature_help.js');
            Analyzer.analyze(sourceFile);
        });

        it('should identify active parameter and correct signature label', () => {
            const needle = 'bar.b()';
            const index = sourceFile.text.indexOf(needle);
            expect(index).not.toBe(-1);
            const offset = index + 6;

            const info = createMockInfo(sourceFile, offset);
            const help = SignatureHelp.onSignatureHelp(info);

            expect(help).toBeDefined();
            expect(help.activeParameter).toBe(0);
            expect(help.signatures.length).toBeGreaterThan(0);

            const paramLabel = help.signatures[0].parameters[0].label;
            expect(paramLabel).toMatch(/^a(:.*)?/);
        });
    });

    describe('Document Symbol Service', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('outline.js');
            Analyzer.analyze(sourceFile);
        });

        it('should outline class and its members correctly', () => {
            const info = createMockInfo(sourceFile, 0);
            const symbols = DocumentSymbol.onDocumentSymbol(info);

            expect(symbols).toBeDefined();
            const classPoint = symbols.find(s => s.name === 'point');
            expect(classPoint).toBeDefined();
            expect(classPoint.kind).toBe(5);
            expect(classPoint.children).toBeDefined();
            const memberX = classPoint.children.find(s => s.name === 'x');
            expect(memberX).toBeDefined();
        });
    });

    describe('Code Action Service', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('code-action.js');
            Analyzer.analyze(sourceFile);
        });

        it('should return a workspace edit to change const to let', () => {
            const needle = 'x = 5;';
            const index = sourceFile.text.indexOf(needle);
            expect(index).not.toBe(-1);
            const offset = index + 2;

            const startPos = sourceFile.getLineAndCharacterOfPosition(index);
            const endPos = sourceFile.getLineAndCharacterOfPosition(index + 1);

            const diagnostic = {
                code: 0,
                range: { start: startPos, end: endPos },
                message: 'Assignment to const variable',
            };

            const info = createMockInfo(sourceFile, offset);
            info.context.diagnostics = [diagnostic];

            const actions = CodeAction.onCodeAction(info);

            expect(actions).toBeDefined();
            expect(actions.length).toBeGreaterThan(0);
            const action = actions[0];
            expect(action.title).toBe('Change const to let declaration');

            const fileUri = Object.keys(action.edit.changes)[0];
            const changes = action.edit.changes[fileUri];

            expect(changes.length).toBe(2);

            const insertion = changes.find(c => c.newText.includes('let'));
            const deletion = changes.find(c => c.newText === '');

            expect(insertion).toBeDefined();
            expect(insertion.newText).toContain('let x');
            expect(deletion).toBeDefined();
        });

        it('should handle single variable reassignment', () => {
            const sourceSingle = createTestSourceFile('single.js');
            Analyzer.analyze(sourceSingle);

            const needle = 'x = 2';
            const index = sourceSingle.text.indexOf(needle);
            const offset = index;

            const startPos = sourceSingle.getLineAndCharacterOfPosition(index);
            const endPos = sourceSingle.getLineAndCharacterOfPosition(
                index + 1
            );

            const diagnostic = {
                code: 0,
                range: { start: startPos, end: endPos },
                message: 'Assignment to const variable',
            };

            const info = createMockInfo(sourceSingle, offset);
            info.context.diagnostics = [diagnostic];

            const actions = CodeAction.onCodeAction(info);
            expect(actions).toBeDefined();
            expect(actions.length).toBeGreaterThan(0);

            const fileUri = Object.keys(actions[0].edit.changes)[0];
            const changes = actions[0].edit.changes[fileUri];
            expect(changes).toBeDefined();
            expect(changes.length).toBe(2);
            expect(changes.find(c => c.newText.includes('let'))).toBeDefined();
        });

        it('should handle variable reassignment at the start of a multi-variable declaration', () => {
            const sourceStart = createTestSourceFile('start.js');
            Analyzer.analyze(sourceStart);

            const needle = 'x = 3';
            const index = sourceStart.text.indexOf(needle);
            const offset = index;

            const startPos = sourceStart.getLineAndCharacterOfPosition(index);
            const endPos = sourceStart.getLineAndCharacterOfPosition(index + 1);

            const diagnostic = {
                code: 0,
                range: { start: startPos, end: endPos },
                message: 'Assignment to const variable',
            };

            const info = createMockInfo(sourceStart, offset);
            info.context.diagnostics = [diagnostic];

            const actions = CodeAction.onCodeAction(info);
            expect(actions).toBeDefined();
            expect(actions.length).toBeGreaterThan(0);

            const fileUri = Object.keys(actions[0].edit.changes)[0];
            const changes = actions[0].edit.changes[fileUri];
            expect(changes).toBeDefined();
            expect(changes.length).toBe(2);
            expect(changes.find(c => c.newText.includes('let'))).toBeDefined();
        });
    });

    describe('Signature Help Service (Multi-param)', () => {
        let sourceFile;
        beforeAll(() => {
            sourceFile = createTestSourceFile('demo.js');
            Analyzer.analyze(sourceFile);
        });

        it('should identify second parameter in add function', () => {
            const needle = 'add(1, 4)';
            const index = sourceFile.text.indexOf(needle);
            expect(index).not.toBe(-1);
            // 'add(1, 4)' -> 'add(1, ' is 7 chars.
            // offset at 4 is index + 7 + something?
            // needle index is at start.
            // 'add(' is 4 chars. '1' is 1 char. ', ' is 2 chars.
            // index + 4 + 1 + 2 = index + 7.
            const offset = index + 7;

            const info = createMockInfo(sourceFile, offset);
            const help = SignatureHelp.onSignatureHelp(info);

            expect(help).toBeDefined();
            // Expect activeParameter to be 1 (second param)
            // But implementation details matter. isense might use simple comma counting.
            // Let's verify expectations.
            expect(help.activeParameter).toBe(1);
            expect(help.signatures.length).toBeGreaterThan(0);
            expect(help.signatures[0].label).toContain('add');
            // Check that 'b' is present in the label since we are on the second parameter
            expect(help.signatures[0].label).toContain('b');
        });
    });
});
