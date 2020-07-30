const Utility = require('./utility');
const Ast = require('../ast/ast');
const TypeInfo = require('./type-info');

const ts = require('typescript');
const { findPreviousNode } = require('../ast/ast');

//  ----------------------------------------------------------------------------------

const TypeCarrier = {};

TypeCarrier.Kind = {
    Constant: 0,
    Variable: 1,
    BinaryExpression: 2,
    PrefixUnaryExpression: 3,
    PostfixUnaryExpression: 4,
    TypeOfExpression: 5,

};

//  ----------------------------------------------------------------------------------

TypeCarrier.create = kind => {
    return { kind };
};

TypeCarrier.createConstant = info => {

    const carrier = TypeCarrier.create(TypeCarrier.Kind.Constant);

    carrier.info = Utility.toArray(info);

    return carrier;

};

TypeCarrier.createVariable = (symbol, node) => {

    const carrier = TypeCarrier.create(TypeCarrier.Kind.Variable);

    carrier.symbol = symbol;
    carrier.node = node;

    return carrier;

};

TypeCarrier.createBinaryExpression = (left, op, right) => {
      
    const carrier = TypeCarrier.create(TypeCarrier.Kind.BinaryExpression);

    carrier.left = left;
    carrier.op = op;
    carrier.right = right;

    return carrier;

};

TypeCarrier.createPrefixUnaryExpression = (op, operand) => {

    const carrier = TypeCarrier.create(TypeCarrier.Kind.PrefixUnaryExpression);

    carrier.op = op;
    carrier.operand = operand;

    return carrier;

};

TypeCarrier.createPostfixUnaryExpression = (op, operand) => {

    const carrier = TypeCarrier.create(TypeCarrier.Kind.PostfixUnaryExpression);

    carrier.op = op;
    carrier.operand = operand;

    return carrier;

};


TypeCarrier.createTypeOfExpression = expression => {

    const carrier = TypeCarrier.create(TypeCarrier.Kind.TypeOfExpression);

    carrier.expression = expression;

    return carrier;

};

//  ----------------------------------------------------------------------------------

const copyFunctions = TypeCarrier.copyFunctions = [];

TypeCarrier.copy = carrier => {
    const f = copyFunctions[carrier.type];
    if(f) {
        return f(carrier);
    } else {
        console.assert(false, `Trying to copy unknown carrier '${carrier.kind}'`);
    }
};

copyFunctions[TypeCarrier.Kind.Constant] = carrier => {
    return TypeCarrier.createConstant(carrier.info.map(i => TypeInfo.copy(i)));
};

copyFunctions[TypeCarrier.Kind.Variable] = carrier => {
    return TypeCarrier.createVariable(carrier.symbol, carrier.node);
};

// TODO:
//  Think if I indeed need to copy carriers 
//  Implement copy functions

//  ----------------------------------------------------------------------------------

