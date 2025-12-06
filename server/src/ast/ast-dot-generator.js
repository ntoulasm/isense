const DotGenerator = require('../utility/dot-generator');
const Ast = require('./ast');

const ts = require('typescript');

const AstDotGenerator = {};

AstDotGenerator.generate = (root, path) => {
    const generator = DotGenerator.create();
    let dotId = -1;

    const generateInternal = node => {
        node.dotId = ++dotId;

        let label = Ast.nodeKindToString(node);
        switch (node.kind) {
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
                label += ` '${node.text}'`;
                break;
        }
        label += ` ${node.pos}`;

        generator.addNode(node.dotId, label);

        if (node.parent) {
            generator.addEdge(node.parent.dotId, node.dotId);
        }

        ts.forEachChild(node, generateInternal);
    };

    generator.new('AST');
    generateInternal(root);
    generator.save(path);
};

module.exports = AstDotGenerator;
