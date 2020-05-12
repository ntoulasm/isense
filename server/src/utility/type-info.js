const SymbolTable = require('./symbol-table');

const vscodeLanguageServer = require('vscode-languageserver');

const TypeInfo = {};

/**
 * @typedef {Number} isense.TypeInfo.Type
 */

/**
 * @typedef isense.TypeInfo
 * @property {isense.TypeInfo.Type} type
 * @property {*} value
 * @property {Boolean} hasValue
 */

TypeInfo.Type = {
    Class: 0,
    Function: 1,
    Number: 2,
    String: 3,
    Boolean: 4,
    Array: 5,
    Object: 6,
    Undefined: 7,
    Null: 8,
    Any: 9
};

TypeInfo.typeTextMap = Object.keys(TypeInfo.Type);
TypeInfo.typeTextMapLowerCase = TypeInfo.typeTextMap.map(t => t.toLowerCase());

/**
 * @param {isense.TypeInfo} info
 * 
 * @returns {String}
 */
TypeInfo.typeToString = info => {
    switch (info.type) {
        case TypeInfo.Type.Class: {
            return "class";
        }
        case TypeInfo.Type.Function: {
            return "function";
        }
        case TypeInfo.Type.Number: {
            return "number";
        }
        case TypeInfo.Type.String: {
            return "string";
        }
        case TypeInfo.Type.Boolean: {
            return "boolean";
        }
        case TypeInfo.Type.Array: {
            return "array";
        }
        case TypeInfo.Type.Object: {
            return info.hasOwnProperty("constructorName") ? info.constructorName : "object";
        }
        case TypeInfo.Type.Undefined: {
            return "undefined";
        }
        case TypeInfo.Type.Null: {
            return "null";
        }
        case TypeInfo.Type.Any: {
            return "any";
        }
        default: {
            console.assert(false, `Unknown type info type '${info.type}'.`);
        }
    }
};

/**
 * @param {isense.TypeInfo.Type} type
 * @param {*} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.create = (type, value) => {
    return {
        type,
        value,
        hasValue: value !== undefined
    };
};

/**
 * @param {isense.TypeInfo} info
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.copy = info => {

    const copy = {};
    copy.type = info.type;
    copy.value = info.value;
    copy.hasValue = info.hasValue;

    switch (info.type) {
        case TypeInfo.Type.Object:
            copy.value = info.value;
            copy.properties = SymbolTable.copy(info.properties);
            copy.references = [...info.references];
            break;
        default: 
            break;
    }

    return copy;

};

// TODO: unused function
// TODO: move to server?
TypeInfo.toVSCodeSymbolKind = type => {
    switch (type) {
        case TypeInfo.Type.Class: {
            return vscodeLanguageServer.SymbolKind.Class;
        }
        case TypeInfo.Type.Function: {
            return vscodeLanguageServer.SymbolKind.Function;
        }
        default: {
            return vscodeLanguageServer.SymbolKind.Variable;
        }
    }
};

// TODO: move to server?
TypeInfo.toVSCodeCompletionItemKind = type => {
    switch (type) {
        case TypeInfo.Type.Class: {
            return vscodeLanguageServer.CompletionItemKind.Class;
        }
        case TypeInfo.Type.Function: {
            return vscodeLanguageServer.CompletionItemKind.Function;
        }
        default: {
            return vscodeLanguageServer.CompletionItemKind.Variable;
        }
    }
};

/**
 * @param {Number} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createNumber = value => TypeInfo.create(TypeInfo.Type.Number, value);

/**
 * @param {String} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createString = value => TypeInfo.create(TypeInfo.Type.String, value);

/**
 * @param {Boolean} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createBoolean = value => TypeInfo.create(TypeInfo.Type.Boolean, value);

/**
 * @param {Array} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createArray = value => TypeInfo.create(TypeInfo.Type.Array, value);

let totalObjects = -1;
/**
 * @param {Number} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createObject = value => {
    value = !value || ++totalObjects;
    const t = TypeInfo.create(TypeInfo.Type.Object, value);
    t.properties = SymbolTable.create();
    t.references = [];
    return t;
};

/**
 * @param {ts.Node} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createFunction = value => TypeInfo.create(TypeInfo.Type.Function, value);

/**
 * @param {ts.Node} value
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.createClass = value => TypeInfo.create(TypeInfo.Type.Class, value);

/**
 * @returns {isense.TypeInfo}
 */
TypeInfo.createUndefined = () => TypeInfo.create(TypeInfo.Type.Undefined);

/**
 * @returns {isense.TypeInfo}
 */
TypeInfo.createNull = value => TypeInfo.create(TypeInfo.Type.Null, value);

/**
 * @returns {isense.TypeInfo}
 */
TypeInfo.createAny = value => TypeInfo.create(TypeInfo.Type.Any, value);

module.exports = TypeInfo;