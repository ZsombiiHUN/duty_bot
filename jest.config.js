/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'], // Look for tests within the src directory
  testMatch: [ // Pattern to find test files
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: { // If you use path aliases in tsconfig.json, map them here
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Optional: Setup files to run before each test file
  // setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  // Optional: Collect coverage information
  // collectCoverage: true,
  // coverageDirectory: 'coverage',
  // coverageProvider: 'v8',
};
