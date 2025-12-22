const path = require('path');

module.exports = {
    testEnvironment: 'node',
    rootDir: path.resolve(__dirname, '..'),
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    collectCoverageFrom: ['server/src/**/*.js', '!server/src/**/*.test.js'],
    coverageDirectory: '<rootDir>/test/coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: [
        '<rootDir>/test/unit/**/*.test.js',
        '<rootDir>/test/integration/**/*.test.js',
        '<rootDir>/test/performance/**/*.test.js',
    ],
    moduleFileExtensions: ['js', 'json'],
    verbose: true,
    testTimeout: 10000,
};
