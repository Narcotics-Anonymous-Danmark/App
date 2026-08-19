process.env.TZ = 'Europe/Copenhagen';
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/test/setup-jest.ts'],
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/www/', '<rootDir>/platforms/', '<rootDir>/plugins/'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    ['cobertura', { file: 'coverage.xml' }],
    'lcov',
    'text-summary',
  ],
  collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.module.ts', '!src/app/**/*.d.ts', '!src/app/**/*.test.ts'],
};
