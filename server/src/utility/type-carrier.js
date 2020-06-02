const Utility = require('./utility');
const Ast = require('../ast/ast');
const TypeInfo = require('./type-info');

const TypeCarrier = {};

TypeCarrier.createConstant = info => {

    const carrier = {};

    carrier.info = Utility.toArray(info);

    carrier.getInfo = () => carrier.info;

    carrier.copy = () => {
        return TypeCarrier.createConstant(carrier.info.map(i => TypeInfo.copy(i)));
    };

    return carrier;

};

TypeCarrier.createVariable = (symbol, node) => {

    const carrier = {};

    carrier.symbol = symbol;
    carrier.node = node;

    carrier.getInfo = () => {
        console.assert(carrier.node);
        const binders = Ast.findActiveTypeBinders(carrier.node, carrier.symbol);
        const typeInfo = [];
        for(const b of binders) {
            typeInfo.push(...b.getInfo());
        }
        return typeInfo;
    };

    carrier.copy = () => TypeCarrier.createVariable(carrier.symbol, carrier.node);

    return carrier;

};

    return carrier;

};

TypeCarrier.copy = carrier => {
    return carrier.copy();
};

module.exports = TypeCarrier;