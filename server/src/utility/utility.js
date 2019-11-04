const vscodeLanguageServer = require('vscode-languageserver');
const ts = require('typescript');

const Utility = {};

Utility.isNumber = function(value) {
    return typeof(value) == "number";
};

Utility.isString = function(value) {
    return typeof(value) == "string";
};

Utility.isBoolean = function(value) {
    return typeof(value) == "boolean";
};

Utility.isFunction = function(value) {
    return value instanceof Function;
};

Utility.isArray = function(value) {
    return value instanceof Array;
};

Utility.isObject = function(value) {
    return !Utility.isArray(value) &&
        !Utility.isFunction(value) &&
        value instanceof Object;
};

Utility.isUndefined = function(value) {
    return value === undefined;
};

Utility.isNull = function(value) {
    return value === null;
};

Utility.toArray = value => {
    return Utility.isArray(value) ? value : [value];
};

/**
 * @param {string} code
 * @param {number} offset
 */
Utility.computeActiveParameter = function(code, offset, callStart) {

    let currentCall = 1;
    let activeParameter = 0;
    let character;

    while(offset > callStart) {
        character = code[offset--];
        if(character === "(" && --currentCall === 0) {
            return activeParameter;
        } else if(character === ")") {
            ++currentCall;
        } else if(character === "," && currentCall === 1) { 
            ++activeParameter; 
        }
    }

    return -1;

};

Utility.typescriptDiagnosticCategoryToVSCodeDiagnosticSeverity = function(diagnosticCategory) {
    switch(diagnosticCategory) {
        case ts.DiagnosticCategory.Error: {
            return vscodeLanguageServer.DiagnosticSeverity.Error;
        }
        case ts.DiagnosticCategory.Warning: {
            return vscodeLanguageServer.DiagnosticSeverity.Warning;
        }
        case ts.DiagnosticCategory.Suggestion: {
            return vscodeLanguageServer.DiagnosticSeverity.Hint;
        }
        case ts.DiagnosticCategory.Message: {
            return vscodeLanguageServer.DiagnosticSeverity.Information;
        }
        default: {
            console.assert(false);
        }
    }
};

const ISenseAssertion = class extends Error {
    constructor(message) {
        super(message);
        this.name = 'ISenseAssertion';
        Error.captureStackTrace(this, ISenseAssertion);
    }
};

/**
 * @param {boolean} condition
 * @param {string} [message]
 */
Utility.assert = (condition, message = '') => {
    if(!condition) {
        throw new ISenseAssertion(message);
    }
};

/**
 * @param {ts.Node} node
 */
Utility.isMemberInitialization = node => {
    Utility.assert(node.kind === ts.SyntaxKind.BinaryExpression);
    return node.operatorToken.kind === ts.SyntaxKind.EqualsToken && 
        node.left.kind === ts.SyntaxKind.PropertyAccessExpression &&
        node.left.expression.kind === ts.SyntaxKind.ThisKeyword;
};

module.exports = Utility;