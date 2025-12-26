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
        vscodeLanguageServer.Position.create(
            startPosition.line,
            startPosition.character
        ),
        vscodeLanguageServer.Position.create(
            endPosition.line,
            endPosition.character
        )
    );
    console.assert(
        Object.hasOwn(config, 'message'),
        'Invalid diagnostic with no message'
    );
    console.assert(
        Object.hasOwn(config, 'severity'),
        'Invalid diagnostic with no severity'
    );
    !Object.hasOwn(config, 'code') && (config.code = null);
    !Object.hasOwn(config, 'source') && (config.source = '');
    const diagnostic = vscodeLanguageServer.Diagnostic.create(
        range,
        Utility.format(config.message, messageParameters),
        config.severity,
        config.code,
        '',
        undefined
    );
    Object.hasOwn(config, 'tags') && (diagnostic.tags = config.tags);

    return diagnostic;
};

module.exports = AnalyzeDiagnostic;
