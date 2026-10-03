import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import algosdk from 'algosdk'
import {
  ARC76_EMAIL,
  ARC76_PASSWORD,
  arc76Account,
  decodeHeader,
  expectValidArc14Header,
  mockAlgod,
  signInWithArc76
} from './fixtures'

const REALM = 'Demo'
const account = arc76Account(ARC76_EMAIL, ARC76_PASSWORD)
const address = account.addr.toString()

test.beforeEach(async ({ page }) => {
  await mockAlgod(page)
  await page.goto('/')
  await expect(page.getByTestId('aa-screen')).toBeVisible()
})

test.describe('sign-in screen', () => {
  test('renders the email form and every configured wallet', async ({ page }) => {
    await expect(page.getByTestId('aa-title')).toHaveText('Sign in')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'Or connect with' })).toBeVisible()

    for (const id of ['biatec', 'pera', 'defly', 'kibisis', 'lute', 'mnemonic']) {
      const wallet = page.getByTestId(`aa-wallet-${id}`)
      await expect(wallet).toBeVisible()
      // every wallet ships an icon that actually loaded
      const icon = wallet.getByRole('img')
      await expect(icon).toBeVisible()
      expect(await icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    }
    await expect(page.getByTestId('aa-wallet-biatec')).toContainText('Biatec Wallet')
  })

  test('does not depend on PrimeVue / Tailwind classes shipped by the host', async ({ page }) => {
    const html = await page.locator('[data-testid="aa-screen"]').evaluate((el) => el.outerHTML)
    expect(html).not.toMatch(/\bp-(button|inputtext|password|message)\b/)
    const [left, right] = await page
      .locator('.aa-panel')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
    // two equal halves on desktop, stacked full-width on mobile
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
  })

  test('validates the form while typing', async ({ page }) => {
    const submit = page.getByRole('button', { name: 'Continue' })
    await page.locator('#e').fill('not-an-email')
    await page.locator('#p').fill('short')
    await expect(page.getByTestId('aa-form-error')).toHaveText('Email is not valid')
    await page.locator('#e').fill(ARC76_EMAIL)
    await expect(page.getByTestId('aa-form-error')).toContainText('at least 16 chars')
    await expect(submit).toBeDisabled()
    await page.locator('#p').fill(ARC76_PASSWORD)
    await expect(page.getByTestId('aa-form-error')).toHaveCount(0)
    await expect(submit).toBeEnabled()
  })

  test('can show and hide the password', async ({ page }) => {
    const password = page.locator('#p')
    await password.fill(ARC76_PASSWORD)
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Hide password' }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('registration asks for a matching password confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click()
    await expect(page.getByTestId('aa-title')).toHaveText('Registration')
    await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0)
    await page.locator('#e').fill(ARC76_EMAIL)
    await page.locator('#p').fill(ARC76_PASSWORD)
    await expect(page.getByTestId('aa-form-error')).toHaveText(
      'Please fill in the password confirmation field'
    )
    await page.locator('#p2').fill('something-else-entirely-1')
    await expect(page.getByTestId('aa-form-error')).toHaveText('Passwords do not match')
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await page.locator('#p2').fill(ARC76_PASSWORD)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    // the wallet column is hidden during registration
    await expect(page.getByTestId('aa-wallets')).toHaveCount(0)
    await page.getByRole('button', { name: 'Back to sign in' }).click()
    await expect(page.getByTestId('aa-title')).toHaveText('Sign in')
    await expect(page.getByTestId('aa-wallets')).toBeVisible()
  })

  test('has no automatically detectable accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('[data-testid="aa-screen"]')
      // text sits on a blurred photo; contrast is checked by hand against the solid panels
      .disableRules(['color-contrast'])
      .analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe('ARC-76 account', () => {
  test('signs in, exposes a valid ARC-14 header and logs out', async ({ page }) => {
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('auth-account')).toHaveText(address)
    await expect(page.getByTestId('auth-wallet')).toHaveText('arc76')
    await expect(page.getByTestId('auth-email')).toHaveText(ARC76_EMAIL)

    const header = await page.getByTestId('auth-header').inputValue()
    expectValidArc14Header(header, address, REALM)

    await page.getByTestId('logout').click()
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await expect(page.locator('#p')).toHaveValue('')
  })

  test('works with the keyboard (Enter submits the form)', async ({ page }) => {
    await page.locator('#e').fill(ARC76_EMAIL)
    await page.locator('#p').fill(ARC76_PASSWORD)
    await page.locator('#p').press('Enter')
    await expect(page.getByTestId('auth-account')).toHaveText(address, { timeout: 30_000 })
  })

  test('signs a transaction after re-entering the password', async ({ page }) => {
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })

    await page.getByTestId('sign').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Sign 1 transaction')
    // the page behind the dialog stays rendered
    await expect(page.getByTestId('authenticated')).toBeVisible()

    // a wrong password is rejected and the dialog stays open
    await dialog.locator('#aa-sign-password').fill('wrong-wrong-wrong-wrong-1')
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByTestId('aa-sign-error')).toHaveText('Password is invalid', {
      timeout: 30_000
    })
    await expect(dialog).toBeVisible()

    await dialog.locator('#aa-sign-password').fill(ARC76_PASSWORD)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog).toBeHidden({ timeout: 30_000 })

    const signed = decodeHeader(`SigTx ${await page.getByTestId('signed-tx').inputValue()}`)
    expect(signed.txn.sender.toString()).toBe(address)
    expect(signed.sig).toBeDefined()
    await expect(page.getByTestId('toast-success')).toHaveText(/Transaction signed/)
  })

  test('cancelling the password dialog rejects the signing request', async ({ page }) => {
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('sign').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByTestId('toast-error')).toHaveText(/Signing cancelled by user/)
    await expect(page.getByTestId('signed-tx')).toHaveCount(0)
    // the session survives a cancelled signature
    await expect(page.getByTestId('auth-account')).toHaveText(address)
  })

  test('closes the password dialog with Escape', async ({ page }) => {
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('sign').click()
    await page.getByRole('dialog').locator('#aa-sign-password').press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})

