const fs = require('fs');
const ts = require('typescript');
const Analyzer = require('../src/analyzer/analyzer');
const Ast = require('../src/ast/ast');
const Hover = require('../src/services/hover');
const Completion = require('../src/services/completion');
const Definition = require('../src/services/definition');
const es5LibAst = require('../src/utility/es5-lib');

/**
 * LSP Snapshot Runner
 * Parses JS files for special comment markers (e.g., // ^hover)
 * and executes corresponding LSP requests.
 */
class LspSnapshotRunner {
    /**
     * @param {string} filePath Absolute path to the test JS file
     */
    static run(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const markers = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const markerMatch = line.match(/^\/\/\s*\^(\w+)/);
            if (markerMatch) {
                const kind = markerMatch[1];
                const column = line.indexOf('^');

                // Find target line (first non-marker line above)
                let targetLineIndex = i - 1;
                while (
                    targetLineIndex >= 0 &&
                    lines[targetLineIndex].match(/^\/\/\s*\^/)
                ) {
                    targetLineIndex--;
                }

                if (targetLineIndex >= 0) {
                    markers.push({
                        kind,
                        line: targetLineIndex,
                        column,
                        markerLine: i,
                    });
                }
            }
        }

        // Initialize AST and Analyze
        const fileName = filePath;
        const ast = ts.createSourceFile(
            fileName,
            content,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.JS
        );

        // Reset and populate Ast.asts
        Ast.asts = {};
        Ast.asts[fileName] = ast;

        Analyzer.analyze(es5LibAst);
        Analyzer.analyze(ast);

        const groupedMarkers = new Map();
        markers.forEach(m => {
            if (!groupedMarkers.has(m.line)) {
                groupedMarkers.set(m.line, []);
            }
            groupedMarkers.get(m.line).push(m);
        });

        const outputSegments = [];
        groupedMarkers.forEach((lineMarkers, lineIndex) => {
            const codeLine = lines[lineIndex];
            const lineNumber = lineIndex + 1;
            const lineHeader = `[${lineNumber}] ${codeLine}`;
            const segment = [lineHeader];

            lineMarkers.forEach(marker => {
                const targetLine = lines[marker.line];
                const column = Math.min(marker.column, targetLine.length);
                const position = {
                    line: marker.line,
                    character: column,
                };

                // Determine trigger character for completions
                let triggerCharacter = undefined;
                if (
                    marker.kind === 'complete' ||
                    marker.kind === 'completion'
                ) {
                    const targetLine = lines[marker.line];
                    const charAtMarker = targetLine[marker.column];
                    const charBeforeMarker =
                        marker.column > 0
                            ? targetLine[marker.column - 1]
                            : undefined;

                    if (charAtMarker === '.') {
                        triggerCharacter = '.';
                    } else if (charBeforeMarker === '.') {
                        triggerCharacter = '.';
                    }
                }

                const info = {
                    textDocument: { uri: fileName },
                    position,
                    context: {
                        triggerCharacter,
                    },
                };

                let response;
                switch (marker.kind) {
                    case 'hover':
                        response = Hover.onHover(info);
                        break;
                    case 'complete':
                    case 'completion':
                        response = Completion.onCompletion(info);
                        break;
                    case 'def':
                    case 'definition':
                        response = Definition.onDefinition(info);
                        break;
                    default:
                        response = `Unknown marker kind: ${marker.kind}`;
                }

                const serialized = this.serialize(response);
                // Padding to account for "[lineNumber] "
                const padding = ' '.repeat(String(lineNumber).length + 3);
                const markerLine = `${padding}${' '.repeat(marker.column)}^${marker.kind}`;

                if (serialized.includes('\n')) {
                    // Multi-line response
                    segment.push(markerLine);
                    serialized.split('\n').forEach(line => {
                        segment.push(
                            `${padding}${' '.repeat(marker.column)}| ${line}`
                        );
                    });
                } else {
                    segment.push(`${markerLine} -> ${serialized}`);
                }
            });
            outputSegments.push(segment.join('\n'));
        });

        return outputSegments.join('\n\n');
    }
    static serialize(response) {
        if (!response) return 'null';

        // Handle Hover response
        if (response.contents) {
            const contents = response.contents;
            if (Array.isArray(contents)) {
                return contents
                    .map(c => (typeof c === 'string' ? c : c.value))
                    .join('\n---\n')
                    .trim();
            }
            const value =
                typeof contents === 'string' ? contents : contents.value;
            return value.trim();
        }

        // Handle Completion response
        if (Array.isArray(response)) {
            if (response.length > 0 && response[0].label) {
                return response
                    .map(item => item.label)
                    .sort()
                    .join(', ');
            }
        }

        // Handle Definition response
        if (Array.isArray(response)) {
            // Usually Location | Location[]
            return response
                .map(
                    loc =>
                        `${loc.uri.split('/').pop()}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`
                )
                .join(', ');
        }
        if (response.uri) {
            return `${response.uri.split('/').pop()}:${response.range.start.line + 1}:${response.range.start.character + 1}`;
        }

        return JSON.stringify(response, null, 2);
    }
}

module.exports = LspSnapshotRunner;
