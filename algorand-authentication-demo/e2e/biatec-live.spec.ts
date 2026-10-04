/**
 * End-to-end tests against the real Biatec Wallet (https://wallet.biatec.io).
 *
 * Each test creates a throw-away browser wallet on wallet.biatec.io, pairs it with the demo
 * through WalletConnect v2 (the URI shown by biatec-wallet-use-wallet-client's built-in dialog is
 * pasted into the wallet's "Connect App" page) and then approves the requests the demo makes:
 *
 *   demo (use-wallet 5 + biatec adapter)  <-- WalletConnect relay -->  wallet.biatec.io
 *
 * Needs internet access (wallet.biatec.io, the WalletConnect relay and an algod node). Run with
 * `pnpm test:e2e:live`.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { expectValidArc14Header } from './fixtures'
import { decodeHeader, verifyArc60Signature } from './fixtures'
import { SUPPORTED_LOCALES } from '../../algorand-authentication-component-vue/src/i18n/messages'

const WALLET_URL = 'https://wallet.biatec.io/'
const REALM = 'Demo'
const BASE_URL = 'http://localhost:4173'
/**
 * The demo is served to the browser as https://demo.biatec-e2e.test (a Playwright route proxies it
 * to the local preview server). use-wallet signs ARC-60 data for `location.host`, and Biatec
 * Wallet checks it against the dApp's origin, which only matches for a port-less host.
 */
const DAPP_ORIGIN = 'https://demo.biatec-e2e.test'

test.use({ locale: 'en-US' })

interface BiatecWallet {
  page: Page
  /** Algorand address of the freshly created wallet account. */
  address: string
}

/** Creates a new wallet on wallet.biatec.io and opens its WalletConnect v2 "Connect App" tab. */
async function createBiatecWallet(context: BrowserContext): Promise<BiatecWallet> {
  const page = await context.newPage()
  await page.goto(WALLET_URL)
  await page.locator('#newwallet-name').fill('Playwright E2E')
  await page.locator('#newwallet-pass').fill('E2e-test-password-123!')
  await page.getByRole('button', { name: 'Create wallet' }).click()
  await page.waitForURL(/\/account\/[A-Z2-7]{58}$/)
  const address = page.url().split('/').pop()!

  await page.getByRole('link', { name: 'Connect App' }).click()
  await page.getByText('WalletConnect v2', { exact: true }).click()
  await page.getByRole('button', { name: 'Initialize connection to Wallet Connect' }).click()
  await expect(page.locator('#uri')).toBeVisible()
  return { page, address }
}

/** Opens Biatec's built-in dialog from the demo and returns the WalletConnect pairing URI. */
async function openBiatecDialog(dapp: Page): Promise<string> {
  await dapp.getByTestId('aa-wallet-biatec').click()
  const uri = dapp.locator('input[value^="wc:"]')
  await expect(uri).toBeVisible({ timeout: 30_000 })
  return (await uri.inputValue())!
}

async function approveSessionProposal(wallet: Page, uri: string) {
  await wallet.bringToFront()
  await wallet.locator('#uri').fill(uri)
  await wallet.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(wallet.getByText('Session proposals')).toBeVisible({ timeout: 30_000 })
  await expect(wallet.getByText('Algorand Authentication Demo')).toBeVisible()
  await wallet.getByRole('button', { name: 'Connect', exact: true }).click()
}

/**
 * Waits for a signing request from the demo. wallet.biatec.io lists every transaction of a
 * request as a button (labelled with the ARC-14 realm for authentication requests); signing it
 * enables "Send back to DApp".
 */
async function nextSignRequest(wallet: Page, method = 'algo_signTxn') {
  await wallet.bringToFront()
  const row = wallet.getByRole('row').filter({ hasText: method })
  await expect(row).toBeVisible({ timeout: 60_000 })
  const signButton = row
    .getByRole('button')
    .filter({ hasText: /\w/ })
    .filter({ hasNotText: /Send back to DApp|Reject/ })
    .first()
  const send = row.getByRole('button', { name: 'Send back to DApp' })
  return {
    title: signButton,
    approve: async () => {
      await signButton.click()
      await expect(send).toBeEnabled()
      await send.click()
    },
    reject: () => row.getByRole('button', { name: 'Reject', exact: true }).click()
  }
}

