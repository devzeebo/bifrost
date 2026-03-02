import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    headless: true,
    launchOptions: {
      executablePath: '/home/blake/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
    },
  },
  projects: ['Bifrost UI'],
});
