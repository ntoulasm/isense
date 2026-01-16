const path = require('path');
const fs = require('fs');
const ts = require('typescript');
const Analyzer = require('../../src/analyzer/analyzer');
const Ast = require('../../src/ast/ast');
const Signature = require('../../src/utility/signature');
const TypeCarrier = require('../../src/utility/type-carrier');
const TypeInfo = require('../../src/utility/type-info');

const fixturesDir = path.resolve(__dirname, '../fixtures/analyzer');

function createSnapshot(fileName) {
    const filePath = path.join(fixturesDir, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2015,
        true
    );
    sourceFile.analyzeDiagnostics = [];
    const uri = `file://${sourceFile.fileName.replace(/\\/g, '/')}`;
    Ast.asts[uri] = sourceFile;

    Analyzer.analyze(sourceFile);

    const results = [];

    function visit(node) {
        const serialized = serializeNode(node, sourceFile);
        if (serialized) {
            results.push(serialized);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return results.join('\n');
}

function serializeNode(node, sourceFile) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile)
    );
    const displayLine = line + 1;

    // We only care about Identifiers that are not declarations (usages)
    // and VariableDeclarations (declarations)
    if (node.kind === ts.SyntaxKind.Identifier) {
        // Skip identifiers that are part of a declaration name to avoid double reporting on same line
        if (
            node.parent &&
            (node.parent.kind === ts.SyntaxKind.VariableDeclaration ||
                node.parent.kind === ts.SyntaxKind.FunctionDeclaration ||
                node.parent.kind === ts.SyntaxKind.Parameter ||
                node.parent.kind === ts.SyntaxKind.PropertyDeclaration ||
                node.parent.kind === ts.SyntaxKind.MethodDeclaration) &&
            node.parent.name === node
        ) {
            return null;
        }

        const symbol = Ast.lookUp(node, node.getText(sourceFile));
        if (symbol) {
            const activeBinders = Ast.findActiveTypeBinders(node, symbol);
            if (activeBinders && activeBinders.length) {
                const types = TypeCarrier.evaluate(activeBinders[0].carrier);
                const signature = Signature.compute(node, symbol, types);
                return `Line ${displayLine} | ${node.getText(sourceFile)} | Type: ${signature}`;
            }
        }
    } else if (
        node.kind === ts.SyntaxKind.VariableDeclaration &&
        node.name.kind === ts.SyntaxKind.Identifier
    ) {
        const symbol = Ast.lookUp(node, node.name.getText(sourceFile));
        if (symbol) {
            const activeBinders = Ast.findActiveTypeBinders(node, symbol);
            if (activeBinders && activeBinders.length) {
                const types = TypeCarrier.evaluate(activeBinders[0].carrier);
                const signature = Signature.compute(node, symbol, types);
                return `Line ${displayLine} | Decl: ${node.name.getText(sourceFile)} | Type: ${signature}`;
            }
        }
    } else if (node.kind === ts.SyntaxKind.CallExpression) {
        if (node.carrier) {
            const types = TypeCarrier.evaluate(node.carrier);
            const typeStrings = types
                .map(t => TypeInfo.typeToString(t))
                .join(' | ');
            const expressionText = node.expression.getText(sourceFile);
            return `Line ${displayLine} | ${expressionText}(...) | Return: ${typeStrings}`;
        }
    }
    return null;
}

describe('Analyzer Snapshot Tests', () => {
    const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.js'));

    files.forEach(file => {
        it(`should match snapshot for ${file}`, () => {
            const snapshot = createSnapshot(file);
            expect(snapshot).toMatchSnapshot();
        });
    });
});
