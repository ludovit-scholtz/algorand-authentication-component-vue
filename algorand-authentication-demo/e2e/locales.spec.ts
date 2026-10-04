/**
 * Localization tests. Languages = union of Biatec Wallet (af cs en es hu it nl ru sk tr) and
 * Biatec DEX (de en es hu it ko pl ru sk zh). Expected strings come straight from the catalogs,
 * so a missing or broken translation (or placeholder) fails here.
 */
import { expect, test } from '@playwright/test'
import {
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  format,
  messages,
  resolveLocale
} from '../../algorand-authentication-component-vue/src/i18n/messages'
import { demoMessages } from '../src/messages'
import {
  ARC76_EMAIL,
  ARC76_PASSWORD,
  arc76Account,
  mockAlgod,
  signInWithArc76,
  verifyArc60Signature
} from './fixtures'

const address = arc76Account(ARC76_EMAIL, ARC76_PASSWORD).addr.toString()
const MIN = 16

test('covers every language of Biatec Wallet and Biatec DEX', () => {
  const wallet = ['af', 'cs', 'en', 'es', 'hu', 'it', 'nl', 'ru', 'sk', 'tr']
  const dex = ['de', 'en', 'es', 'hu', 'it', 'ko', 'pl', 'ru', 'sk', 'zh']
  expect([...SUPPORTED_LOCALES].sort()).toEqual([...new Set([...wallet, ...dex])].sort())
})

test.describe('catalogs', () => {
  test('are complete and keep their placeholders', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    for (const catalog of [messages, demoMessages] as unknown as Record<
      string,
      Record<string, string>
    >[]) {
      const en = catalog.en
      for (const locale of SUPPORTED_LOCALES) {
        expect(Object.keys(catalog[locale]), locale).toEqual(Object.keys(en))
        for (const [key, value] of Object.entries(catalog[locale])) {
          expect(value.trim(), `${locale}.${key}`).not.toBe('')
          expect(placeholders(value), `${locale}.${key}`).toBe(placeholders(en[key]))
        }
      }
    }
  })

  test('resolve regional tags, lists and unknown languages', () => {
    expect(resolveLocale('de-AT')).toBe('de')
    expect(resolveLocale('zh-TW')).toBe('zh')
    expect(resolveLocale('KO_kr')).toBe('ko')
    expect(resolveLocale(['fr-FR', 'pl-PL'])).toBe('pl')
    expect(resolveLocale(['fr-FR', 'xx', 'en'])).toBe('en')
  })
})

