const fs = require('fs');
const path = require('path');

function getVersion(versionString) {
    if (!versionString) return '0.0.0';
    // Remove ^ or ~ and return the version
    return versionString.replace(/[\^~]/, '').replace(/>=/, '').trim();
}

/**
 * Returns true if v1 is older than v2
 */
function isOlder(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.min(parts1.length, parts2.length, 3); i++) {
        if (parts1[i] < parts2[i]) return true;
        if (parts1[i] > parts2[i]) return false;
    }
    return false;
}

function checkVSCode() {
    const clientPackagePath = path.join(
        __dirname,
        '..',
        'client',
        'package.json'
    );
    const clientPackage = JSON.parse(
        fs.readFileSync(clientPackagePath, 'utf8')
    );
    const vsCodeEngine = getVersion(clientPackage.engines.vscode);
    const vsCodeTypes = getVersion(
        clientPackage.devDependencies['@types/vscode']
    );

    console.log(`Checking VS Code Engine Alignment:`);
    console.log(`- engines.vscode: ${vsCodeEngine}`);
    console.log(`- @types/vscode:  ${vsCodeTypes}`);

    if (isOlder(vsCodeEngine, vsCodeTypes)) {
        console.error(
            `\n❌ ERROR: VS Code Engine version (${vsCodeEngine}) is older than @types/vscode (${vsCodeTypes}).`
        );
        return false;
    } else {
        console.log(`✅ VS Code alignment OK.`);
        return true;
    }
}

function checkNode() {
    const rootPackagePath = path.join(__dirname, '..', 'package.json');
    const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
    const nvmrcPath = path.join(__dirname, '..', '.nvmrc');
    const nvmrcVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();

    const nodeEngine = getVersion(rootPackage.engines.node);
    const nodeTypes = getVersion(rootPackage.devDependencies['@types/node']);

    console.log(`Checking Node.js Alignment:`);
    console.log(`- engines.node:  ${nodeEngine}`);
    console.log(`- @types/node:   ${nodeTypes}`);
    console.log(`- .nvmrc:        ${nvmrcVersion}`);

    if (isOlder(nodeEngine, nodeTypes)) {
        console.error(
            `\n❌ ERROR: Node engine (${nodeEngine}) is older than @types/node (${nodeTypes}).`
        );
        return false;
    }

    if (nodeEngine !== nvmrcVersion) {
        console.error(
            `\n❌ ERROR: Node engine version (${nodeEngine}) does not match .nvmrc (${nvmrcVersion}).`
        );
        return false;
    }

    console.log(`✅ Node alignment OK.`);
    return true;
}

const isVSCodeOk = checkVSCode();
const isNodeOk = checkNode();
const hasError = !isVSCodeOk || !isNodeOk;

if (!hasError) {
    console.log(`✅ All alignments OK.`);
    process.exit(0);
} else {
    process.exit(1);
}
