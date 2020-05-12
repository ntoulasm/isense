const TypeInfo = require('../utility/type-info');
const TypeCarrier = require('../utility/type-carrier');
const Utility = require('../utility/utility');

// ----------------------------------------------------------------------------


const TypeCaster = {};

/**
 * @param {isense.Type} type
 * 
 * @returns {isense.Type}
 */
TypeCaster.toNumber = type => {

    const newType = {};
    newType.type = TypeInfo.Type.Number;

    switch(type.type) {
        case TypeInfo.Type.Number: {
            if(type.hasValue) {
                newType.value = type.value;
            }
            break;
        }
        case TypeInfo.Type.String:
        case TypeInfo.Type.Boolean: {
            if(type.hasValue) {
                newType.value = Number(type.value);
            }
            break;
        }
        case TypeInfo.Type.Array:
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class:
        case TypeInfo.Type.Undefined: {
            newType.value = NaN;
            break;
        }
        case TypeInfo.Type.Null: {
            newType.value = 0;
            break;
        }
        case TypeInfo.Type.Any: {
            break;
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeInfo.typeTextMap[type.type]}' to number`);
            break;
        }
    }

    return newType;

};

/**
 * @param {isense.Type} type
 * 
 * @returns {isense.Type}
 */
TypeCaster.toString = type => {

    const newType = {};
    newType.type = TypeInfo.Type.String;

    switch(type.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.Boolean: {
            if(type.hasValue) {
                newType.value = String(type.value);
            }
            break;
        }
        case TypeInfo.Type.String: {
            if(type.hasValue) {
                newType.value = type.value;
            }
            break;
        }
        case TypeInfo.Type.Array: {
            // TODO: add logic
            if(type.hasValue) {
                newType.value = type.value;
            }
            break;
        }
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            if(type.hasOwnProperty("node")) {
                newType.value = type.value.getText();
            }
            break;
        }
        case TypeInfo.Type.Null: {
            newType.value = "null";
            break;
        }
        case TypeInfo.Type.Undefined: {
            newType.value = "undefined";
            break;
        }
        case TypeInfo.Type.Any: {
            break;
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeInfo.typeTextMap[type.type]}' to string`);
            break;
        }
    }
    return newType;

};

/**
 * @param {isense.Type} type
 * 
 * @returns {isense.Type}
 */
TypeCaster.toBoolean = type => {

    const newType = {};
    newType.type = TypeInfo.Type.Boolean;

    switch(type.type) {
        case TypeInfo.Type.Number:
        case TypeInfo.Type.String: {
            if(type.hasValue) {
                newType.value = Boolean(type.value);
            }
            break;
        }
        case TypeInfo.Type.Boolean: {
            if(type.hasValue) {
                newType.value = type.value;
            }
            break;
        }
        case TypeInfo.Type.Array:
        case TypeInfo.Type.Object:
        case TypeInfo.Type.Function:
        case TypeInfo.Type.Class: {
            newType.value = true;
            break;
        }
        case TypeInfo.Type.Null:
        case TypeInfo.Type.Undefined: {
            newType.value = false;
            break;
        }
        case TypeInfo.Type.Any: {
            break;
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeInfo.typeTextMap[type.type]}' to boolean`);
            break;
        }
    }

    return newType;

};

module.exports = TypeCaster;