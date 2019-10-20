const Ast = require('../utility/ast');
const TypeCarrier = require('../utility/type_carrier');

const ts = require('typescript');

const TypeDeducer = {};

const deduceTypesFunctionTable = {};
const deduceTypesBinaryExpressionFunctionTable = {};
const deduceTypesPlusExpressionFunctionTable = {};

/**
 * @param {ts.Node} node
 */
TypeDeducer.deduceTypes = node => {
    if(node === undefined || !deduceTypesFunctionTable.hasOwnProperty(node.kind)) {
        return [{
            type: TypeCarrier.Type.Undefined
        }];
    }
    return deduceTypesFunctionTable[node.kind](node);
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.NumericLiteral] = node => {
    return [{
        type: TypeCarrier.Type.Number,
        value: node.text
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.StringLiteral] = node => {
    return [{
        type: TypeCarrier.Type.String,
        value: node.text
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.TrueKeyword] = node => {
    return [{
        type: TypeCarrier.Type.Boolean,
        value: true
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.FalseKeyword] = node => {
    return [{
        type: TypeCarrier.Type.Boolean,
        value: false
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ArrayLiteralExpression] = node => {
    return [{
        type: TypeCarrier.Type.Array
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ObjectLiteralExpression] = node => {
    return [{
        type: TypeCarrier.Type.Object
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.FunctionExpression] =
deduceTypesFunctionTable[ts.SyntaxKind.ArrowFunction] = node => {
    return [{
        type: TypeCarrier.Type.Function, node
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ClassExpression] = node => {
    return [{
        type: TypeCarrier.Type.Class, node}
    ];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.NullKeyword] = node => {
    return [{
        type: TypeCarrier.Type.Null
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.UndefinedKeyword] = node => {
    return [{
        type: TypeCarrier.Type.Undefined
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.Identifier] = node => {
    if(node.escapedText === "undefined") {
        return [{
            type: TypeCarrier.Type.Undefined
        }];
    }
    const symbol = Ast.lookUp(node, node.escapedText);
    if(symbol === undefined) { 
        return [{
            type: TypeCarrier.Type.Undefined
        }]; 
    }
    const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
    if(typeCarrier === undefined) {
        return [{
            type: TypeCarrier.Type.Undefined
        }];
    }
    return typeCarrier.getTypes();
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.BinaryExpression] = node => {
    if(!deduceTypesBinaryExpressionFunctionTable.hasOwnProperty(node.operatorToken.kind)) {
        return [{
            type: TypeCarrier.Type.String,
            value: "Binary expression '" + node.operatorToken.kind +  "' not implemented yet"
        }];
    }
    return deduceTypesBinaryExpressionFunctionTable[node.operatorToken.kind](node);
};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.ParenthesizedExpression] = node => {
    return TypeDeducer.deduceTypes(node.expression);
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.NewExpression] = node => {
    if(node.expression.kind === ts.SyntaxKind.Identifier) {
        const symbol = Ast.lookUp(node,node.expression.getText());
        if(symbol === undefined) { return [{type: TypeCarrier.Type.Undefined}]; }
        const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
        if(typeCarrier === undefined) { return [{type: TypeCarrier.Type.Undefined}]; }
        if(typeCarrier.hasUniqueType()) {
            const type = typeCarrier.getTypes()[0];
            if(type.type === TypeCarrier.Type.Function || type.type === TypeCarrier.Type.Class) {
                return type.node.constructorType;
            }
        }
    } else {
        console.assert(false, "NewExpression's expression is not an identifier");
    }
};

// ----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.PlusToken] = (node) => {

    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            console.assert(deduceTypesPlusExpressionFunctionTable.hasOwnProperty(leftType.type));
            types.push(...deduceTypesPlusExpressionFunctionTable[leftType.type](leftType, rightType));
        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.MinusToken] = (node) => {

    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            if(leftType.type === rightType.type) {
                switch(leftType.type) {
                    case TypeCarrier.Type.Number:
                    case TypeCarrier.Type.Boolean: {
                        const type = { type: TypeCarrier.Type.Number };
                        if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                            type.value = Number(leftType.value) - Number(rightType.value);
                        }
                        types.push(type);
                        break;
                    }
                    case TypeCarrier.Type.Null: {
                        types.push({
                            type: TypeCarrier.Type.Number,
                            value: 0
                        });
                        break;
                    }
                    case TypeCarrier.Type.String:
                    case TypeCarrier.Type.Array:
                    case TypeCarrier.Type.Object:
                    case TypeCarrier.Type.Function:
                    case TypeCarrier.Type.Class: 
                    case TypeCarrier.Type.Undefined:
                    case TypeCarrier.Type.UserDefined: {
                        types.push({
                            type: TypeCarrier.Type.Number,
                            value: "NaN"
                        });
                        break;
                    }
                    default: {
                        console.assert(false, "Unknown type");
                        break;
                    }
                }
            } else {
                types.push({type: TypeCarrier.Type.String, value: "Binary minus not implemented on different types of operands"});
            }

        }
    }

    return types;

};

// ----------------------------------------------------------------------------

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Number] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number: {
            type.type = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.type = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            type.value = "TODO: number + array";
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + right.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            type.type = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value")) {
                type.value = left.value
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.Number;
            type.value = "NaN";
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.String] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = "TODO: string + array"
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + right.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = left.value + "null";
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = left.value + "undefined";
            }
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Boolean] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number: {
            type.type = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.type = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = "TODO: boolean + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.type = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + right.node.getText();
            } 
            break;
        }
        case TypeCarrier.Type.Null: {
            type.type = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value")) {
                type.value = Number(left.value);
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.Number;
            type.value = NaN;
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Array] = (left, right) => {
    const type = { type: TypeCarrier.Type.String };
    if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
        type.value = "TODO: array + " + TypeCarrier.typeToString(right);
    }
    return [type];
};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Object] = 
deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.UserDefined] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "[object Object]" + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: object + array";
            }
            break;
        }
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Object: {
            type.type = TypeCarrier.Type.String;
            type.value = "[object Object][object Object]";
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.type = TypeCarrier.Type.String;
            type.value = "[object Object]" + right.node.getText();
            break;
        }
        case TypeCarrier.Type.Null: {
            type.type = TypeCarrier.Type.String;
            type.value = "[object Object]null";
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.String;
            type.value = "[object Object]undefined";
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Function] = 
deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Class] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = left.node.getText() + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: function + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.type = TypeCarrier.Type.String;
            type.value = left.node.getText() + "[object Object]";
            break;
        }
        case TypeCarrier.Type.Function: 
        case TypeCarrier.Type.Class: {
            type.type = TypeCarrier.Type.String;
            type.value = left.node.getText() + right.node.getText();
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Null] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean: {
            type.type = TypeCarrier.Type.Number;
            if(right.hasOwnProperty("value")) {
                type.value = Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "null" + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: null + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.type = TypeCarrier.Type.String;
            type.value = "null[object Object]";
            break;
        }
        case TypeCarrier.Type.Null: {
            type.type = TypeCarrier.Type.Number;
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.Number;
            type.value = NaN;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Undefined] = (left, right) => {

    const type = {};

    switch(right.type) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.type = TypeCarrier.Type.Number;
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.String: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "undefined" + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.type = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: undefined + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.type = TypeCarrier.Type.String;
            type.value = "undefined[object Object]";
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.type = TypeCarrier.Type.String;
            type.value = "undefined" + right.node.getText();
            break;
        }
        default: {
            console.assert(false, "Unknown Type");
            break;
        }
    };

    return [type];

};

module.exports = TypeDeducer;