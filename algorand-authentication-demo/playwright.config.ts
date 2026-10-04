import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /biatec-live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile',
      testMatch: /component\.spec\.ts/,
      use: { ...devices['Pixel 7'] }
    },
    {
      // Talks to the real https://wallet.biatec.io and the public relay / algod nodes.
      name: 'biatec-live',
      // sequential: many parallel pairing requests get throttled by the public WalletConnect relay
      fullyParallel: false,
      testMatch: /biatec-live\.spec\.ts/,
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    // Production build with the testnet-only mnemonic adapter enabled for the wallet sign-in tests
    command: 'pnpm build-only && pnpm preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_E2E_MNEMONIC_WALLET: 'true' }
  }
})
