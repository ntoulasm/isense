const SymbolTable = require('./symbol-table');
const Utility = require('./utility');
const Symbol = require('./symbol');
const TypeInfo = require('./type-info');
const TypeCarrier = require('./type-carrier');

// ----------------------------------------------------------------------------

const ts = require('typescript');

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

/**
 * @param {isense.TypeBinder} binder
 * 
 * @returns {isense.TypeBinder}
 */
TypeBinder.copy = binder => {
    const symbol = binder.symbol;
    const carrier = TypeCarrier.copy(binder.carrier);
    return TypeBinder.create(symbol, carrier);
};

/**
 * 
 * @param {ts.Node} node 
 */
function findRightMostDescendant(node) {
    const children = node.getChildren();
    const total = children.length;
    return total ? findRightMostDescendant(children[total - 1]) : node;
}

/**
 * 
 * @param {ts.Node} node 
 */
function findPreviousNode(node) {
    let parent = node.parent;
    if(!parent) { return ; }
    const leftSibling = Ast.findLeftSibling(node);
    return leftSibling ? findRightMostDescendant(leftSibling) : parent;
}

module.exports = TypeBinder;