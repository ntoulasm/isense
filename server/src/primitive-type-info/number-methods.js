const TypeCarrier = require('../utility/type-carrier');

module.exports = [
    {
        name: 'constructor',
        parameters: [

        ],
        returns: TypeCarrier.Type.Number
    },
    {
        name: 'toExponential',
        returns: TypeCarrier.Type.Number
    },
    {
        name: 'toFixed',
        returns: TypeCarrier.Type.Number
    },
    {
        name: 'toLocaleString'
    },
    {
        name: 'toPrecision',
        returns: TypeCarrier.Type.Number
    },
    {
        name: 'toString',
        returns: TypeCarrier.Type.String
    },
    {
        name: 'valueOf'
    },
    {
        name: 'hasOwnProperty'
    },
    {
        name: 'isPrototypeOf'
    },
    {
        name: 'propertyIsEnumerable'
    }
];