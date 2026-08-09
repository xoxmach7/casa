import { defineConfig } from 'vitest/config';
import { INTEGRATION_TEST_FILES } from './vitest.files';

// Default suite = unit/route tests only. They mock Prisma and never touch the
// network, so they run anywhere (dev laptop, CI, pre-commit) with no services.
// The integration + security suites talk to a real HTTP server and live DB —
// they live in vitest.integration.config.ts and run as a separate CI stage.
export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', ...INTEGRATION_TEST_FILES],
  },
});
