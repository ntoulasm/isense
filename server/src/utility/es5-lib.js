const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// ----------------------------------------------------------------------------

const es5LibText = fs.readFileSync(
    path.resolve(__dirname, '../../node_modules/typescript/lib/lib.es5.d.ts'),
    'utf-8'
);
const es5LibAst = ts.createSourceFile(
    'globals',
    es5LibText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
);

// ----------------------------------------------------------------------------

module.exports = es5LibAst;
