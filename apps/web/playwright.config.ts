import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  // Starts the Vite dev server when none is running (CI); reuses an existing one locally.
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
