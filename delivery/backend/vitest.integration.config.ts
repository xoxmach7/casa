import { defineConfig } from 'vitest/config';
import { INTEGRATION_TEST_FILES } from './vitest.files';

// Integration + security suites. Kept out of the default `npm test` run so a
// missing server reads as "not run here", not as a red test suite — but they
// are mandatory in CI, where the workflow boots the server first.
export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 60000,
    include: INTEGRATION_TEST_FILES,
    exclude: ['dist/**', 'node_modules/**'],
    // These suites share one server and one dataset; parallel files would race
    // on the rate limiter and on the records they create.
    fileParallelism: false,
  },
});
