const TypeCarrier = require('../utility/type_carrier');
const Utility = require('../utility/utility');

const TypeCaster = {};

TypeCaster.toString = type => {

    switch(type.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean: {
            return type.hasOwnProperty("value") ? String(type.value) : undefined;
        }
        case TypeCarrier.Type.String: {
            return type.hasOwnProperty("value") ? type.value : undefined;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            return type.hasOwnProperty("value") ? type.value : undefined;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            return "[object Object]";
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            return type.hasOwnProperty("node") ? type.node.getText() : undefined;
        }
        case TypeCarrier.Type.Null: {
            return "null";
        }
        case TypeCarrier.Type.Undefined: {
            return "undefined";
        }
        default: {
            Utility.assert(false, `Can not cast '${TypeCarrier.typeText[type.id]}' to string`);
        }
    }

};

module.exports = TypeCaster;