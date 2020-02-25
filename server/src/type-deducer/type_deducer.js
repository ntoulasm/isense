const Ast = require('../ast/ast');
const TypeCarrier = require('../utility/type_carrier');
const TypeCaster = require('../type-caster/type_caster');
const Utility = require('../utility/utility');

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
        value: Number(node.text)
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
    return [node.type];
};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.FunctionDeclaration] =
deduceTypesFunctionTable[ts.SyntaxKind.FunctionExpression] =
deduceTypesFunctionTable[ts.SyntaxKind.ArrowFunction] = node => {
    return [{
        id: TypeCarrier.Type.Function,
        node
    }];
} 

function extractMembers(node) {
    
    const members = {};

    const extractMembers = node => {
        
        switch(node.kind) {
            case ts.SyntaxKind.BinaryExpression: {

                ts.forEachChild(node, extractMembers);

                if(Utility.isMemberInitialization(node)) {
                    members[node.left.name.escapedText] = TypeDeducer.deduceTypes(node.right);
                }

                break;

            }
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression: {
                break;
            }
            default: {
                ts.forEachChild(node, extractMembers);
                break;
            }
        }

    };

    switch(node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ArrowFunction: {
            extractMembers(node.body);
            break;
        }
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression: {
            for(const member of node.members) {
                switch(member.kind) {
                    case ts.SyntaxKind.PropertyDeclaration: {
                        members[member.name.escapedText] = (member.initializer === undefined) ?
                            [{ id: TypeCarrier.Type.Undefined }] :
                            TypeDeducer.deduceTypes(member.initializer); 
                        break;
                    }
                    case ts.SyntaxKind.MethodDeclaration: {
                        members[member.name.escapedText] = TypeDeducer.deduceTypes(member);
                        break;
                    }
                }
            }
            break;
        }
    }

    return members;

};

/**
 * @param {ts.Node} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.ClassDeclaration] =
deduceTypesFunctionTable[ts.SyntaxKind.ClassExpression] = node => {

    return [{
        id: TypeCarrier.Type.Class,
        node
    }];

};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.MethodDeclaration] = node => {
    return [{
        id: TypeCarrier.Type.Function,
        node,
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
            case TypeCarrier.Type.Undefined: {
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
deduceTypesFunctionTable[ts.SyntaxKind.VoidExpression] = node => {
    return [{ id: TypeCarrier.Type.Undefined }];
};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.TypeOfExpression] = node => {
    
    const types = [];
    const operandTypes = TypeDeducer.deduceTypes(node.expression);

    for(const operandType of operandTypes) {

        const type = {};
        type.id = TypeCarrier.Type.String;

        switch(operandType.id) {
            case TypeCarrier.Type.Number:
            case TypeCarrier.Type.String:
            case TypeCarrier.Type.Boolean:
            case TypeCarrier.Type.Object:
            case TypeCarrier.Type.Function:
            case TypeCarrier.Type.Undefined: {
                type.value = TypeCarrier.typeToString(operandType);
                break;
            }
            case TypeCarrier.Type.Array:
            case TypeCarrier.Type.Class:
            case TypeCarrier.Type.Null: {
                type.value = "object";
                break;
            }
            default: {
                console.assert(false, "Unknown type");
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
 * @param {ts.NewExpression} node 
 */
