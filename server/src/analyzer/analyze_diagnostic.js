const vscodeLanguageServer = require('vscode-languageserver');

const AnalyzeDiagnostic = {};

AnalyzeDiagnostic.Type = {
    Error: 1,
    Warning: 2,
    Information: 3,
    Hint: 4
}

/**
 * @param {object} startPosition
 * @param {object} endPosition
 * @param {string} message
 * @param {number} [type=AnalyzeDiagnostic.Type.Error]
 */
AnalyzeDiagnostic.create = (startPosition, endPosition, message, type = AnalyzeDiagnostic.Type.Error) => {

    const range = vscodeLanguageServer.Range.create(
        vscodeLanguageServer.Position.create(startPosition.line, startPosition.character),
        vscodeLanguageServer.Position.create(endPosition.line, endPosition.character)
    );

    return {
        range,
        message,
        type
    };

};

module.exports = AnalyzeDiagnostic;