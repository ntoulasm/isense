const Utility = require('./utility');

const TypeCarrier = {};

TypeCarrier.createConstant = info => {

    const carrier = {};

    carrier.info = Utility.toArray(info);
    // carrier.getInfo = () => carrier.info;

    return carrier;

};

TypeCarrier.createVariable = symbol => {
    return {
        symbol
    };
};

TypeCarrier.copy = carrier => {
    return TypeCarrier.createConstant([...carrier.info]);
};

module.exports = TypeCarrier;