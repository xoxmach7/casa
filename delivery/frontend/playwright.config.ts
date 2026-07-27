import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1, // Sequential for video clarity
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    video: 'on', // Record video for every test
    screenshot: 'on', // Screenshot on failure
    trace: 'on-first-retry',
    viewport: { width: 1920, height: 1080 },
  },
  outputDir: './test-videos',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
