const ts = require('typescript');

const Replicator = {};

Replicator.replicateFunctions = {};
Replicator.defaultOptions = {
    setParent: true,
    setOriginal: true
};

/**
 * @param {ts.Node} node
 */
Replicator.replicate = (node, options = Replicator.defaultOptions) => {
    return Replicator.replicateInternal(node, {...Replicator.defaultOptions, ...options}, undefined);
};

/**
 * @param {ts.Node} node
 */
Replicator.replicateInternal = (node, options, parent) => {
    if(!Replicator.replicateFunctions.hasOwnProperty(node.kind)) {
        throw `Missing replicate function for nodes of kind '${Object.keys(ts.SyntaxKind)[node.kind]}'`;
    }
    const clone = Replicator.replicateFunctions[node.kind](node, options);
    clone.parent = options.setParent ? parent : undefined;
    options.setOriginal && (clone.original = node);
    options.hasOwnProperty('afterClone') && options.afterClone(node, clone);
    return clone;
};

/**
 * @param {ts.Node} parent
 * @param {String} property
 * @param {*} options
 */
Replicator.replicateArrayProperty = (parent, property, options) => {
    return parent[property].map(n => this.replicateInternal(n, options, parent));
};

/**
 * @param {ts.Node} parent
 * @param {String} property
 * @param {*} options
 */
Replicator.replicateIfArrayProperty = (parent, property, options) => {
    return parent[property].map(n => this.replicateInternal(n, options, parent));
};

/**
 * @param {ts.Node} parent
 * @param {String} property
 * @param {*} options
 */
Replicator.replicateProperty = (parent, property, options) => {
    return parent[property] && Replicator.replicateInternal(parent[property], options, parent);
};

/**
 * @param {Array<ts.Node>} nodes
 * @param {*} options
 * @param {*} parent
 */
Replicator.replicateIfProperty = (parent, property, options) => {
    return parent[property] && Replicator.replicateInternal(parent[property], options, parent);
};

// Unknown = 0,
// EndOfFileToken = 1,
// SingleLineCommentTrivia = 2,
// MultiLineCommentTrivia = 3,
// NewLineTrivia = 4,
// WhitespaceTrivia = 5,
// ShebangTrivia = 6,
// ConflictMarkerTrivia = 7,

