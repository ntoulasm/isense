module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/setup.js'],
    collectCoverageFrom: [
        '../server/src/**/*.js',
        '!../server/src/**/*.test.js',
        '!../server/src/**/__tests__/**',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: [
        '<rootDir>/unit/**/*.test.js',
        '<rootDir>/integration/**/*.test.js',
        '<rootDir>/performance/**/*.test.js',
    ],
    moduleFileExtensions: ['js', 'json'],
    verbose: true,
    testTimeout: 10000,
};
