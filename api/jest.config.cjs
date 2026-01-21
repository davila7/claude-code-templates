/**
 * Jest Configuration for API Tests
 *
 * This configuration is designed to test production API endpoints
 * to ensure critical functionality doesn't break during deployments.
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!node_modules/**',
    '!__tests__/**',
    '!jest.config.cjs',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000, // 30 seconds default timeout
  bail: false, // Run all tests even if some fail
  maxWorkers: 4, // Run tests in parallel
};
