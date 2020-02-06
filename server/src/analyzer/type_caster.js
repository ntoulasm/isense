const TypeCarrier = require('../utility/type_carrier');
const Utility = require('../utility/utility');

const TypeCaster = {};

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
        default: {
            Utility.assert(false, `Can not cast '${TypeCarrier.typeText[type.id]}' to string`);
            break;
        }
    }
    return newType;

};


};

module.exports = TypeCaster;