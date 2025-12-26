const ts = require('typescript');

//-----------------------------------------------------------------------------

/**
 * @typedef {Object} ISense.ASTReplicate.Options
 * @property {Boolean} setOriginal -
 * @property {(original: ts.Node, clone: ts.Node) => void} onReplicate -
 */

//-----------------------------------------------------------------------------

const Replicator = {};

Replicator.replicateFunctions = [];
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
    return ts.factory.createNodeArray(
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
Replicator.replicateIfArrayProperty = (object, property, options) => {
    return (
        object[property] &&
        ts.factory.createNodeArray(
            object[property].map(n => Replicator.replicateInternal(n, options))
        )
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

/**
 * @param {ts.Node} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Modifier[] | undefined}
 */
Replicator.combineModifiers = (node, options) => {
    const decorators = Replicator.replicateIfArrayProperty(
        node,
        'decorators',
        options
    );
    const modifiers = Replicator.replicateIfArrayProperty(
        node,
        'modifiers',
        options
    );
    if (!decorators && !modifiers) return undefined;
    if (!decorators) return modifiers;
    if (!modifiers) return decorators;
    return ts.factory.createNodeArray([...decorators, ...modifiers]);
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
    return ts.factory.createNumericLiteral(node.text);
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
    return ts.factory.createBigIntLiteral(node.text);
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
    return ts.factory.createStringLiteral(node.text);
};

/**
 * @param {ts.JsxText} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxText] = (node, options) => {
    return ts.factory.createJsxText(
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
    return ts.factory.createRegularExpressionLiteral(node.text);
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
    return ts.factory.createNoSubstitutionTemplateLiteral(node.text);
};

/**
 * @param {ts.TemplateHead} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateHead] = (node, options) => {
    return ts.factory.createTemplateHead(node.text);
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
    return ts.factory.createTemplateMiddle(node.text);
};

/**
 * @param {ts.TemplateTail} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TemplateTail] = (node, options) => {
    return ts.factory.createTemplateTail(node.text);
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
            return ts.factory.createToken(node.kind);
        };

/**
 * @param {ts.Identifier} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.Identifier] = (node, options) => {
    return ts.factory.createIdentifier(node.text);
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
            return ts.factory.createKeywordTypeNode(node.kind);
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
    return ts.factory.createQualifiedName(
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
    return ts.factory.createComputedPropertyName(
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
    return ts.factory.createParameterDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createDecorator(
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
    return ts.factory.createPropertySignature(
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
    return ts.factory.createPropertyDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createMethodSignature(
        Replicator.replicateIfArrayProperty(node, 'modifiers', options),
        Replicator.replicateProperty(node, 'name', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateIfArrayProperty(node, 'typeParameters', options),
        Replicator.replicateArrayProperty(node, 'parameters', options),
        Replicator.replicateIfProperty(node, 'type', options)
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
    return ts.factory.createMethodDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createConstructorDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createGetAccessorDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createSetAccessorDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createCallSignature(
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
    return ts.factory.createConstructSignature(
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
    return ts.factory.createIndexSignature(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createTypePredicateNode(
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
    return ts.factory.createTypeReferenceNode(
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
    return ts.factory.createFunctionTypeNode(
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
    return ts.factory.createConstructorTypeNode(
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
    return ts.factory.createTypeQueryNode(
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
    return ts.factory.createTypeLiteralNode(
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
    return ts.factory.createArrayTypeNode(
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
    return ts.factory.createTupleTypeNode(
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
    return ts.factory.createOptionalTypeNode(
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
    return ts.factory.createRestTypeNode(
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
    return ts.factory.createUnionTypeNode(
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
    return ts.factory.createIntersectionTypeNode(
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
    return ts.factory.createConditionalTypeNode(
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
    return ts.factory.createInferTypeNode(
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
    return ts.factory.createParenthesizedType(
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
    return ts.factory.createThisTypeNode();
};

/**
 * @param {ts.TypeOperator} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.TypeOperator] = (node, options) => {
    return ts.factory.createTypeOperatorNode(
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
    return ts.factory.createIndexedAccessTypeNode(
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
    return ts.factory.createMappedTypeNode(
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
    return ts.factory.createLiteralTypeNode(
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
    return ts.factory.createImportTypeNode(
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
    return ts.factory.createObjectBindingPattern(
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
    return ts.factory.createArrayBindingPattern(
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
    return ts.factory.createBindingElement(
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
    return ts.factory.createArrayLiteralExpression(
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
    return ts.factory.createObjectLiteralExpression(
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
    return ts.factory.createPropertyAccessExpression(
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
    return ts.factory.createElementAccessExpression(
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
    return ts.factory.createCallExpression(
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
    return ts.factory.createNewExpression(
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
    return ts.factory.createTypeAssertion(
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
    return ts.factory.createParenthesizedExpression(
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
    return ts.factory.createFunctionExpression(
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
    return ts.factory.createArrowFunction(
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
    return ts.factory.createDeleteExpression(
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
    return ts.factory.createTypeOfExpression(
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
    return ts.factory.createVoidExpression(
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
    return ts.factory.createAwaitExpression(
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
    return ts.factory.createPrefixUnaryExpression(
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
    return ts.factory.createPostfixUnaryExpression(
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
    return ts.factory.createBinaryExpression(
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
    return ts.factory.createConditionalExpression(
        Replicator.replicateProperty(node, 'condition', options),
        Replicator.replicateIfProperty(node, 'questionToken', options),
        Replicator.replicateProperty(node, 'whenTrue', options),
        Replicator.replicateIfProperty(node, 'colonToken', options),
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
    return ts.factory.createTemplateExpression(
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
    return ts.factory.createYieldExpression(
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
    return ts.factory.createSpreadElement(
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
    return ts.factory.createClassExpression(
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
    return ts.factory.createOmittedExpression();
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
    return ts.factory.createExpressionWithTypeArguments(
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
    return ts.factory.createAsExpression(
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
    return ts.factory.createNonNullExpression(
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
    return ts.factory.createTemplateSpan(
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
    return ts.factory.createSemicolonClassElement();
};

/**
 * @param {ts.Block} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.Block] = (node, options) => {
    return ts.factory.createBlock(
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
    return ts.factory.createVariableStatement(
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
    return ts.factory.createEmptyStatement();
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
    return ts.factory.createExpressionStatement(
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
    return ts.factory.createIfStatement(
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
    return ts.factory.createDoStatement(
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
    return ts.factory.createWhileStatement(
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
    return ts.factory.createForStatement(
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
    return ts.factory.createForInStatement(
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
    return ts.factory.createForOfStatement(
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
    return ts.factory.createContinueStatement(
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
    return ts.factory.createBreakStatement(
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
    return ts.factory.createReturnStatement(
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
    return ts.factory.createWithStatement(
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
    return ts.factory.createSwitchStatement(
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
    return ts.factory.createLabeledStatement(
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
    return ts.factory.createThrowStatement(
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
    return ts.factory.createTryStatement(
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
    return ts.factory.createDebuggerStatement();
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
    return ts.factory.createVariableDeclaration(
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
    return ts.factory.createVariableDeclarationList(
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
    return ts.factory.createFunctionDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createClassDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createInterfaceDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createTypeAliasDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createEnumDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createModuleDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createModuleBlock(
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
    return ts.factory.createCaseBlock(
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
    return ts.factory.createNamespaceExportDeclaration(
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
    return ts.factory.createImportEqualsDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createImportDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createImportClause(
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
    return ts.factory.createNamespaceImport(
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
    return ts.factory.createNamedImports(
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
    return ts.factory.createImportSpecifier(
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
    return ts.factory.createExportAssignment(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createExportDeclaration(
        Replicator.combineModifiers(node, options),
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
    return ts.factory.createNamedExports(
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
    return ts.factory.createExportSpecifier(
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
    return ts.factory.createExternalModuleReference(
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
    return ts.factory.createJsxElement(
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
    return ts.factory.createJsxSelfClosingElement(
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
    return ts.factory.createJsxOpeningElement(
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
    return ts.factory.createJsxClosingElement(
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
    return ts.factory.createJsxFragment(
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
    return ts.factory.createJsxOpeningFragment();
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
    return ts.factory.createJsxJsxClosingFragment();
};

/**
 * @param {ts.JsxAttribute} node
 * @param {ISense.ASTReplicate.Options} options
 *
 * @returns {ts.Node}
 */
Replicator.replicateFunctions[ts.SyntaxKind.JsxAttribute] = (node, options) => {
    return ts.factory.createJsxAttribute(
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
    return ts.factory.createJsxAttributes(
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
    return ts.factory.createJsxSpreadAttribute(
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
    return ts.factory.createJsxExpression(
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
    return ts.factory.createCaseClause(
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
    return ts.factory.createDefaultClause(
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
    return ts.factory.createHeritageClause(
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
    return ts.factory.createCatchClause(
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
    return ts.factory.createPropertyAssignment(
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
    return ts.factory.createShorthandPropertyAssignment(
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
    return ts.factory.createSpreadAssignment(
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
    return ts.factory.createEnumMember(
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
    const clone = ts.factory.createJSDocTypeExpression();
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
    const clone = ts.factory.createJSDocAllType();
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
    const clone = ts.factory.createJSDocUnknownType();
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
    const clone = ts.factory.createJSDocNullableType();
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
    const clone = ts.factory.createJSDocNonNullableType();
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
    const clone = ts.factory.createJSDocOptionalType();
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
    const clone = ts.factory.createJSDocFunctionType();
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
    const clone = ts.factory.createJSDocVariadicType();
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
    const clone = ts.factory.createJSDocComment();
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
    const clone = ts.factory.createJSDocTypeLiteral();
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
    const clone = ts.factory.createJSDocSignature();
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
    const clone = ts.factory.createJSDocUnknownTag();
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
    const clone = ts.factory.createJSDocAugmentsTag();
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
    const clone = ts.factory.createJSDocClassTag();
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
    const clone = ts.factory.createJSDocCallbackTag();
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
    const clone = ts.factory.createJSDocEnumTag();
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
    const clone = ts.factory.createJSDocParameterTag();
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
    const clone = ts.factory.createJSDocReturnTag();
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
    const clone = ts.factory.createJSDocThisTag();
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
    const clone = ts.factory.createJSDocTypeTag();
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
    const clone = ts.factory.createJSDocTemplateTag();
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
    const clone = ts.factory.createJSDocTypedefTag();
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
    const clone = ts.factory.createJSDocPropertyTag();
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
    return ts.factory.createNotEmittedStatement(
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
    return ts.factory.createPartiallyEmittedExpression(
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
    return ts.factory.createCommaListExpression(
        Replicator.replicateArrayProperty(node, 'elements', options)
    );
};

// MergeDeclarationMarker = 316,
// EndOfDeclarationMarker = 317,

module.exports = Replicator;