test.describe('optional authentication', () => {
  test('shows public content until the user asks to log in', async ({ page }) => {
    // turn the "authentication required" switch off from the authenticated page
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('toggle-requirement').click()
    await page.getByTestId('logout').click()

    await expect(page.getByTestId('unauthenticated')).toBeVisible()
    await expect(page.getByTestId('aa-screen')).toHaveCount(0)

    await page.getByTestId('login').click()
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await page.getByRole('button', { name: 'Go back' }).click()
    await expect(page.getByTestId('unauthenticated')).toBeVisible()
  })
})

test.describe('wallet sign-in (use-wallet 5 mnemonic adapter, testnet)', () => {
  const walletAccount = algosdk.generateAccount()
  const mnemonic = algosdk.secretKeyToMnemonic(walletAccount.sk)

  test.beforeEach(async ({ page }) => {
    await page.evaluate((m) => localStorage.setItem('e2e-mnemonic', m), mnemonic)
  })

  test('connects the wallet, signs ARC-14 with it and logs out', async ({ page }) => {
    await page.getByTestId('aa-wallet-mnemonic').click()
    await expect(page.getByTestId('authenticated')).toBeVisible()
    const walletAddress = walletAccount.addr.toString()
    await expect(page.getByTestId('auth-account')).toHaveText(walletAddress)
    await expect(page.getByTestId('auth-wallet')).toHaveText('mnemonic')
    expectValidArc14Header(await page.getByTestId('auth-header').inputValue(), walletAddress, REALM)

    // transaction signing goes through use-wallet, no password dialog
    await page.getByTestId('sign').click()
    await expect(page.getByTestId('signed-tx')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const signed = decodeHeader(`SigTx ${await page.getByTestId('signed-tx').inputValue()}`)
    expect(signed.txn.sender.toString()).toBe(walletAddress)

    await page.getByTestId('logout').click()
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    // the wallet was disconnected, so it is offered again instead of "Connected with ..."
    await expect(page.getByTestId('aa-session')).toHaveCount(0)
    await expect(page.getByTestId('aa-wallet-mnemonic')).toBeVisible()
  })

  test('shows the error when the wallet refuses to connect', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('e2e-mnemonic'))
    await page.getByTestId('aa-wallet-mnemonic').click()
    await expect(page.getByTestId('aa-wallet-error')).toBeVisible()
    await expect(page.getByTestId('toast-error')).toBeVisible()
    await expect(page.getByTestId('authenticated')).toHaveCount(0)
    // the screen is still usable
    await expect(page.getByTestId('aa-wallet-mnemonic')).toBeEnabled()
  })

  test('wallet list reacts to the selected network', async ({ page }) => {
    // the mnemonic adapter is testnet-only, so it disappears on mainnet
    await expect(page.getByTestId('aa-wallet-mnemonic')).toBeVisible()
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('network-select').selectOption('mainnet')
    await page.getByTestId('logout').click()
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await expect(page.getByTestId('aa-wallet-mnemonic')).toHaveCount(0)
    await expect(page.getByTestId('aa-wallet-biatec')).toBeVisible()
  })
})
