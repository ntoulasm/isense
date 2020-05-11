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
    newType.id = TypeCarrier.Type.Number;

    switch(type.id) {
        case TypeCarrier.Type.Number: {
            if(type.hasOwnProperty("value")) {
                newType.value = type.value;
            }
            break;
        }
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(type.hasOwnProperty("value")) {
                newType.value = Number(type.value);
            }
            break;
        }
        case TypeCarrier.Type.Array:
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            newType.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            newType.value = 0;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeCarrier.typeText[type.id]}' to number`);
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
    newType.id = TypeCarrier.Type.String;

    switch(type.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean: {
            if(type.hasOwnProperty("value")) {
                newType.value = String(type.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            if(type.hasOwnProperty("value")) {
                newType.value = type.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            if(type.hasOwnProperty("value")) {
                newType.value = type.value;
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            if(type.hasOwnProperty("node")) {
                newType.value = type.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            newType.value = "null";
            break;
        }
        case TypeCarrier.Type.Undefined: {
            newType.value = "undefined";
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeCarrier.typeText[type.id]}' to string`);
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
    newType.id = TypeCarrier.Type.Boolean;

    switch(type.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String: {
            if(type.hasOwnProperty("value")) {
                newType.value = Boolean(type.value);
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            if(type.hasOwnProperty("value")) {
                newType.value = type.value;
            }
            break;
        }
        case TypeCarrier.Type.Array:
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            newType.value = true;
            break;
        }
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            newType.value = false;
            break;
        }
        case TypeCarrier.Type.Any: {
            break;
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeCarrier.typeText[type.id]}' to boolean`);
            break;
        }
    }

    return newType;

};

module.exports = TypeCaster;