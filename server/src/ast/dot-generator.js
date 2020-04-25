const SignatureFinder = require('../utility/signature-finder');
const Ast = require('../ast/ast');

const ts = require('typescript');
const fs = require('fs');

const me = {};
let dotId = 0;

/**
 * @param {ts.Node} root
 */
me.generate = (root, outputFileName) => {

    const fileDescriptor = fs.openSync(outputFileName, 'w');
    
    const append = text => {
        fs.writeFileSync(fileDescriptor, text);
    };

    const setDotIds = node => {
        node.dotId = dotId++;
        ts.forEachChild(node, setDotIds);
    }

    const generateInternal = (node) => {

        const kindText = Ast.nodeKindToString(node);
        append(`node${node.dotId} [label="${kindText} ${node.pos}"]\n`);

        switch(node.kind) {
            case ts.SyntaxKind.Identifier:
            case ts.SyntaxKind.NumericLiteral: 
            case ts.SyntaxKind.StringLiteral: {
                append(`node${dotId} [label="${node.text}"]\n`);
                append(`node${node.dotId} -> node${dotId}\n`);
                ++dotId;
                break;
            }
            case ts.SyntaxKind.CallExpression: 
            case ts.SyntaxKind.NewExpression: {
                if(!node.hasOwnProperty('callee')) { break; }
                setDotIds(node.callee.parent);
                generateInternal(node.callee.parent);
                setDotIds(node.callee);
                generateInternal(node.callee);
                append(`node${node.dotId} -> node${node.callee.dotId} [label = "callee"]\n`);
                if(node.callee._original.pos !== -1) { // implicit nodes like emptyConstructor
                    append(`node${node.callee.dotId} -> node${node.callee._original.dotId} [label = "original"]`);
                }
                break;
            }
            default: {
                break;
            }
        }

        if(node.parent !== undefined) {
            append(`node${node.parent.dotId} -> node${node.dotId}`);
            node.unreachable && append(` [label = "unreachable" style = "dotted"]`);
            append('\n');
        }

        if(node.hasOwnProperty('symbols')) {
            const symbols = Object.values(node.symbols.getSymbols());
            append(`node${dotId} [shape = "record", label = "{ SYMBOLS | `);
            append(symbols.map(s => s.name).join(' | '));
            append(`}"]\n`);
            append(`node${node.dotId} -> node${dotId}\n`);
            ++dotId;
        }
        
        if(node.hasOwnProperty('typeCarriers') && node.typeCarriers.length) {
            append(`node${dotId}[shape = "record", label = "{ TYPECARRIERS | `);
            append(node.typeCarriers.map(t => SignatureFinder.computeSignature(node, t, ' or ', false)).join(' | '));
            append(`}"]\n`);
            append(`node${node.dotId} -> node${dotId}\n`);
            ++dotId;

        }

        if(node.hasOwnProperty('blockTypeCarriers') && node.blockTypeCarriers.length) {
            append(`node${dotId}[shape = "record", label = "{ BLOCKTYPECARRIERS | `);
            append(node.blockTypeCarriers.map(t => SignatureFinder.computeSignature(node, t, ' or ', false)).join(' | '));
            append(`}"]\n`);
            append(`node${node.dotId} -> node${dotId}\n`);
            ++dotId;

        }

        ts.forEachChild(node, generateInternal);

    };

    append('digraph AST { graph [ label = "AST"];\n');
    setDotIds(root);
    generateInternal(root);
    append('}');

    fs.closeSync(fileDescriptor);

}

module.exports = me;