test.describe('Biatec Wallet', () => {
  let dapp: Page

  test.beforeEach(async ({ context }) => {
    await context.route(`${DAPP_ORIGIN}/**`, async (route) => {
      const url = route.request().url().replace(DAPP_ORIGIN, BASE_URL)
      await route.fulfill({ response: await route.fetch({ url }) })
    })
    dapp = await context.newPage()
    await dapp.goto(`${DAPP_ORIGIN}/?mode=protected`)
    await expect(dapp.getByTestId('aa-screen')).toBeVisible()
  })

  test('is listed with its logo and opens the connect dialog with a WalletConnect URI', async () => {
    const biatec = dapp.getByTestId('aa-wallet-biatec')
    await expect(biatec).toContainText('Biatec Wallet')
    await expect(biatec.getByRole('img')).toBeVisible()

    const uri = await openBiatecDialog(dapp)
    expect(uri).toMatch(/^wc:[0-9a-f]{64}@2\?/)
    // both transports offered by biatec-wallet-use-wallet-client are selectable
    await expect(dapp.getByText('WalletConnect', { exact: true }).first()).toBeVisible()
    await expect(dapp.getByText('Liquid Auth', { exact: true })).toBeVisible()
  })

  test('signs in with ARC-14, signs a transaction and logs out via wallet.biatec.io', async ({
    context
  }) => {
    const wallet = await createBiatecWallet(context)

    // --- connect + ARC-14 authentication ---------------------------------------------------
    const uri = await openBiatecDialog(dapp)
    await approveSessionProposal(wallet.page, uri)

    const authRequest = await nextSignRequest(wallet.page)
    // the wallet shows the realm the demo asked the user to authenticate to
    await expect(authRequest.title).toHaveText(`Authenticate to ${REALM}`)
    await authRequest.approve()

    await dapp.bringToFront()
    await expect(dapp.getByTestId('authenticated')).toBeVisible({ timeout: 60_000 })
    await expect(dapp.getByTestId('auth-wallet')).toHaveText('biatec')
    await expect(dapp.getByTestId('auth-account')).toHaveText(wallet.address)
    expectValidArc14Header(
      await dapp.getByTestId('auth-header').inputValue(),
      wallet.address,
      REALM
    )

    // --- transaction signing through use-wallet ----------------------------------------------
    await dapp.getByTestId('sign').click()
    const signRequest = await nextSignRequest(wallet.page)
    await signRequest.approve()
    await dapp.bringToFront()
    await expect(dapp.getByTestId('signed-tx')).toBeVisible({ timeout: 60_000 })
    const signed = decodeHeader(`SigTx ${await dapp.getByTestId('signed-tx').inputValue()}`)
    expect(signed.txn.sender.toString()).toBe(wallet.address)
    expect(signed.sig).toBeDefined()
    // no ARC-76 password dialog is involved for wallet accounts
    await expect(dapp.getByRole('dialog')).toHaveCount(0)

    // --- ARC-60 raw data signing through use-wallet's signData ----------------------------------
    const text = 'Hello Biatec Wallet'
    await dapp.getByTestId('data-input').fill(text)
    await dapp.getByTestId('sign-data').click()
    const dataRequest = await nextSignRequest(wallet.page, 'algo_signData')
    await dataRequest.approve()
    await dapp.bringToFront()
    await expect(dapp.getByTestId('data-result')).toBeVisible({ timeout: 60_000 })
    await expect(dapp.getByTestId('data-signer')).toHaveText(wallet.address)
    await expect(dapp.getByTestId('data-valid')).toHaveText('valid ✓')
    expect(
      verifyArc60Signature({
        address: wallet.address,
        dataBase64: Buffer.from(text).toString('base64'),
        domain: await dapp.getByTestId('data-domain').innerText(),
        signatureBase64: await dapp.getByTestId('data-signature').innerText()
      })
    ).toBe(true)

    // --- logout disconnects the WalletConnect session -----------------------------------------
    await wallet.page.bringToFront()
    await expect(wallet.page.getByRole('button', { name: 'Disconnect' })).toBeVisible()
    await dapp.bringToFront()
    await dapp.getByTestId('logout').click()
    await expect(dapp.getByTestId('aa-screen')).toBeVisible()
    await wallet.page.bringToFront()
    await expect(wallet.page.getByRole('button', { name: 'Disconnect' })).toHaveCount(0, {
      timeout: 30_000
    })
  })

  test('stays on the sign-in screen when the user rejects the ARC-14 request in the wallet', async ({
    context
  }) => {
    const wallet = await createBiatecWallet(context)
    const uri = await openBiatecDialog(dapp)
    await approveSessionProposal(wallet.page, uri)

    const authRequest = await nextSignRequest(wallet.page)
    await authRequest.reject()

    await dapp.bringToFront()
    await expect(dapp.getByTestId('aa-wallet-error')).toBeVisible({ timeout: 60_000 })
    await expect(dapp.getByTestId('toast-error')).toBeVisible()
    await expect(dapp.getByTestId('authenticated')).toHaveCount(0)
    await expect(dapp.getByTestId('aa-screen')).toBeVisible()
  })
})

/**
 * Biatec's built-in connect dialog is localized by biatec-wallet-use-wallet-client (10 languages).
 * The demo passes its selected language; the four Biatec DEX languages the dialog does not ship yet
 * (de, ko, pl, zh) fall back to English while the rest of the demo is still translated.
 */
const DIALOG_TITLES: Record<string, string> = {
  af: 'Koppel Biatec Wallet',
  cs: 'Připojit Biatec Wallet',
  en: 'Connect Biatec Wallet',
  es: 'Conectar Biatec Wallet',
  hu: 'Biatec Wallet csatlakoztatása',
  it: 'Connetti Biatec Wallet',
  nl: 'Biatec Wallet verbinden',
  ru: 'Подключить Biatec Wallet',
  sk: 'Pripojiť Biatec Wallet',
  tr: "Biatec Wallet'ı bağla"
}

test.describe('Biatec connect dialog language', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const title = DIALOG_TITLES[locale] ?? DIALOG_TITLES.en
    const note = locale in DIALOG_TITLES ? '' : ' (falls back to English)'

    test(`${locale}${note}`, async ({ context }) => {
      await context.route(`${DAPP_ORIGIN}/**`, async (route) => {
        const url = route.request().url().replace(DAPP_ORIGIN, BASE_URL)
        await route.fulfill({ response: await route.fetch({ url }) })
      })
      const page = await context.newPage()
      await page.goto(`${DAPP_ORIGIN}/?lang=${locale}&mode=protected`)
      // the component's own wallet button is translated, the wallet name is not
      await expect(page.getByTestId('aa-wallet-biatec')).toContainText('Biatec Wallet')
      await openBiatecDialog(page)
      await expect(page.getByText(title, { exact: true })).toBeVisible()
      // the dialog offers its own language switcher with the flags of every supported language
      await expect(page.locator('.bcd-locale')).toHaveCount(Object.keys(DIALOG_TITLES).length)
      await expect(page.locator('.bcd-locale--active')).toHaveAttribute(
        'data-locale',
        locale in DIALOG_TITLES ? locale : 'en'
      )
    })
  }
})
