module.exports = {
    verbose: true,
    coveragePathIgnorePatterns: [
        '/node_modules/'
    ],
    coverageReporters: ['json-summary', 'lcov'],
    testMatch: ['**/__tests__/**/test.*.js'],
    testEnvironment: 'node',
    collectCoverage: true,
    moduleDirectories: ['/data/node_modules'],
    collectCoverageFrom: ['./winstonOpentelemetryFormat/**/*.js'],
};