/**
 * @param {ts.NumericLiteral} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NumericLiteral] = (node, options) => {
    return ts.createNumericLiteral(node.text);
};

/**
 * @param {ts.BigIntLiteral} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.BigIntLiteral] = (node, options) => {
    return ts.createBigIntLiteral(node.text);
};

/**
 * @param {ts.StringLiteral} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.StringLiteral] = (node, options) => {
    return ts.createStringLiteral(node.text);
};

// JsxText = 11,
// JsxTextAllWhiteSpaces = 12,
// RegularExpressionLiteral = 13,
// NoSubstitutionTemplateLiteral = 14,
// TemplateHead = 15,
// TemplateMiddle = 16,
// TemplateTail = 17,
// OpenBraceToken = 18,
// CloseBraceToken = 19,
// OpenParenToken = 20,
// CloseParenToken = 21,
// OpenBracketToken = 22,
// CloseBracketToken = 23,
// DotToken = 24,
// DotDotDotToken = 25,
// SemicolonToken = 26,
// CommaToken = 27,
// LessThanToken = 28,
// LessThanSlashToken = 29,
// GreaterThanToken = 30,
// LessThanEqualsToken = 31,
// GreaterThanEqualsToken = 32,
// EqualsEqualsToken = 33,
// ExclamationEqualsToken = 34,
// EqualsEqualsEqualsToken = 35,
// ExclamationEqualsEqualsToken = 36,
// EqualsGreaterThanToken = 37,
// PlusToken = 38,
// MinusToken = 39,
// AsteriskToken = 40,
// AsteriskAsteriskToken = 41,
// SlashToken = 42,
// PercentToken = 43,
// PlusPlusToken = 44,
// MinusMinusToken = 45,
// LessThanLessThanToken = 46,
// GreaterThanGreaterThanToken = 47,
// GreaterThanGreaterThanGreaterThanToken = 48,
// AmpersandToken = 49,
// BarToken = 50,
// CaretToken = 51,
// ExclamationToken = 52,
// TildeToken = 53,
// AmpersandAmpersandToken = 54,
// BarBarToken = 55,
// QuestionToken = 56,
// ColonToken = 57,
// AtToken = 58,
// /** Only the JSDoc scanner produces BacktickToken. The normal scanner produces NoSubstitutionTemplateLiteral and related kinds. */
// BacktickToken = 59,
// EqualsToken = 60,
// PlusEqualsToken = 61,
// MinusEqualsToken = 62,
// AsteriskEqualsToken = 63,
// AsteriskAsteriskEqualsToken = 64,
// SlashEqualsToken = 65,
// PercentEqualsToken = 66,
// LessThanLessThanEqualsToken = 67,
// GreaterThanGreaterThanEqualsToken = 68,
// GreaterThanGreaterThanGreaterThanEqualsToken = 69,
// AmpersandEqualsToken = 70,
// BarEqualsToken = 71,
// CaretEqualsToken = 72,
// Identifier = 73,
// BreakKeyword = 74,
// CaseKeyword = 75,
// CatchKeyword = 76,
// ClassKeyword = 77,
// ConstKeyword = 78,
// ContinueKeyword = 79,
// DebuggerKeyword = 80,
// DefaultKeyword = 81,
// DeleteKeyword = 82,
// DoKeyword = 83,
// ElseKeyword = 84,
// EnumKeyword = 85,
// ExportKeyword = 86,
// ExtendsKeyword = 87,
// FalseKeyword = 88,
// FinallyKeyword = 89,
// ForKeyword = 90,
// FunctionKeyword = 91,
// IfKeyword = 92,
// ImportKeyword = 93,
// InKeyword = 94,
// InstanceOfKeyword = 95,
// NewKeyword = 96,

