import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.NEXT_CARD_E2E_PORT ?? 3110);
const baseURL = `http://127.0.0.1:${e2ePort}`;
const skipWebServer = process.env.NEXT_CARD_E2E_SKIP_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: [["list"]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] }
    }
  ],
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: `pnpm dev --hostname 127.0.0.1 --port ${e2ePort}`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: baseURL
        }
      })
});
