const SymbolTable = require('./symbol-table');
const Utility = require('./utility');
const Symbol = require('./symbol');
const TypeInfo = require('./type-info');

// ----------------------------------------------------------------------------

const ts = require('typescript');

// ----------------------------------------------------------------------------

/**
 * @typedef isense.Type
 * @property {isense.TypeId} id
 * @property {*} value
 * @property {ts.Node} [node]
 * @property {Array<isense.symbol>} [properties]
 * @property {Array<isense.symbol>} [references]
 */

/**
 * @typedef isense.TypeCarrier
 * @property {() => isense.symbol} getSymbol
 * @property {() => String} getSymbolName
 * @property {(types: Array<isense.Type>) => void} setTypes
 * @property {()=>Array<isense.Type} getTypes
 * @property {()=>Boolean} hasUniqueType
 */

// ----------------------------------------------------------------------------

const TypeCarrier = {};

/**
 * @param {isense.symbol} symbol
 * @param {} types
 * 
 * @returns {isense.TypeCarrier}
 */
TypeCarrier.create = (symbol, types) => {

    const typeCarrier = {};
    typeCarrier.private = {};

    typeCarrier.getSymbol = () => {
        return typeCarrier.private.symbol;
    };

    typeCarrier.getSymbolName = () => {
        return typeCarrier.private.symbol.name;
    };

    typeCarrier.setTypes = (types) => {
        typeCarrier.private.types = types;
    };

    typeCarrier.getTypes = () => {
        return typeCarrier.private.types;
    };

    typeCarrier.getSignature = () => {
        return typeCarrier.private.signature;
    };

    typeCarrier.hasUniqueType = () => {
        return typeCarrier.private.types.length === 1;
    };

    (function initializeTypeCarrier() {
        
        typeCarrier.private.symbol = symbol;
        typeCarrier.private.types = Utility.toArray(types);

        if(typeCarrier.hasUniqueType()) {
            const type = typeCarrier.private.types[0];
            if((type.type === TypeInfo.Type.Function || type.type === TypeInfo.Type.Class) && type.hasOwnProperty('node')) {
                if(!type.value.hasOwnProperty("constructorName")) {
                    type.value.constructorName = (type.value.kind === ts.SyntaxKind.Constructor) ? type.value.parent.name.getText() : symbol.name;
                }
            }
        }

    })();

    return typeCarrier;

};

TypeCarrier.copyTypeCarrier = typeCarrier => {
    const symbol = typeCarrier.getSymbol();
    const types = [...typeCarrier.getTypes()];
    return TypeCarrier.create(symbol, types);
};

module.exports = TypeCarrier;