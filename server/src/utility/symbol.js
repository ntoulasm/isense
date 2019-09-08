
const vscodeLanguageServer = require("vscode-languageserver");

const Symbol = {};

Symbol.SymbolType = {
	Variable: 0,
	Formal: 1,
	Function: 2,
	Class: 3,
	Constructor: 4,
	Method: 5
};

/**
 * @param {string} name
 * @param {number} symbolType
 * @param {number} start
 * @param {number} end
 * @param {boolean} isConst
 */
Symbol.createSymbol = function(name, symbolType, start, end, isConst = false) {
    return {
        name,
        symbolType,
        start,
        end,
        isConst
    };
}

Symbol.symbolTypeToVSCodeSymbolKind = function(type) {
    switch(type) {
        case Symbol.SymbolType.Variable: {
            return vscodeLanguageServer.SymbolKind.Variable;
        }
        case Symbol.SymbolType.Function: {
            return vscodeLanguageServer.SymbolKind.Function;
        }
        case Symbol.SymbolType.Formal: {
            return vscodeLanguageServer.SymbolKind.Variable;
        }
        case Symbol.SymbolType.Class: {
            return vscodeLanguageServer.SymbolKind.Class;
        }
        case Symbol.SymbolType.Constructor: {
            return vscodeLanguageServer.SymbolKind.Constructor;
        }
        case Symbol.SymbolType.Method: {
            return vscodeLanguageServer.SymbolKind.Method;
        }
        default: {
            console.assert(false);
        }
    }
};

module.exports = Symbol;