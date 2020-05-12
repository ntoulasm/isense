const SymbolTable = require('./symbol-table');
const Utility = require('./utility');
const Symbol = require('./symbol');
const TypeInfo = require('./type-info');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

/**
 * @typedef isense.TypeBinder
 * @property {() => isense.symbol} getSymbol
 * @property {() => String} getSymbolName
 * @property {(types: Array<isense.Type>) => void} setTypes
 * @property {()=>Array<isense.Type} getTypes
 * @property {()=>Boolean} hasUniqueType
 */

// ----------------------------------------------------------------------------

const TypeBinder = {};

/**
 * @param {isense.symbol} symbol
 * @param {} types
 * 
 * @returns {isense.TypeBinder}
 */
TypeBinder.create = (symbol, types) => {

    const binder = {};
    binder.private = {};

    binder.getSymbol = () => {
        return binder.private.symbol;
    };

    binder.getSymbolName = () => {
        return binder.private.symbol.name;
    };

    binder.setTypes = (types) => {
        binder.private.types = types;
    };

    binder.getTypes = () => {
        return binder.private.types;
    };

    binder.getSignature = () => {
        return binder.private.signature;
    };

    binder.hasUniqueType = () => {
        return binder.private.types.length === 1;
    };

    (function initializebinder() {
        
        binder.private.symbol = symbol;
        binder.private.types = Utility.toArray(types);

        if(binder.hasUniqueType()) {
            const type = binder.private.types[0];
            if((type.type === TypeInfo.Type.Function || type.type === TypeInfo.Type.Class) && type.hasOwnProperty('node')) {
                if(!type.value.hasOwnProperty("constructorName")) {
                    type.value.constructorName = (type.value.kind === ts.SyntaxKind.Constructor) ? type.value.parent.name.getText() : symbol.name;
                }
            }
        }

    })();

    return binder;

};

/**
 * @param {isense.TypeBinder} binder
 * 
 * @returns {isense.TypeBinder}
 */
TypeBinder.copy = binder => {
    const symbol = binder.getSymbol();
    const types = [...binder.getTypes()];
    return TypeBinder.create(symbol, types);
};

module.exports = TypeBinder;