const fs = require('fs');

// ----------------------------------------------------------------------------

const DotGenerator = {};

DotGenerator.create = () => {
    const generator = {};
    generator.private = {};

    generator.private.createdGraph = false;
    generator.private.graphText = '';

    generator.private.appendText = text => {
        generator.private.graphText += text;
    };

    generator.new = graphName => {
        generator.reset();
        generator.private.appendText(
            `digraph ${graphName} { graph [ label = "${graphName}"];\n`
        );
        generator.private.createdGraph = true;
    };

    generator.addNode = (id, label) => {
        console.assert(
            generator.private.createdGraph,
            'Added node to non existing graph'
        );
        generator.private.appendText(`node${id} [label="${label}"]\n`);
    };

    generator.addEdge = (fromId, toId, label = '') => {
        console.assert(
            generator.private.createdGraph,
            'Added node to non existing graph'
        );
        generator.private.appendText(
            `node${fromId} -> node${toId} [label="${label}"]\n`
        );
    };

    generator.save = path => {
        console.assert(
            generator.private.createdGraph,
            'Saved non existing graph'
        );
        const fd = fs.openSync(path, 'w');
        generator.private.appendText('}');
        fs.writeFileSync(fd, generator.private.graphText);
        fs.closeSync(fd);
    };

    generator.reset = () => {
        generator.private.graphText = '';
        generator.private.createdGraph = false;
    };

    return generator;
};

module.exports = DotGenerator;
