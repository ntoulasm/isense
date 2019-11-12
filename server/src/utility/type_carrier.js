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

let objectNesting = 0;
const computeSpaces = () => {
    let spaces = "";
    for(let i = 0; i < objectNesting; ++i) {
        spaces += "    ";
    }
    return spaces;
};

function valueToString(type) {

    switch(type.id) {
        case TypeCarrier.Type.String: {
            return '"' + type.value + '"';
        }
        case TypeCarrier.Type.Object: {

            ++objectNesting;
            let comma = false;
            let value = `{\n`;
            for(const [name, types] of Object.entries(type.value)) {
                if(comma) { value += ',\n'; }
                comma = true;
                value += computeSpaces();
                value += `${name}: ${TypeCarrier.typeToString(types[0])}`;
                value += `${types[0].value ? ' = ' + valueToString(types[0]) : ''}`
                for(let i = 1; i < types.length; ++i) {
                    value += ` | ${TypeCarrier.typeToString(types[i])}`;
                    value += `${types[i].value ? ' = ' + valueToString(types[i]) : ''}`;
                }
            }

            --objectNesting;
            value += `\n${computeSpaces()}}`;
            return value;

        }
        default: {
            return type.value;
        }
    }

}

function computeSignatureValue(type) {
    if(!type.hasOwnProperty("value") || type.id === TypeCarrier.Type.Function || type.id === TypeCarrier.Type.Class) {
        return "";
    }
    return " = " + valueToString(type);
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
                return (symbol.isConst ? "const " : "") + symbol.name + ": " + TypeCarrier.typeToString(type) + computeSignatureValue(type);
            }
        }
    }

    const types = typeCarrier.getTypes();
    let signature = computeSignature(types[0]);

    for(let i = 1; i < types.length; ++i) {
        signature += " ||\n" + computeSignature(types[i]);
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
            if(type.id === TypeCarrier.Type.Function || type.id === TypeCarrier.Type.Class) {
                if(!type.node.hasOwnProperty("constructorName")) {
                    type.node.constructorName = symbol.name;
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
            copy.value = {};
            for(const [propertyName, propertyTypes] of Object.entries(type.value)) {
                copy.value[propertyName] = [];
                for(const type of propertyTypes) {
                    copy.value[propertyName].push(TypeCarrier.copyType(type));
                }
            }
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

module.exports = TypeCarrier;