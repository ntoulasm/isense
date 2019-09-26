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

/**
 * @param {ts.Node} variableDeclarationList
 */
Utility.isConstDeclaration = function(variableDeclarationList) {
    return (variableDeclarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const;
};

/**
 * @param {ts.Node} variableDeclarationList
 */
Utility.isLetDeclaration = function(variableDeclarationList) {
    return (variableDeclarationList.flags & ts.NodeFlags.Let) === ts.NodeFlags.Let;
};

/**
 * @param {ts.Node} variableDeclarationList
 */
Utility.isVarDeclaration = function(variableDeclarationList) {
    return !Utility.isConstDeclaration(variableDeclarationList) && !Utility.isLetDeclaration(variableDeclarationList); 
};

Utility.javaScriptDocumentScheme = {
    language: 'javascript',
    scheme: 'file'
};

Utility.isJavaScriptDocument = function(document) {
    return document.languageId == "javascript";
};

/**
 * @param {ts.SourceFile} ast
 */
Utility.hasParseError = function(ast) {
    for(const parseDiagnostic of ast.parseDiagnostics) {
        if(parseDiagnostic.category === ts.DiagnosticCategory.Error) {
            return true;
        }
    }
    return false;
};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 */
Utility.getStatementAtOffset = function(ast, offset) {
    return ts.forEachChild(ast, function(node) {
        if(node.getStart() <= offset && node.end >= offset) {
            return node;
        }
    });
};

/**
 * @param {ts.SourceFile} ast
 * @param {number} offset
 * @param {number} kind
 */
Utility.getNodeAtOffset = function (ast, offset, kind) {
    function getNodeAtOffset(node) {
        if(node.getStart() <= offset && node.end >= offset) {
            if(node.kind === kind) { return node; }
            return ts.forEachChild(node, getNodeAtOffset);
        }
    }
    return ts.forEachChild(ast, getNodeAtOffset);
};

Utility.getInnermostNodeAtOffset = function(ast, offset, kind) {
    function getInnermostNodeAtOffset(node) {
        if(node.getStart() <= offset && node.end >= offset) {
            if(node.kind === kind) {
                const innermostNode = ts.forEachChild(node, getInnermostNodeAtOffset);
                return (innermostNode) ? innermostNode : node; 
            }
            return ts.forEachChild(node, getInnermostNodeAtOffset);
        }
    }
    return ts.forEachChild(ast, getInnermostNodeAtOffset);
};

/**
 * @param {string} code
 * @param {number} offset
 */
Utility.computeActiveParameter = function(code, offset) {

    let currentCall = 1;
    let activeParameter = 0;
    let character;

    while(true) {
        character = code[offset--];
        if(character === "(" && --currentCall === 0) {
            break;
        } else if(character === ")") {
            ++currentCall;
        } else if(character === "," && currentCall === 1) { 
            ++activeParameter; 
        }
    }

    return activeParameter;

};

/**
 * @param {ts.Node} node
 */
Utility.computeChildren = function(node) {
    const children = [];
    ts.forEachChild(node, child => {
        children.push(child);
    });
    return children;
};

/**
 * @param {ts.Node} node
 */
Utility.computeSiblings = function(node) {
    const parent = node.parent;
    if(parent === undefined) { return [node]; }
    return Utility.computeChildren(parent);
};

/**
 * @param {ts.Node} node
 */
Utility.findLeftSibling = function(node) {
    const siblings = Utility.computeSiblings(node);
    const nodeIndex = siblings.indexOf(node);
    return nodeIndex === 0 ? undefined : siblings[nodeIndex - 1];
};

/**
 * @param {ts.Node} node
 * @param {function} cb
 */
Utility.forEachSymbol = function(node, cb) {
    function forEachSymbol(node) {
        if(node.symbols) {
            for(const [, symbol] of Object.entries(node.symbols.getSymbols())) {
                cb(symbol);
            }
        }
        if(node.innerSymbols) {
            for(const [, symbol] of Object.entries(node.innerSymbols.getSymbols())) {
                cb(symbol);
            }
        }
        ts.forEachChild(node, forEachSymbol);
    }
    forEachSymbol(node);
};

/**
 * @param {ts.Node} node
 * @param {function} cb
 */
Utility.forEachSymbolReversed = function(node, cb) {
    if(node.symbols) { 
        for(const [, symbol] of Object.entries(node.symbols.getSymbols())) {
            if(cb(symbol)) { return symbol; }
        }
    }
    const parent = node.parent;
    if(!parent) { return undefined; }
    const leftSibling = Utility.findLeftSibling(node);
    if(leftSibling) { return Utility.forEachSymbolReversed(leftSibling, cb); }
    if(parent.innerSymbols) {
        for(const [, symbol] of Object.entries(parent.innerSymbols.getSymbols())) {
            if(cb(symbol)) { return symbol; }
        }
    }
    return Utility.forEachSymbolReversed(parent, cb);
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

/**
 * @param {ts.Node} node 
 * @param {string} name 
 */
Utility.lookUp = function(node, name) {
    return Utility.forEachSymbolReversed(node, function(symbol) {
        return symbol.name === name;
    });
}

/**
 * @param {object} symbol
 * @param {number} offset
 */
Utility.findActiveTypeCarrier = function(symbol, offset) {
    let activeTypeCarrier = {type: "undefined"};
    for(const typeCarrier of symbol.typeCarriers) {
        if(typeCarrier.start <= offset) {
            activeTypeCarrier = typeCarrier;
        }
    }
    return activeTypeCarrier;
};

/**
 * @param {object} symbol
 * @param {number} offset
 */
Utility.computeSymbolDetail = function(symbol, offset) {

    const activeTypeCarrier = Utility.findActiveTypeCarrier(symbol, offset);
    const type = activeTypeCarrier.type;

    if(type === "function") {
        return symbol.name + ": function() {}";
    } else if(type === "class") {
        return symbol.name + ": class {}";
    } else {
        return (symbol.isConst ? "const " : "") + symbol.name + ": " + activeTypeCarrier.type + (activeTypeCarrier.value !== undefined ? " = " + activeTypeCarrier.value : "");
    }

};

/**
 * @param {object} symbol
 * @param {number} offset
 */
Utility.computeCompletionItemKind = function(symbol, offset) {

    const activeTypeCarrier = Utility.findActiveTypeCarrier(symbol, offset);
    const type = activeTypeCarrier.type;

    if(type === "function") {
        return vscodeLanguageServer.CompletionItemKind.Function;
    } else if(type === "class") {
        return vscodeLanguageServer.CompletionItemKind.Class;
    } else {
        return vscodeLanguageServer.CompletionItemKind.Variable;
    }

};

/**
 * @param {isense.symbol} symbol
 * @param {number} offset
 */
Utility.computeSymbolKind = function(symbol, offset) {

    const activeTypeCarrier = Utility.findActiveTypeCarrier(symbol, offset);
    const type = activeTypeCarrier.type;

    if(type === "function") {
        return vscodeLanguageServer.SymbolKind.Function;
    } else if(type === "class") {
        return vscodeLanguageServer.SymbolKind.Class;
    } else {
        return vscodeLanguageServer.SymbolKind.Variable;
    }

};

module.exports = Utility;