for (const locale of SUPPORTED_LOCALES) {
  const m = messages[locale]
  const d = demoMessages[locale]

  test.describe(`locale ${locale} (${LOCALE_NAMES[locale]})`, () => {
    test.beforeEach(async ({ page }) => {
      await mockAlgod(page)
      await page.goto(`/?lang=${locale}&mode=protected`)
      await expect(page.getByTestId('aa-screen')).toBeVisible()
    })

    test('translates the sign-in screen', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await expect(page.getByTestId('aa-screen')).toHaveAttribute('lang', locale)
      await expect(page.getByTestId('aa-title')).toHaveText(m.signIn)
      await expect(page.getByText(m.subtitleSignIn)).toBeVisible()
      await expect(page.getByLabel(m.email, { exact: true })).toBeVisible()
      await expect(page.locator('#e')).toHaveAttribute('placeholder', m.emailPlaceholder)
      await expect(page.locator('#p')).toHaveAttribute('placeholder', m.passwordPlaceholder)
      await expect(page.getByRole('button', { name: m.continue, exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: m.register, exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: m.goBack, exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: m.orConnectWith })).toBeVisible()
      await expect(page.getByRole('button', { name: m.showPassword })).toBeVisible()
      await expect(
        page.getByRole('img', { name: format(m.walletLogo, { wallet: 'Biatec Wallet' }) })
      ).toBeVisible()
      // the demo page chrome and language picker
      await expect(page.getByTestId('lang-select')).toHaveValue(locale)
      await expect(
        page.locator('label').filter({ has: page.getByTestId('mode-select') })
      ).toContainText(d.mode)
      await expect(page.getByTestId('lang-select').locator('option:checked')).toHaveText(
        LOCALE_NAMES[locale]
      )
    })

    test('translates validation and registration', async ({ page }) => {
      await page.locator('#e').fill('nope')
      await page.locator('#p').fill('short')
      await expect(page.getByTestId('aa-form-error')).toHaveText(m.errEmailInvalid)
      await page.locator('#e').fill(ARC76_EMAIL)
      await expect(page.getByTestId('aa-form-error')).toHaveText(
        format(m.errPasswordLength, { min: MIN })
      )

      await page.getByRole('button', { name: m.register, exact: true }).click()
      await expect(page.getByTestId('aa-title')).toHaveText(m.registration)
      await expect(page.getByText(m.subtitleRegistration)).toBeVisible()
      await page.locator('#p').fill(ARC76_PASSWORD)
      await expect(page.getByTestId('aa-form-error')).toHaveText(m.errConfirmRequired)
      await expect(page.getByLabel(m.passwordConfirmation, { exact: true })).toBeVisible()
      await page.locator('#p2').fill('something-else-entirely-1')
      await expect(page.getByTestId('aa-form-error')).toHaveText(m.errPasswordsMismatch)
      await page.getByRole('button', { name: m.backToSignIn, exact: true }).click()
      await expect(page.getByTestId('aa-title')).toHaveText(m.signIn)
    })

    test('toggles the password with a translated control', async ({ page }) => {
      await page.getByRole('button', { name: m.showPassword }).click()
      await expect(page.locator('#p')).toHaveAttribute('type', 'text')
      await page.getByRole('button', { name: m.hidePassword }).click()
      await expect(page.locator('#p')).toHaveAttribute('type', 'password')
    })

    test('translates the signed-in demo, signing dialogs and errors', async ({ page }) => {
      await signInWithArc76(page)
      await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
      const authenticated = page.getByTestId('authenticated')
      await expect(page.getByRole('heading', { name: d.authTitle })).toBeVisible()
      await expect(page.getByTestId('welcome')).toContainText(d.welcomeBack)
      await expect(page.getByTestId('header-logout')).toHaveText(d.logout)
      for (const text of [m.email, d.account, d.walletProvider, d.headerLabel, d.logout]) {
        await expect(authenticated.getByText(text, { exact: true }).first()).toBeVisible()
      }
      await expect(page.getByRole('heading', { name: d.signTxTitle })).toBeVisible()
      await expect(page.getByText(d.signTxText)).toBeVisible()
      await expect(page.getByRole('heading', { name: d.signDataTitle })).toBeVisible()
      await expect(page.getByText(d.signDataText)).toBeVisible()
      await expect(
        page.locator('label').filter({ has: page.getByTestId('network-select') })
      ).toContainText(d.network)

      // --- transaction dialog -----------------------------------------------------------
      await page.getByTestId('sign').click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toHaveAttribute('aria-labelledby', 'aa-sign-title')
      await expect(page.locator('#aa-sign-title')).toHaveText(m.signOneTransaction)
      await expect(dialog).toContainText(
        format(m.signDialogSubtitle, { address: `${address.slice(0, 6)}…${address.slice(-6)}` })
      )
      await expect(dialog.getByRole('button', { name: m.cancel, exact: true })).toBeVisible()
      await dialog.locator('#aa-sign-password').fill('wrong-wrong-wrong-wrong-1')
      await dialog.getByRole('button', { name: m.continue, exact: true }).click()
      await expect(page.getByTestId('aa-sign-error')).toHaveText(m.errPasswordInvalid, {
        timeout: 30_000
      })
      await dialog.locator('#aa-sign-password').fill(ARC76_PASSWORD)
      await dialog.getByRole('button', { name: m.continue, exact: true }).click()
      await expect(dialog).toBeHidden({ timeout: 30_000 })
      await expect(page.getByTestId('toast-success')).toContainText(d.txSigned)
      await expect(page.getByText(d.signedTxLabel)).toBeVisible()

      // --- raw data dialog ----------------------------------------------------------------
      await expect(page.getByText(d.dataLabel)).toBeVisible()
      await page.getByRole('button', { name: m.signData, exact: true }).click()
      await expect(page.locator('#aa-sign-title')).toHaveText(m.signData)
      await dialog.getByRole('button', { name: m.cancel, exact: true }).click()
      await expect(
        page.getByTestId('toast-error').filter({ hasText: m.errCancelled })
      ).toBeVisible()

      await page.getByRole('button', { name: m.signData, exact: true }).click()
      await dialog.locator('#aa-sign-password').fill(ARC76_PASSWORD)
      await dialog.getByRole('button', { name: m.continue, exact: true }).click()
      await expect(page.getByTestId('data-valid')).toHaveText(d.valid, { timeout: 30_000 })
      for (const label of [d.signer, d.domain, d.signature, d.verified]) {
        await expect(
          page.getByTestId('data-result').getByText(label, { exact: true })
        ).toBeVisible()
      }
      expect(
        verifyArc60Signature({
          address,
          dataBase64: Buffer.from(await page.getByTestId('data-input').inputValue()).toString(
            'base64'
          ),
          domain: await page.getByTestId('data-domain').innerText(),
          signatureBase64: await page.getByTestId('data-signature').innerText()
        })
      ).toBe(true)

      // --- toggle + logout ----------------------------------------------------------------
      await expect(page.getByTestId('toggle-requirement')).toHaveText(d.disableReq)
      await page.getByTestId('toggle-requirement').click()
      await expect(page.getByTestId('toggle-requirement')).toHaveText(d.enableReq)
      await page.getByTestId('logout').click()
      await expect(page.getByRole('heading', { name: d.publicHeading })).toBeVisible()
      await expect(page.getByText(d.publicLead)).toBeVisible()
      await expect(page.getByRole('heading', { name: d.lockedTitle })).toBeVisible()
      await expect(page.getByText(d.lockedText)).toBeVisible()
      await expect(page.getByTestId('chip-guest')).toHaveText(d.guest)
      await expect(page.getByTestId('header-login')).toHaveText(d.login)
      await expect(page.getByTestId('login')).toHaveText(d.login)
      await expect(page.getByTestId('toggle-requirement')).toHaveText(d.requireAuth)
    })
  })
}

