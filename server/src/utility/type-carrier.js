const Utility = require('./utility');
const Ast = require('../ast/ast');

const TypeCarrier = {};

TypeCarrier.createConstant = info => {

    const carrier = {};

    carrier.info = Utility.toArray(info);

    carrier.getInfo = () => carrier.info;

    carrier.copy = () => TypeCarrier.createConstant([...carrier.info]);

    return carrier;

};

TypeCarrier.createVariable = (symbol, node) => {

    const carrier = {};

    carrier.symbol = symbol;
    carrier.node = node;

    carrier.getInfo = () => {
        console.assert(carrier.node);
        const binder = Ast.findClosestTypeBinder(carrier.node, carrier.symbol);
        return binder.getInfo();
    };

    carrier.copy = () => TypeCarrier.createVariable(carrier.symbol);

    return carrier;

};

TypeCarrier.copy = carrier => {
    return carrier.copy();
};

module.exports = TypeCarrier;