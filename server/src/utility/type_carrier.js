const Utility = require('./utility');

const vscodeLanguageServer = require('vscode-languageserver');

const TypeCarrier = {};

TypeCarrier.Type = {
    Class: 0,
    Function: 1,
    Number: 2,
    String: 3,
    Boolean: 4,
    Array: 5,
    Object: 6,
    Undefined: 7,
    Null: 8,
    UserDefined: 9
};

TypeCarrier.typeToString = type => {
    switch (type.type) {
        case TypeCarrier.Type.Class: {
            return "class";
        }
        case TypeCarrier.Type.Function: {
            return "function";
        }
        case TypeCarrier.Type.Number: {
            return "number";
        }
        case TypeCarrier.Type.String: {
            return "string";
        }
        case TypeCarrier.Type.Boolean: {
            return "boolean";
        }
        case TypeCarrier.Type.Array: {
            return "array";
        }
        case TypeCarrier.Type.Object: {
            return "object";
        }
        case TypeCarrier.Type.Undefined: {
            return "undefined";
        }
        case TypeCarrier.Type.Null: {
            return "null";
        }
        case TypeCarrier.Type.UserDefined: {
            return type.name;
        }
        default: {
            console.assert(false, "Unknown type of type carrier");
        }
    }
};

function valueToString(type) {
    switch(type.type) {
        case TypeCarrier.Type.String: {
            return '"' + type.value + '"';
        }
        default: {
            return type.value;
        }
    }
}

function computeSignature(typeCarrier) {

    const symbol = typeCarrier.getSymbol();

    function computeSignature(type) {
        switch(type) {
            case TypeCarrier.Type.Class: {
                return symbol.name + ": class {}";
            }
            case TypeCarrier.Type.Function: {
                return symbol.name + ": function() {}";
            }
            default: {
                return (symbol.isConst ? "const " : "") + symbol.name + ": " + TypeCarrier.typeToString(type) + (type.value !== undefined ? " = " + valueToString(type) : "");
            }
        }
    }

    const types = typeCarrier.getTypes();
    let signature = computeSignature(types[0]);

    for(let i = 1; i < types.length; ++i) {
        signature += "||\n" + computeSignature(types[i]);
    }

    return signature;

};

/**
 * @param {isense.symbol} symbol
 * @param {} types
 */
TypeCarrier.create = (symbol, types) => {

    const typeCarrier = {};
    typeCarrier.private = {};

    typeCarrier.getSymbol = () => {
        return typeCarrier.private.symbol;
    };

    typeCarrier.getSymbolName = () => {
        return typeCarrier.private.symbol.name;
    };

    typeCarrier.setTypes = (types) => {
        typeCarrier.private.types = types;
        typeCarrier.private.signature = computeSignature(typeCarrier);
    };

    typeCarrier.getTypes = () => {
        return typeCarrier.private.types;
    };

    typeCarrier.getSignature = () => {
        return typeCarrier.private.signature;
    };

    typeCarrier.hasUniqueType = () => {
        return typeCarrier.private.types.length === 1;
    };

    (function initializeTypeCarrier() {
        
        typeCarrier.private.symbol = symbol;
        typeCarrier.private.types = Utility.toArray(types);
        typeCarrier.private.signature = computeSignature(typeCarrier);

        if(typeCarrier.hasUniqueType()) {
            const type = typeCarrier.private.types[0];
            if(type.type === TypeCarrier.Type.Function || type.type === TypeCarrier.Type.Class) {
                if(!type.node.hasOwnProperty("constructorType")) {
                    type.node.constructorType = {
                        type: TypeCarrier.Type.UserDefined,
                        name: symbol.name
                    };
                }
            }
        }

    })();

    return typeCarrier;

};

TypeCarrier.copyTypeCarrier = typeCarrier => {
    const symbol = typeCarrier.getSymbol();
    const types = [...typeCarrier.getTypes()];
    return TypeCarrier.create(symbol, types);
};

TypeCarrier.typeToVSCodeSymbolKind = type => {
    switch (type) {
        case TypeCarrier.Type.Class: {
            return vscodeLanguageServer.SymbolKind.Class;
        }
        case TypeCarrier.Type.Function: {
            return vscodeLanguageServer.SymbolKind.Function;
        }
        default: {
            return vscodeLanguageServer.SymbolKind.Variable;
        }
    }
};

TypeCarrier.typeToVSCodeCompletionItemKind = type => {
    switch (type) {
        case TypeCarrier.Type.Class: {
            return vscodeLanguageServer.CompletionItemKind.Class;
        }
        case TypeCarrier.Type.Function: {
            return vscodeLanguageServer.CompletionItemKind.Function;
        }
        default: {
            return vscodeLanguageServer.CompletionItemKind.Variable;
        }
    }
};

module.exports = TypeCarrier;