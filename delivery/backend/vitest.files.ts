// Suites that need a running API server (PORT, default 3002) and a migrated +
// seeded database. Listed here so the unit config can exclude exactly what the
// integration config includes, with no chance of the two lists drifting apart.
export const INTEGRATION_TEST_FILES = [
  'src/__tests__/api.test.ts',
  'src/__tests__/security.test.ts',
];
