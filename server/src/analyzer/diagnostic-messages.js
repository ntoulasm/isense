const vscode = require('vscode-languageserver');

module.exports = {
    undeclaredReference: {
        message: `'{0}' is not declared.`,
        code: null,
        severity: vscode.DiagnosticSeverity.Error
    },
    unreachableStatement: {
        message: 'Unreachable statement.',
        code: 7027,
        severity: vscode.DiagnosticSeverity.Hint,
        tags: [
            vscode.DiagnosticTag.Unnecessary
        ]
    }
}