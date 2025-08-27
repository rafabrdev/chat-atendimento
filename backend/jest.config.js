module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  testTimeout: 10000,
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
