import { defineConfig, devices } from '@playwright/test';

const galleryUrl = 'http://127.0.0.1:4174/playwright/gallery/index.html';

export default defineConfig({
  testDir: './playwright/tests',
  outputDir: './test-results/playwright',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    [process.env.CI ? 'line' : 'list'],
    ['./playwright/reporters/summaryReporter.ts'],
  ],
  projects: [{
    name: 'components',
    use: {
      ...devices['Desktop Chrome'],
      baseURL: galleryUrl,
      serviceWorkers: 'block',
      reuseContext: true,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
  }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: galleryUrl,
    reuseExistingServer: !process.env.CI,
  },
});