test.describe('language selection', () => {
  test.beforeEach(async ({ page }) => {
    await mockAlgod(page)
  })

  test('the picker switches language, updates the URL and is remembered', async ({ page }) => {
    await page.goto('/?lang=en&mode=protected')
    await expect(page.getByTestId('aa-title')).toHaveText(messages.en.signIn)
    await page.getByTestId('lang-select').selectOption('sk')
    await expect(page).toHaveURL(/lang=sk/)
    await expect(page.getByTestId('aa-title')).toHaveText(messages.sk.signIn)
    // remembered without the query parameter
    await page.goto('/?mode=protected')
    await expect(page.getByTestId('aa-title')).toHaveText(messages.sk.signIn)
    await expect(page.locator('html')).toHaveAttribute('lang', 'sk')
  })

  test('the query parameter beats the remembered language', async ({ page }) => {
    await page.goto('/?lang=de&mode=protected')
    await page.goto('/?lang=ko&mode=protected')
    await expect(page.getByTestId('aa-title')).toHaveText(messages.ko.signIn)
  })

  test('falls back to English for an unsupported language', async ({ page }) => {
    await page.goto('/?lang=fr&mode=protected')
    await expect(page.getByTestId('aa-title')).toHaveText(messages.en.signIn)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('long translations do not overflow the layout', async ({ page }) => {
    for (const locale of ['de', 'ru', 'hu', 'af']) {
      await page.goto(`/?lang=${locale}&mode=protected`)
      await expect(page.getByTestId('aa-screen')).toBeVisible()
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `${locale} @${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })
})

test.describe('browser language detection', () => {
  for (const locale of SUPPORTED_LOCALES) {
    test(`uses ${locale} when the browser asks for ${locale}`, async ({ browser }) => {
      const context = await browser.newContext({ locale: `${locale}-${locale.toUpperCase()}` })
      const page = await context.newPage()
      await mockAlgod(page)
      await page.goto('/?mode=protected')
      await expect(page.getByTestId('aa-title')).toHaveText(messages[locale].signIn)
      await expect(page.getByTestId('lang-select')).toHaveValue(locale)
      await context.close()
    })
  }

  test('uses English for an unsupported browser language', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' })
    const page = await context.newPage()
    await page.goto('/?mode=protected')
    await expect(page.getByTestId('aa-title')).toHaveText(messages.en.signIn)
    await context.close()
  })
})
