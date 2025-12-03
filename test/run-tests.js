#!/usr/bin/env node

/**
 * Test Runner for iSense Language Server
 * 
 * This script runs the comprehensive test suite for the "More Informative Untyped IntelliSense" project.
 * It provides options for running different types of tests and generating coverage reports.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_ROOT = __dirname;
const PROJECT_ROOT = path.join(TEST_ROOT, '..');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'white') {
  console.log(colorize(color, message));
}

function logSection(title) {
  console.log('');
  console.log(colorize('cyan', '='.repeat(60)));
  console.log(colorize('cyan', `  ${title}`));
  console.log(colorize('cyan', '='.repeat(60)));
  console.log('');
}

function runJest(options = []) {
  return new Promise((resolve, reject) => {
    const jestPath = path.join(TEST_ROOT, 'node_modules', '.bin', 'jest');
    const configPath = path.join(TEST_ROOT, 'jest.config.js');
    
    const args = [
      '--config', configPath,
      '--rootDir', TEST_ROOT,
      ...options
    ];

    log(`Running: npx jest ${args.join(' ')}`, 'blue');
    
    const jest = spawn('npx', ['jest', ...args], {
      cwd: TEST_ROOT,
      stdio: 'inherit',
      shell: true
    });

    jest.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      reject(error);
    });
  });
}

async function runTests() {
  const args = process.argv.slice(2);
  
  try {
    // Check if dependencies are installed
    if (!fs.existsSync(path.join(TEST_ROOT, 'node_modules'))) {
      logSection('Installing Dependencies');
      log('Installing test dependencies...', 'yellow');
      await new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install'], {
          cwd: TEST_ROOT,
          stdio: 'inherit',
          shell: true
        });
        npm.on('close', (code) => code === 0 ? resolve() : reject(new Error(`npm install failed with code ${code}`)));
      });
    }

    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }

    if (args.includes('--unit')) {
      logSection('Running Unit Tests');
      await runJest(['--testPathPattern=unit', '--verbose']);
    } else if (args.includes('--integration')) {
      logSection('Running Integration Tests');
      await runJest(['--testPathPattern=integration', '--verbose']);
    } else if (args.includes('--performance')) {
      logSection('Running Performance Tests');
      await runJest(['--testPathPattern=performance', '--verbose', '--testTimeout=60000']);
    } else if (args.includes('--coverage')) {
      logSection('Running All Tests with Coverage');
      await runJest(['--coverage', '--verbose']);
    } else if (args.includes('--watch')) {
      logSection('Running Tests in Watch Mode');
      await runJest(['--watch', '--verbose']);
    } else if (args.includes('--all')) {
      logSection('Running Complete Test Suite');
      await runJest(['--verbose']);
    } else {
      // Default: run all tests
      logSection('Running All Tests');
      await runJest(['--verbose']);
    }

    log('', 'green');
    log('✅ Test run completed successfully!', 'green');
    
  } catch (error) {
    log('', 'red');
    log('❌ Test run failed:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

function showHelp() {
  log('iSense Language Server Test Runner', 'bright');
  log('');
  log('Usage:', 'yellow');
  log('  node run-tests.js [options]', 'white');
  log('');
  log('Options:', 'yellow');
  log('  --unit         Run only unit tests', 'white');
  log('  --integration  Run only integration tests', 'white');
  log('  --performance  Run only performance tests', 'white');
  log('  --coverage     Run all tests with coverage report', 'white');
  log('  --watch        Run tests in watch mode', 'white');
  log('  --all          Run complete test suite (default)', 'white');
  log('  --help, -h     Show this help message', 'white');
  log('');
  log('Examples:', 'yellow');
  log('  node run-tests.js --unit', 'cyan');
  log('  node run-tests.js --coverage', 'cyan');
  log('  node run-tests.js --watch', 'cyan');
  log('');
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  runJest
};