/**
 * @param {ts.NullKeyword} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NullKeyword] = (node, options) => {
    return ts.createNull();
};

// ReturnKeyword = 98,
// SuperKeyword = 99,
// SwitchKeyword = 100,
// ThisKeyword = 101,
// ThrowKeyword = 102,
// TrueKeyword = 103,
// TryKeyword = 104,
// TypeOfKeyword = 105,
// VarKeyword = 106,
// VoidKeyword = 107,
// WhileKeyword = 108,
// WithKeyword = 109,
// ImplementsKeyword = 110,
// InterfaceKeyword = 111,
// LetKeyword = 112,
// PackageKeyword = 113,
// PrivateKeyword = 114,
// ProtectedKeyword = 115,
// PublicKeyword = 116,
// StaticKeyword = 117,
// YieldKeyword = 118,
// AbstractKeyword = 119,
// AsKeyword = 120,
// AnyKeyword = 121,
// AsyncKeyword = 122,
// AwaitKeyword = 123,
// BooleanKeyword = 124,
// ConstructorKeyword = 125,
// DeclareKeyword = 126,
// GetKeyword = 127,
// InferKeyword = 128,
// IsKeyword = 129,
// KeyOfKeyword = 130,
// ModuleKeyword = 131,
// NamespaceKeyword = 132,
// NeverKeyword = 133,
// ReadonlyKeyword = 134,
// RequireKeyword = 135,
// NumberKeyword = 136,
// ObjectKeyword = 137,
// SetKeyword = 138,
// StringKeyword = 139,
// SymbolKeyword = 140,
// TypeKeyword = 141,
//UndefinedKeyword = 142,
// UniqueKeyword = 143,
// UnknownKeyword = 144,
// FromKeyword = 145,
// GlobalKeyword = 146,
// BigIntKeyword = 147,
// OfKeyword = 148,

/**
 * @param {ts.QualifiedName} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.QualifiedName] = (node, options) => {
    return ts.createQualifiedName(
        Replicator.replicateProperty(node, 'left', options),
        Replicator.replicateProperty(node, 'right', options)
    );
};

/**
 * @param {ts.ComputedPropertyName} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ComputedPropertyName] = (node, options) => {
    return ts.createComputedPropertyName(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.TypeParameter} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeParameter] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.Parameter} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.Parameter] = (node, options) => {
    return ts.createParameter(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'dotDotDotToken', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'initializer', options) 
    );
};

/**
 * @param {ts.Decorator} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.Decorator] = (node, options) => {
    return ts.createDecorator(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.PropertySignature} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertySignature] = (node, options) => {
    return ts.createPropertySignature(
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.PropertyDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertyDeclaration] = (node, options) => {
    return ts.createProperty(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        undefined, // TODO: Fix me
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.MethodSignature} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.MethodSignature] = (node, options) => {
    return ts.createMethodSignature(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'questionToken', options)
    );
};

/**
 * @param {ts.MethodDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.MethodDeclaration] = (node, options) => {
    return ts.createMethod(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'asteriskToken', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'body', options)
    );
};

/**
 * @param {ts.Constructor} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.Constructor] = (node, options) => {
    return ts.createConstructor(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'body', options)
    );
};

/**
 * @param {ts.GetAccessor} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.GetAccessor] = (node, options) => {
    return ts.createGetAccessor(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'body', options)
    );
};

/**
 * @param {ts.SetAccessor} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SetAccessor] = (node, options) => {
    ts.createSetAccessor(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'body', options)
    );
};

/**
 * @param {ts.CallSignature} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.CallSignature] = (node, options) => {
    return ts.createCallSignature(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.ConstructSignature} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConstructSignature] = (node, options) => {
    return ts.createConstructSignature(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.IndexSignature} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.IndexSignature] = (node, options) => {
    return ts.createIndexSignature(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.TypePredicate} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypePredicate] = (node, options) => {
    return ts.createTypePredicateNode(
        Replicator.replicateProperty(node, 'parameterName', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.TypeReference} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeReference] = (node, options) => {
    return ts.createTypeReferenceNode(
        Replicator.replicateProperty(node, 'typeName', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options)
    );
};

/**
 * @param {ts.FunctionType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.FunctionType] = (node, options) => {
    return ts.createFunctionTypeNode(
        Replicator.replicateIfArrayProperty(node, 'expression', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.ConstructorType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConstructorType] = (node, options) => {
    return ts.createConstructorTypeNode(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.TypeQuery} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeQuery] = (node, options) => {
    return ts.createTypeQueryNode(
        Replicator.replicateProperty(node, 'exprName', options)
    );
};

/**
 * @param {ts.TypeLiteral} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeLiteral] = (node, options) => {
    return ts.createTypeLiteralNode(
        Replicator.replicateIfArrayProperty(node, 'members', options)
    );
};

/**
 * @param {ts.ArrayType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrayType] = (node, options) => {
    return ts.createArrayTypeNode(
        Replicator.replicateProperty(node, 'elementType', options)
    );
};

/**
 * @param {ts.TupleType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TupleType] = (node, options) => {
    return ts.createTupleTypeNode(
        Replicator.replicateArrayProperty(node, 'elementTypes', options)
    );
};

/**
 * @param {ts.OptionalType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.OptionalType] = (node, options) => {
    return ts.createOptionalTypeNode(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.RestType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.RestType] = (node, options) => {
    return ts.createRestTypeNode(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.UnionType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnionType] = (node, options) => {
    return ts.createUnionTypeNode(
        Replicator.replicateArrayProperty(node, 'types', options)
    );
};

/**
 * @param {ts.IntersectionType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.IntersectionType] = (node, options) => {
    return ts.createIntersectionTypeNode(
        Replicator.replicateArrayProperty(node, 'types', options)
    );
};

/**
 * @param {ts.ConditionalType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConditionalType] = (node, options) => {
    return ts.createConditionalTypeNode(
        Replicator.replicateProperty(node, 'checkType', options),
        Replicator.replicateProperty(node, 'extendsType', options),
        Replicator.replicateProperty(node, 'trueType', options),
        Replicator.replicateProperty(node, 'falseType', options)
    );
};

/**
 * @param {ts.InferType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.InferType] = (node, options) => {
    return ts.createInferTypeNode(
        Replicator.replicateProperty(node, 'typeParameter', options)
    );
};

/**
 * @param {ts.ParenthesizedType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ParenthesizedType] = (node, options) => {
    return ts.createParenthesizedType(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.ThisType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ThisType] = (node, options) => {
    return ts.createThisTypeNode();
};

/**
 * @param {ts.TypeOperator} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeOperator] = (node, options) => {
    return ts.createTypeOperatorNode(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.IndexedAccessType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.IndexedAccessType] = (node, options) => {
    return ts.createIndexedAccessTypeNode(
        Replicator.replicateProperty(node, 'objectType', options),
        Replicator.replicateProperty(node, 'indexType', options)
    )
};

/**
 * @param {ts.MappedType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.MappedType] = (node, options) => {
    return ts.createMappedTypeNode(
        Replicator.replicateIfProperty(node, 'readonlyToken', options),
        Replicator.replicateProperty(node, 'typeParameter', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateIfProperty(node, 'type', options)
    )
};

/**
 * @param {ts.LiteralType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.LiteralType] = (node, options) => {
    return ts.createLiteralTypeNode(
        Replicator.replicateProperty(node, 'literal', options)
    );
};

/**
 * @param {ts.ImportType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportType] = (node, options) => {
    return ts.createImportTypeNode(
        Replicator.replicateProperty(node, 'argument', options),
        Replicator.replicateIfProperty(node, 'qualifier', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateIfProperty(node, 'isTypeOf', options)
    );
};

/**
 * @param {ts.ObjectBindingPattern} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ObjectBindingPattern] = (node, options) => {
    return ts.createObjectBindingPattern(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.ArrayBindingPattern} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrayBindingPattern] = (node, options) => {
    return ts.createArrayBindingPattern(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.BindingElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.BindingElement] = (node, options) => {
    return ts.createBindingElement(
        Replicator.replicateIfProperty(node, 'dotDotDotToken', options),
        Replicator.replicateIfProperty(node, 'propertyName', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.ArrayLiteralExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrayLiteralExpression] = (node, options) => {
    return ts.createArrayLiteral(
        Replicator.replicateIfArrayProperty(node, 'elements', options),
        // TODO: multiline parameter?
    );
};

/**
 * @param {ts.ObjectLiteralExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ObjectLiteralExpression] = (node, options) => {
    return ts.createObjectLiteral(
        Replicator.replicateIfArrayProperty(node, 'properties', options),
        // TODO: multiline parameter?
    )
};

/**
 * @param {ts.PropertyAccessExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertyAccessExpression] = (node, options) => {
    return ts.createPropertyAccess(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.ElementAccessExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ElementAccessExpression] = (node, options) => {
    return ts.createElementAccess(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'index', options)
    );
};

/**
 * @param {ts.CallExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.CallExpression] = (node, options) => {
    return ts.createCall(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateIfArrayProperty(node, 'argumentsArray', options)
    );
};

/**
 * @param {ts.NewExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NewExpression] = (node, options) => {
    return ts.createNew(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateIfArrayProperty(node, 'argumentsArray', options)
    );
};

/**
 * @param {ts.TaggedTemplateExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TaggedTemplateExpression] = (node, options) => {
    // TODO: overloaded
};

/**
 * @param {ts.TypeAssertionExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeAssertionExpression] = (node, options) => {
    return ts.createTypeAssertion(
        Replicator.replicateProperty(node, 'type', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.ParenthesizedExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ParenthesizedExpression] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.FunctionExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.FunctionExpression] = (node, options) => {
    return ts.createFunctionExpression(
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'asteriskToken', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateProperty(node, 'block', options)
    );
};

/**
 * @param {ts.ArrowFunction} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrowFunction] = (node, options) => {};

/**
 * @param {ts.DeleteExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.DeleteExpression] = (node, options) => {
    return ts.createDelete(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.TypeOfExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeOfExpression] = (node, options) => {
    return ts.createTypeOf(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.VoidExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.VoidExpression] = (node, options) => {
    return ts.createVoid(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.AwaitExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.AwaitExpression] = (node, options) => {
    return ts.createAwait(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.PrefixUnaryExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PrefixUnaryExpression] = (node, options) => {
    return ts.createPrefix(
        node.operator,
        Replicator.replicateProperty(node, 'operand', options)
    );
};

/**
 * @param {ts.PostfixUnaryExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PostfixUnaryExpression] = (node, options) => {
    return ts.createPostfix(
        Replicator.replicateProperty(node, 'operand', options),
        node.operator
    );
};

/**
 * @param {ts.BinaryExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.BinaryExpression] = (node, options) => {
    return ts.createBinary(
        Replicator.replicateProperty(node, 'left', options),
        Replicator.replicateProperty(node, 'operatorToken', options),
        Replicator.replicateProperty(node, 'right', options)
    );
};

/**
 * @param {ts.ConditionalExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConditionalExpression] = (node, options) => {
    return ts.createConditional(
        Replicator.replicateProperty(node, 'condition', options),
        Replicator.replicateProperty(node, 'whenTrue', options),
        Replicator.replicateProperty(node, 'whenFalse', options)
    );
};

/**
 * @param {ts.TemplateExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateExpression] = (node, options) => {
    return ts.createTemplateExpression(
        Replicator.replicateProperty(node, 'head', options),
        Replicator.replicateArrayProperty(node, 'templateSpans', options)
    );
};

/**
 * @param {ts.YieldExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.YieldExpression] = (node, options) => {
    return ts.createYield(
        Replicator.replicateIfProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.SpreadElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SpreadElement] = (node, options) => {
    return ts.createSpread(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.ClassExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ClassExpression] = (node, options) => {
    return ts.createClassExpression(
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'heritageClauses', options),
        Replicator.replicateArrayProperty(node, 'members', options)
    );
};

/**
 * @param {ts.OmittedExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.OmittedExpression] = (node, options) => {
    return ts.createOmittedExpression();
};

/**
 * @param {ts.ExpressionWithTypeArguments} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExpressionWithTypeArguments] = (node, options) => {
    return ts.createExpressionWithTypeArguments(
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.AsExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.AsExpression] = (node, options) => {
    return ts.createAsExpression(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.NonNullExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NonNullExpression] = (node, options) => {
    return ts.createNonNullExpression(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.MetaProperty} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.MetaProperty] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.SyntheticExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SyntheticExpression] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.TemplateSpan} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateSpan] = (node, options) => {
    return ts.createTemplateSpan(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'literal', options)
    );
};

/**
 * @param {ts.SemicolonClassElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SemicolonClassElement] = (node, options) => {
    return ts.createSemicolonClassElement();
};

/**
 * @param {ts.Block} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.Block] = (node, options) => {
    ts.createBlock(
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.VariableStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.VariableStatement] = (node, options) => {
    return ts.createVariableStatement(
        Replicator.replicateIfProperty(node, 'modifiers', options), 
        Replicator.replicateProperty(node, 'declarationList', options)
    );
};

/**
 * @param {ts.EmptyStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.EmptyStatement] = (node, options) => {
    ts.createEmptyStatement();
}

/**
 * @param {ts.ExpressionStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExpressionStatement] = (node, options) => {
    return ts.createExpressionStatement(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.IfStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.IfStatement] = (node, options) => {
    return ts.createIf(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'thenStatement', options),
        Replicator.replicateIfProperty(node, 'elseStatement', options)
    );
};

/**
 * @param {ts.DoStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.DoStatement] = (node, options) => {
    return ts.createDo(
        Replicator.replicateProperty(node, 'statement', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.WhileStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.WhileStatement] = (node, options) => {
    return ts.createWhile(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ForStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ForStatement] = (node, options) => {
    return ts.createFor(
        Replicator.replicateIfProperty(node, 'initializer', options),
        Replicator.replicateIfProperty(node, 'condition', options),
        Replicator.replicateIfProperty(node, 'incrementor', options),
        Replicator.replicateProperty(node, 'statement', options)
    )
};

/**
 * @param {ts.ForInStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ForInStatement] = (node, options) => {
    return ts.createForIn(
        Replicator.replicateProperty(node, 'initializer', options),
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    )
};

/**
 * @param {ts.ForOfStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ForOfStatement] = (node, options) => {
    return ts.createForOf(
        Replicator.replicateIfProperty(node, 'awaitModifier', options), // TODO: check this again
        Replicator.replicateProperty(node, 'initializer', options),
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ContinueStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ContinueStatement] = (node, options) => {
    return ts.createContinue(
        Replicator.replicateIfProperty(node, 'label', options)
    );
};

/**
 * @param {ts.BreakStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.BreakStatement] = (node, options) => {
    return ts.createBreak(
        Replicator.replicateIfProperty(node, 'label', options)
    );
};

/**
 * @param {ts.ReturnStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ReturnStatement] = (node, options) => {
    return ts.createReturn(
        Replicator.replicateIfProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.WithStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.WithStatement] = (node, options) => {
    return ts.createWith(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.SwitchStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SwitchStatement] = (node, options) => {
    return ts.createSwitch(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'caseBlock', options)
    );
};

/**
 * @param {ts.LabeledStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.LabeledStatement] = (node, options) => {
    return ts.createLabel(
        Replicator.replicateProperty(node, 'label', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ThrowStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ThrowStatement] = (node, options) => {
    return ts.createThrow(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.TryStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TryStatement] = (node, options) => {
    return ts.createTry(
        Replicator.replicateProperty(node, 'tryBlock', options),
        Replicator.replicateIfProperty(node, 'catchClause', options),
        Replicator.replicateIfProperty(node, 'finallyBlock', options)
    );
};

/**
 * @param {ts.DebuggerStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.DebuggerStatement] = (node, options) => {
    return ts.createDebuggerStatement();
};

/**
 * @param {ts.VariableDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.VariableDeclaration] = (node, options) => {
    return ts.createVariableDeclaration(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.VariableDeclarationList} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.VariableDeclarationList] = (node, options) => {
    return ts.createVariableDeclarationList(
        Replicator.replicateArrayProperty(node, 'declarations', options),
        node.flags // TODO: check again
    );
};

/**
 * @param {ts.FunctionDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.FunctionDeclaration] = (node, options) => {
    return ts.createFunctionDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'asteriskToken', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'body', options)
    );
};

/**
 * @param {ts.ClassDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ClassDeclaration] = (node, options) => {
    return ts.createClassDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'heritageClauses', options),
        Replicator.replicateArrayProperty(node, 'members', options)
    )
};

/**
 * @param {ts.InterfaceDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.InterfaceDeclaration] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.TypeAliasDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeAliasDeclaration] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.EnumDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.EnumDeclaration] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.ModuleDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ModuleDeclaration] = (node, options) => {
    return ts.createModuleDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'body', options),
        Replicator.replicateIfProperty(node, 'flags', options)
    );
};

/**
 * @param {ts.ModuleBlock} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ModuleBlock] = (node, options) => {
    return ts.createModuleBlock(
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.CaseBlock} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.CaseBlock] = (node, options) => {
    return ts.createCaseBlock(
        Replicator.replicateArrayProperty(node, 'clauses', options)
    );
};

/**
 * @param {ts.NamespaceExportDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamespaceExportDeclaration] = (node, options) => {
    return ts.createNamespaceExportDeclaration(
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.ImportEqualsDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportEqualsDeclaration] = (node, options) => {
    return ts.createImportEqualsDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateProperty(node, 'moduleReference', options)
    );
};

/**
 * @param {ts.ImportDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportDeclaration] = (node, options) => {
    return ts.createImportDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'importClause', options),
        Replicator.replicateProperty(node, 'moduleSpecifier', options)
    );
};

/**
 * @param {ts.ImportClause} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportClause] = (node, options) => {
    return ts.createImportClause(
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'namedBindings', options)
    );
};

/**
 * @param {ts.NamespaceImport} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamespaceImport] = (node, options) => {
    return ts.createNamespaceImport(
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.NamedImports} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamedImports] = (node, options) => {
    return ts.createNamedImports(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.ImportSpecifier} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportSpecifier] = (node, options) => {
    return ts.createImportSpecifier(
        Replicator.replicateIfProperty(node, 'propertyName', options),
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.ExportAssignment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExportAssignment] = (node, options) => {
    return ts.createExportAssignment(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'isExportEquals', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.ExportDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExportDeclaration] = (node, options) => {
    return ts.createExportDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'exportClause', options),
        Replicator.replicateIfProperty(node, 'moduleSpecifier', options)
    );
};

/**
 * @param {ts.NamedExports} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamedExports] = (node, options) => {
    return ts.createNamedExports(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.ExportSpecifier} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExportSpecifier] = (node, options) => {
    return ts.createExportSpecifier(
        Replicator.replicateIfProperty(node, 'propertyName', options),
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.MissingDeclaration} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.MissingDeclaration] = (node, options) => {
    // ???
};

/**
 * @param {ts.ExternalModuleReference} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExternalModuleReference] = (node, options) => {
    return ts.createExternalModuleReference(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.JsxElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxElement] = (node, options) => {
    return ts.createJsxElement(
        Replicator.replicateProperty(node, 'openingElement', options),
        Replicator.replicateArrayProperty(node, 'children', options),
        Replicator.replicateProperty(node, 'closingElement', options)
    );
};

/**
 * @param {ts.JsxSelfClosingElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxSelfClosingElement] = (node, options) => {
    return ts.createJsxSelfClosingElement(
        Replicator.replicateProperty(node, 'tagName', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateProperty(node, 'attributes', options)
    );
};

/**
 * @param {ts.JsxOpeningElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxOpeningElement] = (node, options) => {
    return ts.createJsxOpeningElement(
        Replicator.replicateProperty(node, 'tagName', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateProperty(node, 'attributes', options)
    );
};

/**
 * @param {ts.JsxClosingElement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxClosingElement] = (node, options) => {
    return ts.createJsxClosingElement(
        Replicator.replicateProperty(node, 'tagName', options)
    );
};

/**
 * @param {ts.JsxFragment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxFragment] = (node, options) => {
    return ts.createJsxFragment(
        Replicator.replicateProperty(node, 'openingFragment', options),
        Replicator.replicateArrayProperty(node, 'children', options),
        Replicator.replicateProperty(node, 'closingFragment', options)
    );
};

/**
 * @param {ts.JsxOpeningFragment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxOpeningFragment] = (node, options) => {
    return ts.createJsxOpeningFragment();
};

/**
 * @param {ts.JsxClosingFragment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxClosingFragment] = (node, options) => {
    return ts.createJsxJsxClosingFragment();
};

/**
 * @param {ts.JsxAttribute} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxAttribute] = (node, options) => {
    return ts.createJsxAttribute(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.JsxAttributes} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxAttributes] = (node, options) => {
    return ts.createJsxAttributes(
        Replicator.replicateArrayProperty(node, 'properties', options)
    );
};

/**
 * @param {ts.JsxSpreadAttribute} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxSpreadAttribute] = (node, options) => {
    return ts.createJsxSpreadAttribute(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.JsxExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxExpression] = (node, options) => {
    return ts.createJsxExpression(
        Replicator.replicateIfProperty(node, 'dotDotDotToken', options),
        Replicator.replicateIfProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.CaseClause} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.CaseClause] = (node, options) => {
    return ts.createCaseClause(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.DefaultClause} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.DefaultClause] = (node, options) => {
    return ts.createDefaultClause(
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.HeritageClause} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.HeritageClause] = (node, options) => {
    return ts.createHeritageClause(
        Replicator.replicateProperty(node, 'token', options),
        Replicator.replicateArrayProperty(node, 'types', options)
    );
};

/**
 * @param {ts.CatchClause} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.CatchClause] = (node, options) => {
    return ts.createCatchClause(
        Replicator.replicateIfProperty(node, 'variableDeclaration', options),
        Replicator.replicateProperty(node, 'block', options)
    );
};

/**
 * @param {ts.PropertyAssignment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertyAssignment] = (node, options) => {
    return ts.createPropertyAssignment(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.ShorthandPropertyAssignment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.ShorthandPropertyAssignment] = (node, options) => {
    return ts.createShorthandPropertyAssignment(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'objectAssignmentInitializer', options)
    );
};

/**
 * @param {ts.SpreadAssignment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SpreadAssignment] = (node, options) => {
    return ts.createSpreadAssignment(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.EnumMember} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.EnumMember] = (node, options) => {
    return ts.createEnumMember(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.UnparsedPrologue} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedPrologue] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedPrepend} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedPrepend] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedText} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedText] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedInternalText} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedInternalText] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedSyntheticReference} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedSyntheticReference] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.SourceFile} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SourceFile] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.Bundle} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.Bundle] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.UnparsedSource} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedSource] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.InputFiles} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.InputFiles] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.JSDocTypeExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypeExpression] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocAllType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocAllType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocUnknownType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocUnknownType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocNullableType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocNullableType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocNonNullableType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocNonNullableType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocOptionalType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocOptionalType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocFunctionType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocFunctionType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocVariadicType} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocVariadicType] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocComment} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocComment] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocTypeLiteral} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypeLiteral] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocSignature} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocSignature] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocAugmentsTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocAugmentsTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocClassTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocClassTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocCallbackTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocCallbackTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocEnumTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocEnumTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocParameterTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocParameterTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocReturnTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocReturnTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocThisTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocThisTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocTypeTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypeTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocTemplateTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTemplateTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocTypedefTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypedefTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.JSDocPropertyTag} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocPropertyTag] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.SyntaxList} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.SyntaxList] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.NotEmittedStatement} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.NotEmittedStatement] = (node, options) => {
    return ts.createNotEmittedStatement(
        Replicator.replicateProperty(node, 'original', options)
    );
};

/**
 * @param {ts.PartiallyEmittedExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.PartiallyEmittedExpression] = (node, options) => {
    return ts.createPartiallyEmittedExpression(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateIfProperty(node, 'original', options)
    );
};

/**
 * @param {ts.CommaListExpression} node
 */