const evaluateFunctions = TypeCarrier.evaluateFunctions = {};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
TypeCarrier.evaluate = carrier => {
    const f = evaluateFunctions[carrier.kind];
    if(f) {
        return f(carrier);
    } else {
        console.assert(false, `Trying to evaluate unknown carrier '${carrier.kind}'`);
    }
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateFunctions[TypeCarrier.Kind.Constant] = carrier => {
    return carrier.info;
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateFunctions[TypeCarrier.Kind.Variable] = carrier => {

    console.assert(carrier.node);
    const binders = Ast.findActiveTypeBinders(carrier.node, carrier.symbol);
    const typeInfo = [];

    for(const b of binders) {
        typeInfo.push(...TypeCarrier.evaluate(b.carrier));
    }

    return typeInfo;

};

const evaluateBinaryExpressionFunctions = TypeCarrier.evaluateBinaryExpressionFunctions = [];

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateFunctions[TypeCarrier.Kind.BinaryExpression] = carrier => {
    const f = evaluateBinaryExpressionFunctions[carrier.op.kind];
    if(f) {
        return f(carrier);
    } else {
        console.assert(false, `Trying to evaluate unknown binary expression '${carrier.op.kind}'`);
    }
};

const evalutePrefixUnaryExpressionFunctions = TypeCarrier.evaluatePrefixUnaryExpressionFunctions = [];

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateFunctions[TypeCarrier.Kind.PrefixUnaryExpression] = carrier => {
    const f = evalutePrefixUnaryExpressionFunctions[carrier.op];
    if(f) {
        return f(carrier);
    } else {
        console.assert(false, `Trying to evaluate unknown prefix binary expression '${carrier.op}'`)
    }
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateFunctions[TypeCarrier.Kind.PostfixUnaryExpression] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => TypeInfo.toNumber(o));
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateFunctions[TypeCarrier.Kind.TypeOfExpression] = carrier => {
    return TypeCarrier.evaluate(carrier.expression).map(e => {
        switch(e.type) {
            case TypeInfo.Type.Number:
            case TypeInfo.Type.String:
            case TypeInfo.Type.Boolean:
            case TypeInfo.Type.Object:
            case TypeInfo.Type.Function:
            case TypeInfo.Type.Undefined: {
                return TypeInfo.createString(TypeInfo.typeToString(e));
            }
            case TypeInfo.Type.Array:
            case TypeInfo.Type.Class:
            case TypeInfo.Type.Null: {
                return TypeInfo.createString('object');
            }
            case TypeInfo.Type.Any: {
                // TODO: Add all possible types?
                return TypeInfo.createString();
            }
            default: {
                console.assert(false, "Unknown type");
                break;
            }
        }
    });
};

//  ----------------------------------------------------------------------------------

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.PlusToken] = carrier => {

    const leftInfo = TypeCarrier.evaluate(carrier.left);
    const rightInfo = TypeCarrier.evaluate(carrier.right);
    const info = [];

    const anyPlus = other => {
        if(TypeInfo.isStringLike(other.type)) {
            return [TypeInfo.createString()];
        } 
        return [
            TypeInfo.createString(),
            TypeInfo.createNumber()
        ];
    }

    const plus = (left, right) => {
        if(left.type === TypeInfo.Type.Any) {
            return anyPlus(right);
        } else if(right.type === TypeInfo.Type.Any) {
            return anyPlus(left);
        } else if(TypeInfo.isStringLike(left) || TypeInfo.isStringLike(right)) {
            if(left.hasValue && right.hasValue) {
                const leftString = TypeInfo.toString(left);
                const rightString = TypeInfo.toString(right);
                return [TypeInfo.createString(leftString.value + rightString.value)];
            }
            return [TypeInfo.createString()];
        } else {
            if(left.hasValue && right.hasValue) {
                const leftNumber = TypeInfo.toNumber(left);
                const rightNumber = TypeInfo.toNumber(right);
                return [TypeInfo.createNumber(leftNumber.value + rightNumber.value)];
            }
            return [TypeInfo.createNumber()];
        }
    };

    for(const l of leftInfo) {
        for(const r of rightInfo) {
            // TODO: Check if similar carrier already exists
            info.push(...plus(l, r));
        }
    }

    return info;

};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.MinusToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.AsteriskToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.SlashToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.PercentToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.AsteriskAsteriskToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.LessThanToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.LessThanEqualsToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.GreaterThanToken] = 
evaluateBinaryExpressionFunctions[ts.SyntaxKind.GreaterThanEqualsToken] =
evaluateBinaryExpressionFunctions[ts.SyntaxKind.AmpersandToken] =
evaluateBinaryExpressionFunctions[ts.SyntaxKind.BarToken] =
evaluateBinaryExpressionFunctions[ts.SyntaxKind.CaretToken] =
evaluateBinaryExpressionFunctions[ts.SyntaxKind.LessThanLessThanToken] =
evaluateBinaryExpressionFunctions[ts.SyntaxKind.GreaterThanGreaterThanToken] =
evaluateBinaryExpressionFunctions[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = carrier => {

    const leftInfo = TypeCarrier.evaluate(carrier.left);
    const rightInfo = TypeCarrier.evaluate(carrier.right);
    const info = [];

    for(const l of leftInfo) {
        for(const r of rightInfo) {
            // TODO: Check if similar carrier already exists
            if(l.hasValue && r.hasValue) {
                const leftNumber = TypeInfo.toNumber(l);
                const rightNumber = TypeInfo.toNumber(r);
                const op = Ast.operatorTokenToString(carrier.op);
                info.push(TypeInfo.createNumber(eval(leftNumber.value + op + rightNumber.value)));
            } else {
                info.push(TypeInfo.createNumber());
            }
        }
    }

    return info;

};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsToken] = carrier => {

    const leftInfo = TypeCarrier.evaluate(carrier.left);
    const rightInfo = TypeCarrier.evaluate(carrier.right);
    
    if(leftInfo.length === rightInfo.length) {
        for(const l of leftInfo) {
            for(const r of rightInfo) {
                if(l.hasValue && r.hasValue) {
                    if(l.value != r.value) {
                        return [TypeInfo.createBoolean(false)];
                    }
                } else {
                    return [TypeInfo.createBoolean()];
                }
            }
        }
        return [TypeInfo.createBoolean(true)];
    } else {
        return [TypeInfo.createBoolean()];
    }

};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.ExclamationEqualsToken] = carrier => {
    const booleanInfo = evaluateBinaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsToken](carrier)[0];
    if(booleanInfo.hasValue) {
        return [TypeInfo.createBoolean(!booleanInfo.value)];
    }
    return booleanInfo;
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsEqualsToken] = carrier => {

    const leftInfo = TypeCarrier.evaluate(carrier.left);
    const rightInfo = TypeCarrier.evaluate(carrier.right);

    if(leftInfo.length === rightInfo.length) {
        for(const l of leftInfo) {
            for(const r of rightInfo) {
                if(l.hasValue && r.hasValue) {
                    if(l.value !== r.value) {
                        return [TypeInfo.createBoolean(false)];
                    }
                } else {
                    return [TypeInfo.createBoolean()];
                }
            }
        }
        return [TypeInfo.createBoolean(true)];
    }

    return [TypeInfo.createBoolean()];

};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.ExclamationEqualsEqualsToken] = carrier => {
    const booleanInfo = TypeCarrier.evaluateBinaryExpressionFunctions[ts.SyntaxKind.EqualsEqualsEqualsToken](carrier)[0];
    if(booleanInfo.hasValue) {
        return [TypeInfo.createBoolean(!booleanInfo.value)];
    }
    return booleanInfo;
};


