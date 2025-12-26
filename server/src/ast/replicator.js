const ts = require('typescript');

//-----------------------------------------------------------------------------

/**
 * @typedef {Object} ISense.ASTReplicate.Options
 * @property {Boolean} setOriginal -
 * @property {(original: ts.Node, clone: ts.Node) => void} onReplicate -
 */

//-----------------------------------------------------------------------------

const Replicator = {};

Replicator.replicateFunctions = {};
Replicator.defaultOptions = {
    setOriginal: false,
};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicate = (node, options = Replicator.defaultOptions) => {
    options = { ...Replicator.defaultOptions, ...options };
    const clone = Replicator.replicateInternal(node, options);

    return clone;
};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} parent
 */
Replicator.setParentNodes = parent => {
    ts.forEachChild(parent, node => {
        node.parent = parent;
    });
};

/**
 * @param {ts.Node} original
 * @param {ts.Node} clone
 */
Replicator.replicatePositionData = (original, clone) => {
    clone.pos = original.pos;
    clone.end = original.end;
};

//-----------------------------------------------------------------------------

/**
 * @param {ts.Node} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateInternal = (node, options) => {
    if (!Object.hasOwn(Replicator.replicateFunctions, node.kind)) {
        throw `Missing replicate function for nodes of kind '${Object.values(ts.SyntaxKind)[node.kind]}'`;
    }
    const clone = Replicator.replicateFunctions[node.kind](node, options);
    options.setOriginal && (clone._original = node);
    options.onReplicate && options.onReplicate(node, clone);
    return clone;
};

/**
 * @param {ts.Node} object
 * @param {String} property
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateArrayProperty = (object, property, options) => {
    return object[property].map(n => Replicator.replicateInternal(n, options));
};

/**
 * @param {ts.Node} object
 * @param {String} property
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateIfArrayProperty = (object, property, options) => {
    return (
        object[property] &&
        object[property].map(n => Replicator.replicateInternal(n, options))
    );
};

/**
 * @param {ts.Node} object
 * @param {String} property
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateProperty = (object, property, options) => {
    return (
        object[property] &&
        Replicator.replicateInternal(object[property], options)
    );
};

/**
 * @param {ts.Node} object
 * @param {String} property
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateIfProperty = (object, property, options) => {
    return (
        object[property] &&
        Replicator.replicateInternal(object[property], options)
    );
};

//-----------------------------------------------------------------------------

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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NumericLiteral] = (
    node,
    options
) => {
    return ts.createNumericLiteral(node.text);
};

/**
 * @param {ts.BigIntLiteral} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.BigIntLiteral] = (
    node,
    options
) => {
    return ts.createBigIntLiteral(node.text);
};

/**
 * @param {ts.StringLiteral} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.StringLiteral] = (
    node,
    options
) => {
    return ts.createStringLiteral(node.text);
};

/**
 * @param {ts.JsxText} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxText] = (node, options) => {
    return ts.createJsxText(
        node.text
        // TODO: add containsOnlyTriviaWhiteSpaces parameter
    );
};

/**
 * @param {ts.JsxTextAllWhiteSpaces} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxTextAllWhiteSpaces] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.RegularExpressionLiteral} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.RegularExpressionLiteral] = (
    node,
    options
) => {
    return ts.createRegularExpressionLiteral(node.text);
};

/**
 * @param {ts.NoSubstitutionTemplateLiteral} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NoSubstitutionTemplateLiteral] = (
    node,
    options
) => {
    return ts.createNoSubstitutionTemplateLiteral(node.text);
};

/**
 * @param {ts.TemplateHead} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateHead] = (node, options) => {
    return ts.createTemplateHead(node.text);
};

/**
 * @param {ts.TemplateMiddle} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateMiddle] = (
    node,
    options
) => {
    return ts.createTemplateMiddle(node.text);
};

/**
 * @param {ts.TemplateTail} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateTail] = (node, options) => {
    return ts.createTemplateTail(node.text);
};

/**
 * @param {ts.Token} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.OpenBraceToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.CloseBraceToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.OpenParenToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.CloseParenToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.DotToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.DotDotDotToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.SemicolonToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.CommaToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.LessThanToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.LessThanSlashToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.GreaterThanToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.LessThanEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.GreaterThanEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.EqualsEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.ExclamationEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.EqualsEqualsEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.ExclamationEqualsEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.EqualsGreaterThanToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.PlusToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.MinusToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.AsteriskToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.AsteriskAsteriskToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.SlashToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.PercentToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.PlusPlusToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.MinusMinusToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.LessThanLessThanToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.GreaterThanGreaterThanToken] =
    Replicator.replicateFunctions[
        ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
    ] =
    Replicator.replicateFunctions[ts.SyntaxKind.AmpersandToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.BarToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.CaretToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.ExclamationToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.TildeToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.AmpersandAmpersandToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.BarBarToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.QuestionToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.ColonToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.AtToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.BacktickToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.EqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.PlusEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.MinusEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.AsteriskEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.SlashEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.PercentEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.LessThanLessThanEqualsToken] =
    Replicator.replicateFunctions[
        ts.SyntaxKind.GreaterThanGreaterThanEqualsToken
    ] =
    Replicator.replicateFunctions[
        ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
    ] =
    Replicator.replicateFunctions[ts.SyntaxKind.AmpersandEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.BarEqualsToken] =
    Replicator.replicateFunctions[ts.SyntaxKind.CaretEqualsToken] =
        (node, options) => {
            return ts.createToken(node.kind);
        };

/**
 * @param {ts.Identifier} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.Identifier] = (node, options) => {
    return ts.createIdentifier(node.text);
};

/**
 * @param {ts.Keyword} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.BreakKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.CaseKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.CatchKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ClassKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ConstKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ContinueKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.DebuggerKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.DefaultKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.DeleteKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.DoKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ElseKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.EnumKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ExportKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ExtendsKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.FalseKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.FinallyKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ForKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.FunctionKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.IfKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ImportKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.InKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.InstanceOfKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.NewKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.NullKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ReturnKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.SuperKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.SwitchKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ThisKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ThrowKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.TrueKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.TryKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.TypeOfKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.VarKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.VoidKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.WhileKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.WithKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ImplementsKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.InterfaceKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.LetKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.PackageKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.PrivateKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ProtectedKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.PublicKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.StaticKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.YieldKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.AbstractKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.AsKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.AnyKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.AsyncKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.AwaitKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.BooleanKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ConstructorKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.DeclareKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.GetKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.InferKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.IsKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.KeyOfKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ModuleKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.NamespaceKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.NeverKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ReadonlyKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.RequireKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.NumberKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.ObjectKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.SetKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.StringKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.SymbolKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.TypeKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.UndefinedKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.UniqueKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.UnknownKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.FromKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.GlobalKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.BigIntKeyword] =
    Replicator.replicateFunctions[ts.SyntaxKind.OfKeyword] =
        (node, options) => {
            return ts.createKeywordTypeNode(node.kind);
        };

/**
 * @param {ts.QualifiedName} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.QualifiedName] = (
    node,
    options
) => {
    return ts.createQualifiedName(
        Replicator.replicateProperty(node, 'left', options),
        Replicator.replicateProperty(node, 'right', options)
    );
};

/**
 * @param {ts.ComputedPropertyName} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ComputedPropertyName] = (
    node,
    options
) => {
    return ts.createComputedPropertyName(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.TypeParameter} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeParameter] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.Parameter} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.Decorator] = (node, options) => {
    return ts.createDecorator(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.PropertySignature} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertySignature] = (
    node,
    options
) => {
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertyDeclaration] = (
    node,
    options
) => {
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.MethodSignature] = (
    node,
    options
) => {
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.MethodDeclaration] = (
    node,
    options
) => {
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.CallSignature] = (
    node,
    options
) => {
    return ts.createCallSignature(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.ConstructSignature} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConstructSignature] = (
    node,
    options
) => {
    return ts.createConstructSignature(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.IndexSignature} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.IndexSignature] = (
    node,
    options
) => {
    return ts.createIndexSignature(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.TypePredicate} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypePredicate] = (
    node,
    options
) => {
    return ts.createTypePredicateNode(
        Replicator.replicateProperty(node, 'parameterName', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.TypeReference} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeReference] = (
    node,
    options
) => {
    return ts.createTypeReferenceNode(
        Replicator.replicateProperty(node, 'typeName', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options)
    );
};

/**
 * @param {ts.FunctionType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConstructorType] = (
    node,
    options
) => {
    return ts.createConstructorTypeNode(
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.TypeQuery} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeQuery] = (node, options) => {
    return ts.createTypeQueryNode(
        Replicator.replicateProperty(node, 'exprName', options)
    );
};

/**
 * @param {ts.TypeLiteral} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeLiteral] = (node, options) => {
    return ts.createTypeLiteralNode(
        Replicator.replicateIfArrayProperty(node, 'members', options)
    );
};

/**
 * @param {ts.ArrayType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrayType] = (node, options) => {
    return ts.createArrayTypeNode(
        Replicator.replicateProperty(node, 'elementType', options)
    );
};

/**
 * @param {ts.TupleType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TupleType] = (node, options) => {
    return ts.createTupleTypeNode(
        Replicator.replicateArrayProperty(node, 'elementTypes', options)
    );
};

/**
 * @param {ts.OptionalType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.OptionalType] = (node, options) => {
    return ts.createOptionalTypeNode(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.RestType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.RestType] = (node, options) => {
    return ts.createRestTypeNode(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.UnionType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnionType] = (node, options) => {
    return ts.createUnionTypeNode(
        Replicator.replicateArrayProperty(node, 'types', options)
    );
};

/**
 * @param {ts.IntersectionType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.IntersectionType] = (
    node,
    options
) => {
    return ts.createIntersectionTypeNode(
        Replicator.replicateArrayProperty(node, 'types', options)
    );
};

/**
 * @param {ts.ConditionalType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConditionalType] = (
    node,
    options
) => {
    return ts.createConditionalTypeNode(
        Replicator.replicateProperty(node, 'checkType', options),
        Replicator.replicateProperty(node, 'extendsType', options),
        Replicator.replicateProperty(node, 'trueType', options),
        Replicator.replicateProperty(node, 'falseType', options)
    );
};

/**
 * @param {ts.InferType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.InferType] = (node, options) => {
    return ts.createInferTypeNode(
        Replicator.replicateProperty(node, 'typeParameter', options)
    );
};

/**
 * @param {ts.ParenthesizedType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ParenthesizedType] = (
    node,
    options
) => {
    return ts.createParenthesizedType(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.ThisType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ThisType] = (node, options) => {
    return ts.createThisTypeNode();
};

/**
 * @param {ts.TypeOperator} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeOperator] = (node, options) => {
    return ts.createTypeOperatorNode(
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.IndexedAccessType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.IndexedAccessType] = (
    node,
    options
) => {
    return ts.createIndexedAccessTypeNode(
        Replicator.replicateProperty(node, 'objectType', options),
        Replicator.replicateProperty(node, 'indexType', options)
    );
};

/**
 * @param {ts.MappedType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.MappedType] = (node, options) => {
    return ts.createMappedTypeNode(
        Replicator.replicateIfProperty(node, 'readonlyToken', options),
        Replicator.replicateProperty(node, 'typeParameter', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateIfProperty(node, 'type', options)
    );
};

/**
 * @param {ts.LiteralType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.LiteralType] = (node, options) => {
    return ts.createLiteralTypeNode(
        Replicator.replicateProperty(node, 'literal', options)
    );
};

/**
 * @param {ts.ImportType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ObjectBindingPattern] = (
    node,
    options
) => {
    return ts.createObjectBindingPattern(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.ArrayBindingPattern} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrayBindingPattern] = (
    node,
    options
) => {
    return ts.createArrayBindingPattern(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.BindingElement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.BindingElement] = (
    node,
    options
) => {
    return ts.createBindingElement(
        Replicator.replicateIfProperty(node, 'dotDotDotToken', options),
        Replicator.replicateIfProperty(node, 'propertyName', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.ArrayLiteralExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrayLiteralExpression] = (
    node,
    options
) => {
    return ts.createArrayLiteral(
        Replicator.replicateIfArrayProperty(node, 'elements', options)
        // TODO: multiline parameter?
    );
};

/**
 * @param {ts.ObjectLiteralExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ObjectLiteralExpression] = (
    node,
    options
) => {
    return ts.createObjectLiteral(
        Replicator.replicateArrayProperty(node, 'properties', options)
        // TODO: multiline parameter?
    );
};

/**
 * @param {ts.PropertyAccessExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertyAccessExpression] = (
    node,
    options
) => {
    return ts.createPropertyAccess(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.ElementAccessExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ElementAccessExpression] = (
    node,
    options
) => {
    return ts.createElementAccess(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'argumentExpression', options)
    );
};

/**
 * @param {ts.CallExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.CallExpression] = (
    node,
    options
) => {
    return ts.createCall(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateIfArrayProperty(node, 'arguments', options)
    );
};

/**
 * @param {ts.NewExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NewExpression] = (
    node,
    options
) => {
    return ts.createNew(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateIfArrayProperty(node, 'arguments', options)
    );
};

/**
 * @param {ts.TaggedTemplateExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TaggedTemplateExpression] = (
    node,
    options
) => {
    // TODO: overloaded
};

/**
 * @param {ts.TypeAssertionExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeAssertionExpression] = (
    node,
    options
) => {
    return ts.createTypeAssertion(
        Replicator.replicateProperty(node, 'type', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.ParenthesizedExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ParenthesizedExpression] = (
    node,
    options
) => {
    return ts.createParen(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.FunctionExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.FunctionExpression] = (
    node,
    options
) => {
    return ts.createFunctionExpression(
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'asteriskToken', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateProperty(node, 'body', options)
    );
};

/**
 * @param {ts.ArrowFunction} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ArrowFunction] = (
    node,
    options
) => {
    return ts.createArrowFunction(
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'equalsGreaterThanToken', options),
        Replicator.replicateProperty(node, 'body', options)
    );
};

/**
 * @param {ts.DeleteExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.DeleteExpression] = (
    node,
    options
) => {
    return ts.createDelete(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.TypeOfExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeOfExpression] = (
    node,
    options
) => {
    return ts.createTypeOf(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.VoidExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.VoidExpression] = (
    node,
    options
) => {
    return ts.createVoid(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.AwaitExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.AwaitExpression] = (
    node,
    options
) => {
    return ts.createAwait(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.PrefixUnaryExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PrefixUnaryExpression] = (
    node,
    options
) => {
    return ts.createPrefix(
        node.operator,
        Replicator.replicateProperty(node, 'operand', options)
    );
};

/**
 * @param {ts.PostfixUnaryExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PostfixUnaryExpression] = (
    node,
    options
) => {
    return ts.createPostfix(
        Replicator.replicateProperty(node, 'operand', options),
        node.operator
    );
};

/**
 * @param {ts.BinaryExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.BinaryExpression] = (
    node,
    options
) => {
    return ts.createBinary(
        Replicator.replicateProperty(node, 'left', options),
        Replicator.replicateProperty(node, 'operatorToken', options),
        Replicator.replicateProperty(node, 'right', options)
    );
};

/**
 * @param {ts.ConditionalExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ConditionalExpression] = (
    node,
    options
) => {
    return ts.createConditional(
        Replicator.replicateProperty(node, 'condition', options),
        Replicator.replicateProperty(node, 'whenTrue', options),
        Replicator.replicateProperty(node, 'whenFalse', options)
    );
};

/**
 * @param {ts.TemplateExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateExpression] = (
    node,
    options
) => {
    return ts.createTemplateExpression(
        Replicator.replicateProperty(node, 'head', options),
        Replicator.replicateArrayProperty(node, 'templateSpans', options)
    );
};

/**
 * @param {ts.YieldExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.YieldExpression] = (
    node,
    options
) => {
    return ts.createYield(
        Replicator.replicateIfProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.SpreadElement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SpreadElement] = (
    node,
    options
) => {
    return ts.createSpread(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.ClassExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ClassExpression] = (
    node,
    options
) => {
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.OmittedExpression] = (
    node,
    options
) => {
    return ts.createOmittedExpression();
};

/**
 * @param {ts.ExpressionWithTypeArguments} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExpressionWithTypeArguments] = (
    node,
    options
) => {
    return ts.createExpressionWithTypeArguments(
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.AsExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.AsExpression] = (node, options) => {
    return ts.createAsExpression(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.NonNullExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NonNullExpression] = (
    node,
    options
) => {
    return ts.createNonNullExpression(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.MetaProperty} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.MetaProperty] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.SyntheticExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SyntheticExpression] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.TemplateSpan} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateSpan] = (node, options) => {
    return ts.createTemplateSpan(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'literal', options)
    );
};

/**
 * @param {ts.SemicolonClassElement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SemicolonClassElement] = (
    node,
    options
) => {
    return ts.createSemicolonClassElement();
};

/**
 * @param {ts.Block} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.Block] = (node, options) => {
    return ts.createBlock(
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.VariableStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.VariableStatement] = (
    node,
    options
) => {
    return ts.createVariableStatement(
        Replicator.replicateIfProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'declarationList', options)
    );
};

/**
 * @param {ts.EmptyStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.EmptyStatement] = (
    node,
    options
) => {
    return ts.createEmptyStatement();
};

/**
 * @param {ts.ExpressionStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExpressionStatement] = (
    node,
    options
) => {
    return ts.createExpressionStatement(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.IfStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.DoStatement] = (node, options) => {
    return ts.createDo(
        Replicator.replicateProperty(node, 'statement', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.WhileStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.WhileStatement] = (
    node,
    options
) => {
    return ts.createWhile(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ForStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ForStatement] = (node, options) => {
    return ts.createFor(
        Replicator.replicateIfProperty(node, 'initializer', options),
        Replicator.replicateIfProperty(node, 'condition', options),
        Replicator.replicateIfProperty(node, 'incrementor', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ForInStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ForInStatement] = (
    node,
    options
) => {
    return ts.createForIn(
        Replicator.replicateProperty(node, 'initializer', options),
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ForOfStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ForOfStatement] = (
    node,
    options
) => {
    return ts.createForOf(
        Replicator.replicateIfProperty(node, 'awaitModifier', options), // TODO: check this again
        Replicator.replicateProperty(node, 'initializer', options),
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ContinueStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ContinueStatement] = (
    node,
    options
) => {
    return ts.createContinue(
        Replicator.replicateIfProperty(node, 'label', options)
    );
};

/**
 * @param {ts.BreakStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.BreakStatement] = (
    node,
    options
) => {
    return ts.createBreak(
        Replicator.replicateIfProperty(node, 'label', options)
    );
};

/**
 * @param {ts.ReturnStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ReturnStatement] = (
    node,
    options
) => {
    return ts.createReturn(
        Replicator.replicateIfProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.WithStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.WithStatement] = (
    node,
    options
) => {
    return ts.createWith(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.SwitchStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SwitchStatement] = (
    node,
    options
) => {
    return ts.createSwitch(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateProperty(node, 'caseBlock', options)
    );
};

/**
 * @param {ts.LabeledStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.LabeledStatement] = (
    node,
    options
) => {
    return ts.createLabel(
        Replicator.replicateProperty(node, 'label', options),
        Replicator.replicateProperty(node, 'statement', options)
    );
};

/**
 * @param {ts.ThrowStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ThrowStatement] = (
    node,
    options
) => {
    return ts.createThrow(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.TryStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.DebuggerStatement] = (
    node,
    options
) => {
    return ts.createDebuggerStatement();
};

/**
 * @param {ts.VariableDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.VariableDeclaration] = (
    node,
    options
) => {
    return ts.createVariableDeclaration(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.VariableDeclarationList} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.VariableDeclarationList] = (
    node,
    options
) => {
    return ts.createVariableDeclarationList(
        Replicator.replicateArrayProperty(node, 'declarations', options),
        node.flags // TODO: check again
    );
};

/**
 * @param {ts.FunctionDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.FunctionDeclaration] = (
    node,
    options
) => {
    return ts.createFunctionDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'asteriskToken', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options),
        Replicator.replicateIfProperty(node, 'body', options)
    );
};

/**
 * @param {ts.ClassDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ClassDeclaration] = (
    node,
    options
) => {
    return ts.createClassDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'heritageClauses', options),
        Replicator.replicateArrayProperty(node, 'members', options)
    );
};

/**
 * @param {ts.InterfaceDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.InterfaceDeclaration] = (
    node,
    options
) => {
    return ts.createInterfaceDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateIfArrayProperty(node, 'heritageClauses', options),
        Replicator.replicateArrayProperty(node, 'members', options)
    );
};

/**
 * @param {ts.TypeAliasDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeAliasDeclaration] = (
    node,
    options
) => {
    return ts.createTypeAliasDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateProperty(node, 'type', options)
    );
};

/**
 * @param {ts.EnumDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.EnumDeclaration] = (
    node,
    options
) => {
    return ts.createEnumDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateArrayProperty(node, 'members', options)
    );
};

/**
 * @param {ts.ModuleDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ModuleDeclaration] = (
    node,
    options
) => {
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ModuleBlock] = (node, options) => {
    return ts.createModuleBlock(
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.CaseBlock} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.CaseBlock] = (node, options) => {
    return ts.createCaseBlock(
        Replicator.replicateArrayProperty(node, 'clauses', options)
    );
};

/**
 * @param {ts.NamespaceExportDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamespaceExportDeclaration] = (
    node,
    options
) => {
    return ts.createNamespaceExportDeclaration(
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.ImportEqualsDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportEqualsDeclaration] = (
    node,
    options
) => {
    return ts.createImportEqualsDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateProperty(node, 'moduleReference', options)
    );
};

/**
 * @param {ts.ImportDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportDeclaration] = (
    node,
    options
) => {
    return ts.createImportDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'importClause', options),
        Replicator.replicateProperty(node, 'moduleSpecifier', options)
    );
};

/**
 * @param {ts.ImportClause} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportClause] = (node, options) => {
    return ts.createImportClause(
        Replicator.replicateIfProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'namedBindings', options)
    );
};

/**
 * @param {ts.NamespaceImport} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamespaceImport] = (
    node,
    options
) => {
    return ts.createNamespaceImport(
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.NamedImports} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamedImports] = (node, options) => {
    return ts.createNamedImports(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.ImportSpecifier} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ImportSpecifier] = (
    node,
    options
) => {
    return ts.createImportSpecifier(
        Replicator.replicateIfProperty(node, 'propertyName', options),
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.ExportAssignment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExportAssignment] = (
    node,
    options
) => {
    return ts.createExportAssignment(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'isExportEquals', options),
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.ExportDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExportDeclaration] = (
    node,
    options
) => {
    return ts.createExportDeclaration(
        Replicator.replicateIfArrayProperty(node, 'decorators', options),
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateIfProperty(node, 'exportClause', options),
        Replicator.replicateIfProperty(node, 'moduleSpecifier', options)
    );
};

/**
 * @param {ts.NamedExports} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NamedExports] = (node, options) => {
    return ts.createNamedExports(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

/**
 * @param {ts.ExportSpecifier} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExportSpecifier] = (
    node,
    options
) => {
    return ts.createExportSpecifier(
        Replicator.replicateIfProperty(node, 'propertyName', options),
        Replicator.replicateProperty(node, 'name', options)
    );
};

/**
 * @param {ts.MissingDeclaration} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.MissingDeclaration] = (
    node,
    options
) => {
    // ???
};

/**
 * @param {ts.ExternalModuleReference} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ExternalModuleReference] = (
    node,
    options
) => {
    return ts.createExternalModuleReference(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.JsxElement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxSelfClosingElement] = (
    node,
    options
) => {
    return ts.createJsxSelfClosingElement(
        Replicator.replicateProperty(node, 'tagName', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateProperty(node, 'attributes', options)
    );
};

/**
 * @param {ts.JsxOpeningElement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxOpeningElement] = (
    node,
    options
) => {
    return ts.createJsxOpeningElement(
        Replicator.replicateProperty(node, 'tagName', options),
        Replicator.replicateIfArrayProperty(node, 'typeArguments', options),
        Replicator.replicateProperty(node, 'attributes', options)
    );
};

/**
 * @param {ts.JsxClosingElement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxClosingElement] = (
    node,
    options
) => {
    return ts.createJsxClosingElement(
        Replicator.replicateProperty(node, 'tagName', options)
    );
};

/**
 * @param {ts.JsxFragment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
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
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxOpeningFragment] = (
    node,
    options
) => {
    return ts.createJsxOpeningFragment();
};

/**
 * @param {ts.JsxClosingFragment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxClosingFragment] = (
    node,
    options
) => {
    return ts.createJsxJsxClosingFragment();
};

/**
 * @param {ts.JsxAttribute} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxAttribute] = (node, options) => {
    return ts.createJsxAttribute(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.JsxAttributes} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxAttributes] = (
    node,
    options
) => {
    return ts.createJsxAttributes(
        Replicator.replicateArrayProperty(node, 'properties', options)
    );
};

/**
 * @param {ts.JsxSpreadAttribute} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxSpreadAttribute] = (
    node,
    options
) => {
    return ts.createJsxSpreadAttribute(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.JsxExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxExpression] = (
    node,
    options
) => {
    return ts.createJsxExpression(
        Replicator.replicateIfProperty(node, 'dotDotDotToken', options),
        Replicator.replicateIfProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.CaseClause} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.CaseClause] = (node, options) => {
    return ts.createCaseClause(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.DefaultClause} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.DefaultClause] = (
    node,
    options
) => {
    return ts.createDefaultClause(
        Replicator.replicateArrayProperty(node, 'statements', options)
    );
};

/**
 * @param {ts.HeritageClause} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.HeritageClause] = (
    node,
    options
) => {
    return ts.createHeritageClause(
        Replicator.replicateProperty(node, 'token', options),
        Replicator.replicateArrayProperty(node, 'types', options)
    );
};

/**
 * @param {ts.CatchClause} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.CatchClause] = (node, options) => {
    return ts.createCatchClause(
        Replicator.replicateIfProperty(node, 'variableDeclaration', options),
        Replicator.replicateProperty(node, 'block', options)
    );
};

/**
 * @param {ts.PropertyAssignment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PropertyAssignment] = (
    node,
    options
) => {
    return ts.createPropertyAssignment(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.ShorthandPropertyAssignment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.ShorthandPropertyAssignment] = (
    node,
    options
) => {
    return ts.createShorthandPropertyAssignment(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(
            node,
            'objectAssignmentInitializer',
            options
        )
    );
};

/**
 * @param {ts.SpreadAssignment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SpreadAssignment] = (
    node,
    options
) => {
    return ts.createSpreadAssignment(
        Replicator.replicateProperty(node, 'expression', options)
    );
};

/**
 * @param {ts.EnumMember} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.EnumMember] = (node, options) => {
    return ts.createEnumMember(
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'initializer', options)
    );
};

/**
 * @param {ts.UnparsedPrologue} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedPrologue] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedPrepend} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedPrepend] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedText} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedText] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedInternalText} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedInternalText] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.UnparsedSyntheticReference} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedSyntheticReference] = (
    node,
    options
) => {
    // TODO: ???
};

/**
 * @param {ts.SourceFile} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SourceFile] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.Bundle} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.Bundle] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.UnparsedSource} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.UnparsedSource] = (
    node,
    options
) => {
    // TODO: add logic
};

/**
 * @param {ts.InputFiles} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.InputFiles] = (node, options) => {
    // TODO: add logic
};

/**
 * @param {ts.JSDocTypeExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypeExpression] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocTypeExpression);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocAllType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocAllType] = (node, options) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocAllType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocUnknownType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocUnknownType] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocUnknownType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocNullableType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocNullableType] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocNullableType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocNonNullableType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocNonNullableType] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocNonNullableType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocOptionalType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocOptionalType] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocOptionalType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocFunctionType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocFunctionType] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocFunctionType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocVariadicType} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocVariadicType] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocVariadicType);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocComment} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocComment] = (node, options) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocComment);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocTypeLiteral} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypeLiteral] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocTypeLiteral);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocSignature} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocSignature] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocSignature);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTag] = (node, options) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocAugmentsTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocAugmentsTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocAugmentsTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocClassTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocClassTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocClassTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocCallbackTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocCallbackTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocCallbackTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocEnumTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocEnumTag] = (node, options) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocEnumTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocParameterTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocParameterTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocParameterTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocReturnTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocReturnTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocReturnTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocThisTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocThisTag] = (node, options) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocThisTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocTypeTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypeTag] = (node, options) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocTypeTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocTemplateTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTemplateTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocTemplateTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocTypedefTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocTypedefTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocTypedefTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.JSDocPropertyTag} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JSDocPropertyTag] = (
    node,
    options
) => {
    const clone = ts.createNode(ts.SyntaxKind.JSDocPropertyTag);
    // TODO: copy properties
    return clone;
};

/**
 * @param {ts.SyntaxList} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.SyntaxList] = (node, options) => {
    // TODO: ???
};

/**
 * @param {ts.NotEmittedStatement} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.NotEmittedStatement] = (
    node,
    options
) => {
    return ts.createNotEmittedStatement(
        Replicator.replicateProperty(node, 'original', options)
    );
};

/**
 * @param {ts.PartiallyEmittedExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.PartiallyEmittedExpression] = (
    node,
    options
) => {
    return ts.createPartiallyEmittedExpression(
        Replicator.replicateProperty(node, 'expression', options),
        Replicator.replicateIfProperty(node, 'original', options)
    );
};

/**
 * @param {ts.CommaListExpression} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.CommaListExpression] = (
    node,
    options
) => {
    return ts.createCommaList(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

// MergeDeclarationMarker = 316,
// EndOfDeclarationMarker = 317,

module.exports = Replicator;
