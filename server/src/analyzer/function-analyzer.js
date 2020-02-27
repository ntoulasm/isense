const Symbol = require('../utility/symbol');
const SymbolTable = require('../utility/symbol_table');
const TypeCarrier = require('../utility/type_carrier');
const Ast = require('../ast/ast');

const ts = require('typescript');


const FunctionAnalyzer = {};

/**
 * @param {ts.FunctionDeclaration} fun
 */
FunctionAnalyzer.analyze = (fun) => {
    declareParameters(fun);
};

/**
 * @param {ts.Node} fun
 */
function declareParameters(fun) {
    console.assert(fun.parameters);
    for(const node of fun.parameters) {
        node.symbols = SymbolTable.create();
        if(node.name.kind === ts.SyntaxKind.Identifier) {
            const name = node.name.text;
            const start = node.name.getStart();
            const end = node.name.end;
            const symbol = Symbol.create(name, start, end);
            Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            node.symbols.insert(symbol);
        } else if(node.name.kind === ts.SyntaxKind.ArrayBindingPattern || node.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
            // visitDestructuringDeclerations(node.name, (name, start, end) => {
            //     const symbol = Symbol.create(name, start, end);
            //     Ast.addTypeCarrier(node, TypeCarrier.create(symbol, {id: TypeCarrier.Type.Undefined}));
            //     node.symbols.insert(symbol);
            // });
        } else {
            console.assert(false);
        }
    }
}

module.exports = FunctionAnalyzer;