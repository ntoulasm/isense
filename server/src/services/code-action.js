const Ast = require('../ast/ast');
const { getAst } = require('./utility');
const DiagnosticCodes = require('../analyzer/diagnostic-codes');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const CodeAction = {};

// ----------------------------------------------------------------------------

/**
 * @param {vscodeLanguageServer.CodeActionParams} info
 * @returns {vscodeLanguageServer.CodeAction[]}
 */
CodeAction.onCodeAction = info => {
    /**
     * @type {ts.SourceFile}
     */
    const ast = getAst(info);
    /**
     * @type {vscodeLanguageServer.Diagnostic[]}
     */
    const diagnostics = info.context.diagnostics;

    return computeCodeAction(ast, diagnostics);
};

// ----------------------------------------------------------------------------

function computeCodeAction(ast, diagnostics) {
    for (const diagnostic of diagnostics) {
        switch (diagnostic.code) {
            case DiagnosticCodes.assignmentToConst:
                return computeConstantAssignmentCodeAction(ast, diagnostic);
            default:
                break;
        }
    }
}

// ----------------------------------------------------------------------------

/**
 * // TODO: Refactoring
 *
 * @param {ts.SourceFile} ast
 * @param {vscodeLanguageServer.Diagnostic} diagnostic
 * @returns
 */
function computeConstantAssignmentCodeAction(ast, diagnostic) {
    const offset = ast.getPositionOfLineAndCharacter(
        diagnostic.range.start.line,
        diagnostic.range.start.character
    );
    /**
     * @type {ts.Node}
     */
    const node = Ast.findInnerMostNode(
        ast,
        offset,
        n => n.kind === ts.SyntaxKind.BinaryExpression
    );
    /**
     * @type {ts.Node}
     */
    const declaration = node.left.carrier.symbol.declaration;
    const declarationList = declaration.parent;
    const declarationSource = declaration.getSourceFile();
    const actionUri = declaration.getSourceFile().fileName;
    const declarationStart = declarationSource.getLineAndCharacterOfPosition(
        declarationList.parent.getStart()
    );
    const declarationEnd = declarationSource.getLineAndCharacterOfPosition(
        declarationList.parent.end
    );
    const declarationRange = vscodeLanguageServer.Range.create(
        declarationStart,
        declarationEnd
    );
    /**
     * @type {vscodeLanguageServer.CodeAction}
     */
    const fix = vscodeLanguageServer.CodeAction.create(
        `Change const to let declaration`,
        vscodeLanguageServer.CodeActionKind.QuickFix
    );
    fix.diagnostics = [];
    fix.diagnostics.push(diagnostic);
    fix.edit = {};
    fix.edit.changes = {};
    if (declarationList.declarations.length === 1) {
        fix.edit.changes[actionUri] = [
            vscodeLanguageServer.TextEdit.del(declarationRange),
            vscodeLanguageServer.TextEdit.insert(
                declarationStart,
                `let ${declaration.getText()};`
            ),
        ];
    } else if (declarationList.declarations.indexOf(declaration) === 0) {
        // const x = 2, ...;
        const deletionStartNode = declaration;
        const deletionEndNode =
            getNextCommaToken(declarationList, declaration) || declaration;
        const deletionStart = declarationSource.getLineAndCharacterOfPosition(
            deletionStartNode.getFullStart()
        );
        const deletionEnd = declarationSource.getLineAndCharacterOfPosition(
            deletionEndNode.end
        );
        const deletionRange = vscodeLanguageServer.Range.create(
            deletionStart,
            deletionEnd
        );
        const insertionStart = declarationSource.getLineAndCharacterOfPosition(
            declarationList.parent.end
        );
        fix.edit.changes[actionUri] = [
            vscodeLanguageServer.TextEdit.del(deletionRange),
            vscodeLanguageServer.TextEdit.insert(
                insertionStart,
                `\n${computeLeadingWhitespaces(declarationList.parent)}let ${declaration.getText()};`
            ),
        ];
    } else {
        const deletionStartNode = getPreviousCommaToken(
            declarationList,
            declaration
        );
        const deletionEndNode = declaration;
        const deletionStart = declarationSource.getLineAndCharacterOfPosition(
            deletionStartNode.getFullStart()
        );
        const deletionEnd = declarationSource.getLineAndCharacterOfPosition(
            deletionEndNode.end
        );
        const deletionRange = vscodeLanguageServer.Range.create(
            deletionStart,
            deletionEnd
        );
        const insertionStart = declarationSource.getLineAndCharacterOfPosition(
            declarationList.parent.end
        );
        fix.edit.changes[actionUri] = [
            vscodeLanguageServer.TextEdit.del(deletionRange),
            vscodeLanguageServer.TextEdit.insert(
                insertionStart,
                `\n${computeLeadingWhitespaces(declarationList.parent)}let ${declaration.getText()};`
            ),
        ];
    }

    return [fix];
}

// ----------------------------------------------------------------------------

/**
 * @param {ts.DeclarationList} declarationList
 * @param {ts.VariableDeclaration} declaration
 */
function getPreviousCommaToken(declarationList, declaration) {
    const children = declarationList.getChildren()[1].getChildren();
    const declarationIndex = children.indexOf(declaration);
    console.assert(declarationIndex !== -1);
    const leftSibling = children[declarationIndex - 1];
    if (leftSibling.kind === ts.SyntaxKind.CommaToken) {
        return leftSibling;
    }
}

/**
 * @param {ts.DeclarationList} declarationList
 * @param {ts.VariableDeclaration} declaration
 */
function getNextCommaToken(declarationList, declaration) {
    const children = declarationList.getChildren()[1].getChildren();
    const declarationIndex = children.indexOf(declaration);
    console.assert(declarationIndex !== -1);
    if (declarationIndex === children.length - 1) {
        return;
    }
    const rightSibling = children[declarationIndex + 1];
    if (rightSibling.kind === ts.SyntaxKind.CommaToken) {
        return rightSibling;
    }
}

// ----------------------------------------------------------------------------

function computeLeadingWhitespaces(declaration) {
    let declarationText = declaration.getFullText();
    let whiteSpaces = '';
    declarationText = declarationText.replace(/(\r\n|\n|\r)/gm, '');
    for (const c of declarationText) {
        if (c === ' ' || c === '\t') {
            whiteSpaces += c;
        } else {
            break;
        }
    }
    return whiteSpaces;
}

// ----------------------------------------------------------------------------

module.exports = CodeAction;