deduceTypesFunctionTable[ts.SyntaxKind.NewExpression] = node => {
    const types = [];
    const thisTypes = Ast.findClosestTypeCarrier(node.callee.body.statements[node.callee.body.statements.length - 1], node.callee.symbols.lookUp('this')).getTypes();
    if(node.callee._original.hasOwnProperty("constructorName")) {
        for(const thisType of thisTypes) {
            thisType.constructorName = node.callee._original.constructorName;
        }
    }
    types.push(...thisTypes);
    return types;
};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.ThisKeyword] = node => {

    const symbol = Ast.lookUp(node, 'this');
    if(symbol) {
        return Ast.findClosestTypeCarrier(node, symbol).getTypes();
    }

    return undefined;

};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.PropertyAccessExpression] = node => {

    const expressionTypes = TypeDeducer.deduceTypes(node.expression);
    const propertyName = node.name.getText();
    const types = [];
    let typesContainUndefined = false;

    for(const type of expressionTypes) {
        if(type.id === TypeCarrier.Type.Object) {
            const name = `@${type.value}.${propertyName}`;
            for(const [,property] of Object.entries(type.properties.getSymbols())) {
                if(property.name === name) {
                    types.push(...Ast.findClosestTypeCarrier(node, property).getTypes());
                } 
            }
        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.ElementAccessExpression] = node => {

    const expressionTypes = TypeDeducer.deduceTypes(node.expression);
    const elementTypes = TypeDeducer.deduceTypes(node.argumentExpression);
    const types = [];
    let typesContainUndefined = false;
    // TODO: FIXME
    for(const elementType of elementTypes) {

        const elementTypeString = TypeCaster.toString(elementType).value;
        
        if(elementTypeString !== undefined) {
            for(const expressionType of expressionTypes) {
                if(expressionType.id === TypeCarrier.Type.Object && expressionType.hasOwnProperty("value")) {
                    if(expressionType.value.hasOwnProperty(elementTypeString)) {
                        types.push(...expressionType.value[elementTypeString]);
                    } else if(!typesContainUndefined) {
                        types.push({ id: TypeCarrier.Type.Undefined });
                        typesContainUndefined = true;
                    }
                }
            }
        }
    
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesFunctionTable[ts.SyntaxKind.CallExpression] = node => {
    return node.returnTypes;
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
        case TypeCarrier.Type.Array: {
            // TODO: add logic
            type.value = false;
            break;
        }
        case TypeCarrier.Type.Object:
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
        case TypeCarrier.Type.Undefined: {
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
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.PlusToken] = node => {

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
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.MinusToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.AsteriskToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.SlashToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.PercentToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.AsteriskAsteriskToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.LessThanToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.LessThanEqualsToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.GreaterThanToken] = 
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.GreaterThanEqualsToken] =
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.AmpersandToken] =
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.BarToken] =
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.CaretToken] =
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.LessThanLessThanToken] =
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.GreaterThanGreaterThanToken] =
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken] = node => {

    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];
    const op = Ast.operatorTokenToString(node.operatorToken);

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            
            const left = TypeCaster.toNumber(leftType);
            const right = TypeCaster.toNumber(rightType);
            const type = {};
            type.id = TypeCarrier.Type.Number;
        
            if(left.hasOwnProperty("value") && right.hasOwnProperty("value")) {
                type.value = eval(left.value + op + right.value);
            }
    
            types.push(type);
            
        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.EqualsEqualsToken] = node => {
    
    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                type.value = leftType.value == rightType.value;
            }

            types.push(type);

        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.ExclamationEqualsToken] = node => {
    
    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                type.value = leftType.value != rightType.value;
            }

            types.push(type);

        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.EqualsEqualsEqualsToken] = node => {
    
    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            if(leftType.id === rightType.id) {
                if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                    type.value = leftType.value == rightType.value;
                }
            } else {
                type.value = false;
            }

            types.push(type);

        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.ExclamationEqualsEqualsToken] = node => {
    
    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {

            const type = {};
            type.id = TypeCarrier.Type.Boolean;

            if(leftType.id === rightType.id) {
                if(leftType.hasOwnProperty("value") && rightType.hasOwnProperty("value")) {
                    type.value = leftType.value != rightType.value;
                }
            } else {
                type.value = true;
            }

            types.push(type);

        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.AmpersandAmpersandToken] = node => {

    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
            
            if(leftType.hasOwnProperty("value")) {
                types.push(Boolean(leftType.value) ? rightType : leftType);
            } else {
                types.push(leftType);
                types.push(rightType);
            }

        }
    }

    return types;

};

/**
 * @param {ts.Node} node
 */
deduceTypesBinaryExpressionFunctionTable[ts.SyntaxKind.BarBarToken] = node => {

    const leftTypes = TypeDeducer.deduceTypes(node.left);
    const rightTypes = TypeDeducer.deduceTypes(node.right);
    const types = [];

    for(const leftType of leftTypes) {
        for(const rightType of rightTypes) {
        
            if(leftType.hasOwnProperty("value")) {
                types.push(Boolean(leftType.value) ? leftType : rightType);
            } else {
                types.push(leftType);
                types.push(rightType);
            }

        }
    }

    return types;

};

// ----------------------------------------------------------------------------
/* Plus Expression */
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
        case TypeCarrier.Type.Object: {
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
        case TypeCarrier.Type.Object: {
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
        case TypeCarrier.Type.Object: {
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

deduceTypesPlusExpressionFunctionTable[TypeCarrier.Type.Object] = (left, right) => {

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
        case TypeCarrier.Type.Object: {
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
        case TypeCarrier.Type.Object: {
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
        case TypeCarrier.Type.Object: {
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

// ----------------------------------------------------------------------------

module.exports = TypeDeducer;