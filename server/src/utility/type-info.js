const SymbolTable = require('./symbol-table');

// ----------------------------------------------------------------------------

const TypeInfo = {};

// ----------------------------------------------------------------------------

/**
 * @typedef {Number} isense.TypeInfo.Type
 */

/**
 * @typedef isense.TypeInfo
 * @property {isense.TypeInfo.Type} type
 * @property {*} value
 * @property {Boolean} hasValue
 */

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

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
            return info.constructorName || "object";
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

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

/**
 * @param {isense.TypeInfo} info
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.toNumber = info => {
    switch(info.type) {
        case TypeInfo.Type.Number: {
            return info;
        }
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(info.hasValue) {
                return TypeInfo.createNumber(Number(info.value));
            }
            break;
        }
        case TypeInfo.Type.Array:
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Undefined: {
            return TypeInfo.createNumber(NaN);
        }
        case TypeInfo.Type.Null: {
            return TypeInfo.createNumber(0);
        }
        case TypeInfo.Type.Any: {
            break;
        }
        default: {
            console.assert(false, `Can not cast '${TypeInfo.typeTextMap[info.type]}' to number`);
            break;
        }
    }

    return TypeInfo.createNumber();

};

/**
 * @param {isense.TypeInfo} info
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.toString = info => {

    switch(info.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.Boolean: {
            if(info.hasValue) {
                return TypeInfo.createString(String(info.value));
            }
            break;
        }
        case TypeInfo.Type.String: {
            return info;
        }
        case TypeInfo.Type.Array: {
            // TODO: add logic
            break;
        }
        case TypeInfo.Type.Object: {
            return TypeInfo.createString("[object Object]");
        }
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            if(info.hasValue) {
                return TypeInfo.createString(info.value.getText());
            }
            break;
        }
        case TypeInfo.Type.Null: {
            return TypeInfo.createString('null');
        }
        case TypeInfo.Type.Undefined: {
            return TypeInfo.createString('undefined');
        }
        case TypeInfo.Type.Any: {
            break;
        }
        default: {
            console.assert(false, `Can not cast '${TypeInfo.typeTextMap[info.type]}' to string`);
            break;
        }
    }

    return TypeInfo.createString();

};

/**
 * @param {isense.TypeInfo} info
 * 
 * @returns {isense.TypeInfo}
 */
TypeInfo.toBoolean = info => {

    switch(info.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String: {
            if(info.hasValue) {
                return TypeInfo.createBoolean(Boolean(info.value))
            }
            break;
        }
        case TypeInfo.Type.Boolean: {
            return info;
        }
        case TypeInfo.Type.Array:
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            return TypeInfo.createBoolean(true);
        }
        case TypeInfo.Type.Null:
        case TypeInfo.Type.Undefined: {
            return TypeInfo.createBoolean(false);
        }
        case TypeInfo.Type.Any: {
            break;
        }
        default: {
            console.assert(false, `Can not cast '${TypeInfo.typeTextMap[info.type]}' to boolean`);
            break;
        }
    }

    return TypeInfo.createBoolean();

};

// ----------------------------------------------------------------------------

TypeInfo.isStringLike = info => {
    return info.type === TypeInfo.Type.String || 
        info.type === TypeInfo.Type.Array || 
        info.type === TypeInfo.Type.Object || 
        info.type === TypeInfo.Type.Function || 
        info.type === TypeInfo.Type.Class;
};

TypeInfo.hasUniqueType = typeInfo => {
    console.assert(typeInfo.length, 'hasUniqueType');
	const firstType = typeInfo[0].type;
	return !typeInfo.find(t => t.type !== firstType);
};

// ----------------------------------------------------------------------------

module.exports = TypeInfo;