Replicator.replicateFunctions[ts.SyntaxKind.CommaListExpression] = (node, options) => {
    return ts.createCommaList(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

// MergeDeclarationMarker = 316,
// EndOfDeclarationMarker = 317,
// Count = 318,
// FirstAssignment = 60,
// LastAssignment = 72,
// FirstCompoundAssignment = 61,
// LastCompoundAssignment = 72,
// FirstReservedWord = 74,
// LastReservedWord = 109,
// FirstKeyword = 74,
// LastKeyword = 148,
// FirstFutureReservedWord = 110,
// LastFutureReservedWord = 118,
// FirstTypeNode = 164,
// LastTypeNode = 184,
// FirstPunctuation = 18,
// LastPunctuation = 72,
// FirstToken = 0,
// LastToken = 148,
// FirstTriviaToken = 2,
// LastTriviaToken = 7,
// FirstLiteralToken = 8,
// LastLiteralToken = 14,
// FirstTemplateToken = 14,
// LastTemplateToken = 17,
// FirstBinaryOperator = 28,
// LastBinaryOperator = 72,
// FirstNode = 149,
// FirstJSDocNode = 289,
// LastJSDocNode = 311,
// FirstJSDocTagNode = 300,
// LastJSDocTagNode = 311,

module.exports = Replicator;