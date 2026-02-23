const ServicesSnapshotRunner = require('../services-snapshot-runner');
const path = require('path');
const fs = require('fs');

describe('Marker Driven Snapshots', () => {
    const fixturesDir = path.join(__dirname, '../fixtures/analyzer');
    // Recursively find all .js files
    function getFiles(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFiles(file));
            } else if (file.endsWith('.js')) {
                results.push(file);
            }
        });
        return results;
    }

    const allFiles = getFiles(fixturesDir);

    allFiles.forEach(fixturePath => {
        const relativePath = path.relative(fixturesDir, fixturePath);
        it(`${relativePath}`, () => {
            const output = ServicesSnapshotRunner.run(fixturePath);
            // Only create snapshot if there are actual markers/results
            if (output) {
                expect(output).toMatchSnapshot();
            }
        });
    });
});
