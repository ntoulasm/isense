module.exports = {
    testEnvironment: 'node',
    rootDir: '.',
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    coverageDirectory: '<rootDir>/test/coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: [
        '<rootDir>/test/unit/**/*.test.js',
        '<rootDir>/test/integration/**/*.test.js',
        '<rootDir>/test/performance/**/*.test.js',
    ],
    testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
    modulePathIgnorePatterns: ['<rootDir>/test/coverage/'],
    moduleFileExtensions: ['js', 'json'],
    verbose: true,
    testTimeout: 30000,
};
