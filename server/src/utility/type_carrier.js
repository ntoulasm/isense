const SymbolTable = require('./symbol_table');
const Utility = require('./utility');

// ----------------------------------------------------------------------------

const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------


const TypeCarrier = {};
let totalObjects = -1;

TypeCarrier.Type = {
    Class: 0,
    Function: 1,
    Number: 2,
    String: 3,
    Boolean: 4,
    Array: 5,
    Object: 6,
    Undefined: 7,
    Null: 8
};

TypeCarrier.typeText = Object.keys(TypeCarrier.Type);

TypeCarrier.typeToString = type => {
    switch (type.id) {
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
            return type.hasOwnProperty("constructorName") ? type.constructorName : "object";
        }
        case TypeCarrier.Type.Undefined: {
            return "undefined";
        }
        case TypeCarrier.Type.Null: {
            return "null";
        }
        default: {
            console.assert(false, "Unknown type of type carrier");
        }
    }
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
        // typeCarrier.private.signature = computeSignature(typeCarrier);
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
        // typeCarrier.private.signature = computeSignature(typeCarrier);

        if(typeCarrier.hasUniqueType()) {
            const type = typeCarrier.private.types[0];
            if(type.id === TypeCarrier.Type.Function || type.id === TypeCarrier.Type.Class) {
                if(!type.node.hasOwnProperty("constructorName")) {
                    type.node.constructorName = (type.node.kind === ts.SyntaxKind.Constructor) ? type.node.parent.name.getText() : symbol.name;
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

TypeCarrier.copyType = type => {

    const copy = {};
    copy.id = type.id;

    switch (type.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(type.hasOwnProperty("value")) {
                copy.value = type.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            break;
        }
        case TypeCarrier.Type.Object: {
            copy.value = type.value;
            copy.properties = SymbolTable.copy(type.properties);
            copy.references = [...type.references];
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            if(type.hasOwnProperty("node")) {
                copy.node = type.node;
            }
            break;
        }
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            break;
        }
        default: {
            console.assert(false, `Unknown type ${type.id}`);
        }
    }

    return copy;

};

TypeCarrier.createEmptyObject = () => {
    return {
        id: TypeCarrier.Type.Object,
        value: ++totalObjects,
        properties: SymbolTable.create(),
        references: []
    };
};

TypeCarrier.createObject = () => {
    return {
        id: TypeCarrier.Type.Object
    };
}

TypeCarrier.createUndefined = () => {
    return {
        id: TypeCarrier.Type.Undefined
    };
};

module.exports = TypeCarrier;