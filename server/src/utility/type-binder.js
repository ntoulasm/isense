const TypeCarrier = require('./type-carrier');

// ----------------------------------------------------------------------------

/**
 * @typedef isense.TypeBinder
 * @property {isense.symbol} symbol
 * @property {isense.TypeCarrier} carrier
 */

// ----------------------------------------------------------------------------

const TypeBinder = {};

/**
 * @param {isense.symbol} symbol
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {isense.TypeBinder}
 */
TypeBinder.create = (symbol, carrier) => {

    const binder = {};

    symbol.binders.push(binder);

    binder.symbol = symbol;
    binder.carrier = carrier;
    binder.parent = null;

    binder.setParentNode = parent => {
        if(!binder.parent) {
            binder.parent = parent;
        }
    };

    binder.getInfo = () => binder.carrier.getInfo(binder.parent);

    return binder;

};

// ----------------------------------------------------------------------------

module.exports = TypeBinder;