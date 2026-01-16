const ts = require('typescript');
const {getAst} = require('./utility');

// --------------------------------------------------------------------------------------

const InlayHint = {};

// --------------------------------------------------------------------------------------

InlayHint.onInlayHint = info => {
    try {
        const ast = getAst(info);
        if (!ast) { return []; }

        const hints = [];
        const range = info.range;

        const startOffset = getOffsetFromPosition(ast, range.start);
        const endOffset = getOffsetFromPosition(ast, range.end);

        function visit(node) {
            const nodeStart = node.getStart(ast);
            const nodeEnd = node.getEnd();

            if (nodeStart > endOffset || nodeEnd < startOffset) {
                return;
            }

            ts.forEachChild(node, visit);
        }

        visit(ast);

        return hints;
    } catch {
        return [];
    }
};

// --------------------------------------------------------------------------------------

function getOffsetFromPosition(ast, position) {
    const lineStarts = ast.getLineStarts();
    const line = Math.min(position.line, lineStarts.length - 1);
    const lineStart = lineStarts[line];
    const nextLineStart =
        line + 1 < lineStarts.length ? lineStarts[line + 1] : ast.text.length;
    const character = Math.min(position.character, nextLineStart - lineStart);
    return lineStart + character;
}

// --------------------------------------------------------------------------------------

module.exports = InlayHint;