/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.AmpersandAmpersandToken] = carrier => {

    const leftInfo = TypeCarrier.evaluate(carrier.left);
    const rightInfo = TypeCarrier.evaluate(carrier.right);
    const info = [];

    for(const l of leftInfo) {
        for(const r of rightInfo) {
            if(l.hasValue) {
                info.push(Boolean(l.value) ? r : l);
            } else {
                info.push(l);
                info.push(r);
            }
        }
    }

    return info;

};


/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evaluateBinaryExpressionFunctions[ts.SyntaxKind.BarBarToken] = carrier => {

    const leftInfo = TypeCarrier.evaluate(carrier.left);
    const rightInfo = TypeCarrier.evaluate(carrier.right);
    const info = [];

    for(const l of leftInfo) {
        for(const r of rightInfo) {
            if(l.hasValue) {
                info.push(Boolean(l.value) ? l : r);
            } else {
                info.push(l);
                info.push(r);
            }
        }
    }

    return info;

};

//  ----------------------------------------------------------------------------------

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evalutePrefixUnaryExpressionFunctions[ts.SyntaxKind.PlusToken] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => TypeInfo.toNumber(o));
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evalutePrefixUnaryExpressionFunctions[ts.SyntaxKind.MinusToken] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => {
        const number = TypeInfo.toNumber(o);
        if(number.hasValue) {
            number.value = -number.value;
        }
        return number;
    });
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evalutePrefixUnaryExpressionFunctions[ts.SyntaxKind.PlusPlusToken] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => {
        const number = TypeInfo.toNumber(o);
        if(number.hasValue) {
            ++number.value;
        }
        return number;
    });
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evalutePrefixUnaryExpressionFunctions[ts.SyntaxKind.MinusMinusToken] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => {
        const number = TypeInfo.toNumber(o);
        if(number.hasValue) {
            --number.value;
        }
        return number;
    });
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evalutePrefixUnaryExpressionFunctions[ts.SyntaxKind.ExclamationToken] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => {
        const boolean = TypeInfo.toBoolean(o);
        if(boolean.hasValue) {
            boolean.value = !boolean.value;
        }
        return boolean;
    });
};

/**
 * @param {isense.TypeCarrier} carrier
 * 
 * @returns {Array<isense.TypeInfo>}
 */
evalutePrefixUnaryExpressionFunctions[ts.SyntaxKind.TildeToken] = carrier => {
    return TypeCarrier.evaluate(carrier.operand).map(o => {
        const number = TypeInfo.toNumber(o);
        if(number.hasValue) {
            number.value = ~number.value;
        }
        return number;
    });
};

//  ----------------------------------------------------------------------------------

module.exports = TypeCarrier;