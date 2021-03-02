const vscodeLanguageServer = require('vscode-languageserver');
const Utility = require('../utility/utility');

// ----------------------------------------------------------------------------


const AnalyzeDiagnostic = {};

AnalyzeDiagnostic.Type = vscodeLanguageServer.DiagnosticSeverity;

AnalyzeDiagnostic.Tag = vscodeLanguageServer.DiagnosticTag;

/**
 * @param {ts.Node} node
 * @param {Object} config
 * @param {Array<String>} [messageParameters = []]
 */
AnalyzeDiagnostic.create = (node, config, messageParameters = []) => {

    const ast = node.getSourceFile();
    const startPosition = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    const endPosition = ast.getLineAndCharacterOfPosition(node.end);
    const range = vscodeLanguageServer.Range.create(
        vscodeLanguageServer.Position.create(startPosition.line, startPosition.character),
        vscodeLanguageServer.Position.create(endPosition.line, endPosition.character)
    );
    console.assert(config.hasOwnProperty('message'), 'Invalid diagnostic with no message');
    console.assert(config.hasOwnProperty('severity'), 'Invalid diagnostic with no severity');
    !config.hasOwnProperty('code') && (config.code = null);
    !config.hasOwnProperty('source') && (config.source = '');
    const diagnostic = vscodeLanguageServer.Diagnostic.create(
        range, Utility.format(config.message, messageParameters), config.severity, config.code, '', undefined
    );
    config.hasOwnProperty('tags') && (diagnostic.tags = config.tags);

    return diagnostic;

};

module.exports = AnalyzeDiagnostic;