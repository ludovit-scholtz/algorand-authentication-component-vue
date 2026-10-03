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
import { decodeHeader } from './fixtures'

const WALLET_URL = 'https://wallet.biatec.io/'
const REALM = 'Demo'

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
async function nextSignRequest(wallet: Page) {
  await wallet.bringToFront()
  const row = wallet.getByRole('row').filter({ hasText: 'algo_signTxn' })
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
    dapp = await context.newPage()
    await dapp.goto('/')
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
