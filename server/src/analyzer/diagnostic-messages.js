const diagnosticCodes = require('./diagnostic-codes');

// ----------------------------------------------------------------------------

const vscode = require('vscode-languageserver');

// ----------------------------------------------------------------------------

module.exports = {
	undeclaredReference: {
		message: `'{0}' is not declared`,
		code: null,
		severity: vscode.DiagnosticSeverity.Error,
	},
	unreachableStatement: {
		message: 'Unreachable statement',
		code: 7027,
		severity: vscode.DiagnosticSeverity.Hint,
		tags: [vscode.DiagnosticTag.Unnecessary],
	},
	uninitializedConst: {
		message: `'{0}' is a constant but it is not initialized`,
		code: null,
		severity: vscode.DiagnosticSeverity.Error,
	},
	assignmentToConst: {
		message: `Assignment to constant variable '{0}'`,
		code: diagnosticCodes.assignmentToConst,
		severity: vscode.DiagnosticSeverity.Error,
	},
};
