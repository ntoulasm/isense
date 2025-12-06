const fs = require('fs');
const ts = require('typescript');
const vscodeLanguageServer = require('vscode-languageserver');

// ----------------------------------------------------------------------------

const Call = {};

// ----------------------------------------------------------------------------

const metadataFileName = 'call-metadata.json';
let metadata = {};

// ----------------------------------------------------------------------------

Call.loadMetadata = () => {
    metadata = fs.readFileSync(metadataFileName);
};

Call.saveMetadata = () => {
    fs.writeFileSync(metadataFileName, JSON.stringify(metadata));
};

// ----------------------------------------------------------------------------

Call.setMetadata = (ast, call, callee) => {
    const fileName = ast.fileName;
    if (!metadata[fileName]) {
        metadata[fileName] = [];
    } else {
        removePrevious(metadata[fileName], createRange(call));
    }
    metadata[fileName].push(createCallData(call, callee));
};

Call.getMetaData = (ast, call) => {
    const fileName = ast.fileName;
    if (metadata[fileName]) {
        const callData = metadata[fileName].find(
            c => c.call.start === call.getStart(ast)
        );
        if (callData) {
            return callData.callee;
        }
    }
};

Call.removeMetaData = (ast, call) => {
    const fileName = ast.filename;
    if (metadata[fileName]) {
        const callData = metadata[fileName].find(
            c => c.call.start === call.getStart(ast)
        );
        removePrevious(callData, call);
    }
};

/**
 * @param {ts.SourceFile} ast
 * @param {vscodeLanguageServer.TextDocumentContentChangeEvent} change
 */
Call.updateMetadata = (ast, change) => {
    const fileName = ast.fileName;
    const callData = metadata[fileName];

    if (!callData) {
        return;
    }

    const changeStart = ast.getPositionOfLineAndCharacter(
        change.range.start.line,
        change.range.start.character
    );
    const changeEnd = ast.getPositionOfLineAndCharacter(
        change.range.end.line,
        change.range.end.character,
        true
    );
    const changeRange = { start: changeStart, end: changeEnd };
    const invalidate = range => invalidateRange(callData, range);

    for (const { call, callee } of callData) {
        updateRange(call, change.text, changeRange, invalidate);
        updateRange(callee, change.text, changeRange, invalidate);
    }
};

function updateRange(range, changeText, changeRange, invalidateRange) {
    if (isBefore(changeRange, range)) {
        range.start += changeRange.start - changeRange.end + changeText.length;
    } else if (isInner(changeRange, range)) {
        range.end += changeRange.start - changeRange.end + changeText.length;
    } else if (!isAfter(changeRange, range)) {
        invalidateRange(range);
    }
}

// ----------------------------------------------------------------------------

function createCallData(call, callee) {
    return {
        call: createRange(call),
        callee: createRange(callee),
    };
}

function createRange(node) {
    return {
        start: node.getStart(),
        end: node.end,
    };
}

// ----------------------------------------------------------------------------

function isBefore(range1, range2) {
    return range1.start < range2.start && range1.end < range2.start;
}

function isAfter(range1, range2) {
    return range1.start > range2.start;
}

function isInner(outerRange, innerRange) {
    return (
        outerRange.start <= innerRange.start && outerRange.end >= innerRange.end
    );
}

// ----------------------------------------------------------------------------

function invalidateRange(callData, range) {
    for (let i = 0; i < callData.length; ++i) {
        if (callData[i].call === range || callData[i].callee === range) {
            callData.splice(i, 1);
        }
    }
}

function removePrevious(callData, call) {
    for (let i = 0; i < callData.length; ++i) {
        if (callData[i].call.start === call.start) {
            callData.splice(i, 1);
        }
    }
}

// ----------------------------------------------------------------------------

module.exports = Call;
