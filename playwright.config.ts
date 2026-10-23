import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: a real browser drives the real app, which talks to a mock Moodle
// (e2e/mock-moodle.mjs), so the tests are repeatable and never touch your real Moodle.
//
//   npm run test:e2e          run everything (builds the app first)
//   npm run test:e2e:ui       Playwright's UI: pick tests, watch them run, time-travel through steps
const APP_PORT = 3100;
const MOODLE_PORT = 8099;
const AI_PORT = 8100;
const ANTHROPIC_PORT = 8101;

export default defineConfig({
  testDir: './e2e',
  // One shared mock Moodle, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    // Skip animations (globals.css honours prefers-reduced-motion), so checks like
    // colour contrast always see the final colours, not a fade halfway through.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Only needed where Playwright's own browser can't be downloaded.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'node e2e/mock-moodle.mjs',
      url: `http://localhost:${MOODLE_PORT}/__reset`,
      env: { MOCK_MOODLE_PORT: String(MOODLE_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/mock-ai.mjs',
      url: `http://localhost:${AI_PORT}/__reset`,
      env: { MOCK_AI_PORT: String(AI_PORT), MOCK_AI_TOKEN: 'e2e-ai-token' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node e2e/mock-anthropic.mjs',
      url: `http://localhost:${ANTHROPIC_PORT}/__reset`,
      env: { MOCK_ANTHROPIC_PORT: String(ANTHROPIC_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      // A production build: closest to what users get, and it doesn't clash with `npm run dev`.
      command: `npm run build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        MOODLE_URL: `http://localhost:${MOODLE_PORT}`,
        MOODLE_SERVICE: 'moodle_mobile_app',
        SESSION_SECRET: 'e2e-tests-only-not-a-real-secret-0123456789',
        AI_SERVICE_URL: `http://localhost:${AI_PORT}`,
        AI_SERVICE_TOKEN: 'e2e-ai-token',
        ANTHROPIC_API_KEY: 'e2e-not-a-real-key',
        ANTHROPIC_BASE_URL: `http://localhost:${ANTHROPIC_PORT}`,
      },
    },
  ],
});
