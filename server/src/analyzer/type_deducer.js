const Ast = require('../utility/ast');
const TypeCarrier = require('../utility/type_carrier');

const ts = require('typescript');

const TypeDeducer = {};

const deduceTypesFunctionTable = {};
const deduceTypesPrefixUnaryExpressionFunctionTable = {};
const deduceTypesBinaryExpressionFunctionTable = {};
const deduceTypesPlusExpressionFunctionTable = {};

/**
 * @param {ts.Node} node
 */
TypeDeducer.deduceTypes = node => {
    if(node === undefined || !deduceTypesFunctionTable.hasOwnProperty(node.kind)) {
        return [{
            id: TypeCarrier.Type.Undefined
        }];
    }
    return deduceTypesFunctionTable[node.kind](node);
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.NumericLiteral] = node => {
    return [{
        id: TypeCarrier.Type.Number,
        value: node.text
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.StringLiteral] = node => {
    return [{
        id: TypeCarrier.Type.String,
        value: node.text
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.TrueKeyword] = node => {
    return [{
        id: TypeCarrier.Type.Boolean,
        value: true
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.FalseKeyword] = node => {
    return [{
        id: TypeCarrier.Type.Boolean,
        value: false
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ArrayLiteralExpression] = node => {
    return [{
        id: TypeCarrier.Type.Array
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ObjectLiteralExpression] = node => {
    return [{
        id: TypeCarrier.Type.Object
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.FunctionExpression] =
deduceTypesFunctionTable[ts.SyntaxKind.ArrowFunction] = node => {
    return [{
        id: TypeCarrier.Type.Function,
        node
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ClassExpression] = node => {
    return [{
        id: TypeCarrier.Type.Class,
        node
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.NullKeyword] = node => {
    return [{
        id: TypeCarrier.Type.Null
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.UndefinedKeyword] = node => {
    return [{
        id: TypeCarrier.Type.Undefined
    }];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.Identifier] = node => {
    if(node.escapedText === "undefined") {
        return [{
            id: TypeCarrier.Type.Undefined
        }];
    }
    const symbol = Ast.lookUp(node, node.escapedText);
    if(symbol === undefined) { 
        return [{
            id: TypeCarrier.Type.Undefined
        }]; 
    }
    const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
    if(typeCarrier === undefined) {
        return [{
            id: TypeCarrier.Type.Undefined
        }];
    }
    return typeCarrier.getTypes();
};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.PrefixUnaryExpression] = node => {

    const operandTypes = TypeDeducer.deduceTypes(node.operand);
    const types = [];

    for(const operandType of operandTypes) {
        console.assert(deduceTypesPrefixUnaryExpressionFunctionTable.hasOwnProperty(node.operator), "Prefix unary operator " + node.operator + " not implemented");
        types.push(...deduceTypesPrefixUnaryExpressionFunctionTable[node.operator](operandType));
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.PostfixUnaryExpression] = node => {

    const operandTypes = TypeDeducer.deduceTypes(node.operand);
    const types = [];

    for(const operandType of operandTypes) {
        
        const type = {};
        type.id = TypeCarrier.Type.Number;

        switch(operandType.id) {
            case TypeCarrier.Type.Number:
            case TypeCarrier.Type.String:
            case TypeCarrier.Type.Boolean: {
                if(operandType.hasOwnProperty("value")) {
                    type.value = Number(operandType.value);
                }
                break;
            }
            case TypeCarrier.Type.Array: {
                // TODO: add logic
                type.value = NaN;
                break;
            }
            case TypeCarrier.Type.Object:
            case TypeCarrier.Type.Function:
            case TypeCarrier.Type.Class:
            case TypeCarrier.Type.Undefined:
            case TypeCarrier.Type.UserDefined: {
                type.value = NaN;
                break;
            }
            case TypeCarrier.Type.Null: {
                type.value = 0;
                break;
            }
            default: {
                console.assert(false, "Unknown Type");
                break;
            }
        }

        types.push(type);

    }

    return types;

};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.BinaryExpression] = node => {
    if(!deduceTypesBinaryExpressionFunctionTable.hasOwnProperty(node.operatorToken.kind)) {
        return [{
            id: TypeCarrier.Type.String,
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
        if(symbol === undefined) { return [{id: TypeCarrier.Type.Undefined}]; }
        const typeCarrier = Ast.findClosestTypeCarrier(node, symbol);
        if(typeCarrier === undefined) { return [{id: TypeCarrier.Type.Undefined}]; }
        if(typeCarrier.hasUniqueType()) {
            const type = typeCarrier.getTypes()[0];
            if(type.id === TypeCarrier.Type.Function || type.id === TypeCarrier.Type.Class) {
                return type.node.constructorType;
            }
        }
    } else {
        console.assert(false, "NewExpression's expression is not an identifier");
    }
};

// ----------------------------------------------------------------------------
/* Prefix Unary Expressions */

deduceTypesPrefixUnaryExpressionFunctionTable[ts.SyntaxKind.PlusToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = Number(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array +[] = 0, +[x] = Number(x) 
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return [type];
};

deduceTypesPrefixUnaryExpressionFunctionTable[ts.SyntaxKind.MinusToken] = operandType => {
    
    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = -Number(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array -[] = 0, -[x] = -Number(x) 
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return [type];

};

deduceTypesPrefixUnaryExpressionFunctionTable[ts.SyntaxKind.PlusPlusToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = Number(operandType.value) + 1;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return [type];

};

deduceTypesPrefixUnaryExpressionFunctionTable[ts.SyntaxKind.MinusMinusToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Number;
    
    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = Number(operandType.value) - 1;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic for array
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Undefined: {
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.Null: {
            type.value = 0;
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return [type];

};

deduceTypesPrefixUnaryExpressionFunctionTable[ts.SyntaxKind.ExclamationToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Boolean;

    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = !Boolean(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array:
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.value = false;
            break;
        }
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.value = true;
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return [type];

};

deduceTypesPrefixUnaryExpressionFunctionTable[ts.SyntaxKind.TildeToken] = operandType => {

    const type = {};
    type.id = TypeCarrier.Type.Number;

    switch(operandType.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            if(operandType.hasOwnProperty("value")) {
                type.value = ~Number(operandType.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            type.value = -1;
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined:
        case TypeCarrier.Type.UserDefined: {
            type.value = -1;
            break;
        }
        default: {
            console.assert(false, "Unknown type");
            break;
        }
    }

    return [type];

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
            console.assert(deduceTypesPlusExpressionFunctionTable.hasOwnProperty(leftType.id));
            types.push(...deduceTypesPlusExpressionFunctionTable[leftType.id](leftType, rightType));
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

            if(lefttype.id === righttype.id) {
                switch(lefttype.id) {
                    case TypeCarrier.Type.Number:
                    case TypeCarrier.Type.Boolean: {
                        const type = { id: TypeCarrier.Type.Number };
                        if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                            type.value = Number(leftType.value) - Number(rightType.value);
                        }
                        types.push(type);
                        break;
                    }
                    case TypeCarrier.Type.Null: {
                        types.push({
                            id: TypeCarrier.Type.Number,
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
                            id: TypeCarrier.Type.Number,
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
                types.push({id: TypeCarrier.Type.String, value: "Binary minus not implemented on different types of operands"});
            }

        }
    }

    return types;

};

// ----------------------------------------------------------------------------

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Number] = (left, right) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            type.value = "TODO: number + array";
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + right.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value")) {
                type.value = left.value
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
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

    switch(right.id) {
        case TypeCarrier.Type.Number: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = "TODO: string + array"
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = left.value + right.node.getText();
            }
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = left.value + "null";
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.String;
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

    switch(right.id) {
        case TypeCarrier.Type.Number: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = Number(left.value) + Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = "TODO: boolean + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = String(left.value) + "[object Object]";
            }
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            if(left.hasOwnProperty("value")) {
                type.value = String(left.value) + right.node.getText();
            } 
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.Number;
            if(left.hasOwnProperty("value")) {
                type.value = Number(left.value);
            }
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
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
    const type = { id: TypeCarrier.Type.String };
    if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
        type.value = "TODO: array + " + TypeCarrier.typeToString(right);
    }
    return [type];
};

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Object] = 
deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.UserDefined] = (left, right) => {

    const type = {};

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "[object Object]" + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: object + array";
            }
            break;
        }
        case TypeCarrier.Type.UserDefined:
        case TypeCarrier.Type.Object: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object][object Object]";
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object]" + right.node.getText();
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.String;
            type.value = "[object Object]null";
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.String;
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

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.String:
        case TypeCarrier.Type.Boolean:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = left.node.getText() + String(right.value);
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: function + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.id = TypeCarrier.Type.String;
            type.value = left.node.getText() + "[object Object]";
            break;
        }
        case TypeCarrier.Type.Function: 
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
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

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean: {
            type.id = TypeCarrier.Type.Number;
            if(right.hasOwnProperty("value")) {
                type.value = Number(right.value);
            }
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "null" + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: null + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.id = TypeCarrier.Type.String;
            type.value = "null[object Object]";
            break;
        }
        case TypeCarrier.Type.Null: {
            type.id = TypeCarrier.Type.Number;
            type.value = 0;
            break;
        }
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
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

    switch(right.id) {
        case TypeCarrier.Type.Number:
        case TypeCarrier.Type.Boolean:
        case TypeCarrier.Type.Null:
        case TypeCarrier.Type.Undefined: {
            type.id = TypeCarrier.Type.Number;
            type.value = NaN;
            break;
        }
        case TypeCarrier.Type.String: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "undefined" + right.value;
            }
            break;
        }
        case TypeCarrier.Type.Array: {
            type.id = TypeCarrier.Type.String;
            if(right.hasOwnProperty("value")) {
                type.value = "TODO: undefined + array";
            }
            break;
        }
        case TypeCarrier.Type.Object:
        case TypeCarrier.Type.UserDefined: {
            type.id = TypeCarrier.Type.String;
            type.value = "undefined[object Object]";
            break;
        }
        case TypeCarrier.Type.Function:
        case TypeCarrier.Type.Class: {
            type.id = TypeCarrier.Type.String;
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