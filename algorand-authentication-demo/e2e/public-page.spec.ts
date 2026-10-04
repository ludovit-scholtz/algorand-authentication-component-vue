/**
 * The two ways to use the component: a protected app (`authorizedOnlyAccess`) and a public page with
 * a Login button whose content changes once the user is authenticated (`?mode=public`).
 */
import { expect, test } from '@playwright/test'
import { demoMessages } from '../src/messages'
import {
  ARC76_EMAIL,
  ARC76_PASSWORD,
  arc76Account,
  expectValidArc14Header,
  mockAlgod,
  signInWithArc76
} from './fixtures'

const d = demoMessages.en
const address = arc76Account(ARC76_EMAIL, ARC76_PASSWORD).addr.toString()

test.beforeEach(async ({ page }) => {
  await mockAlgod(page)
})

test.describe('public page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?mode=public')
    await expect(page.getByTestId('unauthenticated')).toBeVisible()
  })

  test('is readable by guests without a sign-in screen', async ({ page }) => {
    await expect(page.getByTestId('aa-screen')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: d.publicHeading })).toBeVisible()
    await expect(page.getByText(d.publicLead)).toBeVisible()
    await expect(page.getByTestId('chip-guest')).toHaveText(d.guest)
    await expect(page.getByTestId('locked-area')).toContainText(d.lockedTitle)
    // nothing from the members area leaks to guests
    await expect(page.getByTestId('authenticated')).toHaveCount(0)
    await expect(page.getByTestId('auth-header')).toHaveCount(0)
    await expect(page.getByTestId('sign')).toHaveCount(0)
    await expect(page.getByTestId('mode-select')).toHaveValue('public')
  })

  test('the Login buttons open the sign-in screen and Go back returns to the page', async ({
    page
  }) => {
    for (const button of ['header-login', 'login']) {
      await page.getByTestId(button).click()
      await expect(page.getByTestId('aa-screen')).toBeVisible()
      await page.getByRole('button', { name: 'Go back' }).click()
      await expect(page.getByTestId('aa-screen')).toHaveCount(0)
      await expect(page.getByTestId('unauthenticated')).toBeVisible()
    }
  })

  test('the content changes after signing in and again after logging out', async ({ page }) => {
    await page.getByTestId('login').click()
    await signInWithArc76(page)

    // the sign-in screen closes by itself and the page switches to the member view
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('aa-screen')).toHaveCount(0)
    await expect(page.getByTestId('unauthenticated')).toHaveCount(0)
    await expect(page.getByTestId('locked-area')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: d.publicHeading })).toHaveCount(0)
    await expect(page.getByTestId('welcome')).toContainText(d.welcomeBack)
    await expect(page.getByTestId('chip-account')).toHaveAttribute('title', address)
    await expect(page.getByTestId('chip-guest')).toHaveCount(0)
    await expect(page.getByTestId('auth-account')).toHaveText(address)
    expectValidArc14Header(await page.getByTestId('auth-header').inputValue(), address, 'Demo')
    await expect(page.getByTestId('mode-select')).toHaveValue('public')

    await page.getByTestId('header-logout').click()
    await expect(page.getByTestId('unauthenticated')).toBeVisible()
    await expect(page.getByTestId('authenticated')).toHaveCount(0)
    await expect(page.getByTestId('chip-guest')).toBeVisible()
    await expect(page.getByTestId('locked-area')).toBeVisible()
    await expect(page.getByTestId('aa-screen')).toHaveCount(0)
  })

  test('switching to protected mode shows the sign-in screen and back', async ({ page }) => {
    await page.getByTestId('mode-select').selectOption('protected')
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await expect(page).toHaveURL(/mode=protected/)
    await page.getByTestId('mode-select').selectOption('public')
    await expect(page.getByTestId('unauthenticated')).toBeVisible()
    await expect(page).toHaveURL(/mode=public/)
  })

  test('the Require authentication button switches to protected mode', async ({ page }) => {
    await page.getByTestId('toggle-requirement').click()
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await expect(page.getByTestId('mode-select')).toHaveValue('protected')
  })

  test('works together with another language', async ({ page }) => {
    await page.goto('/?mode=public&lang=sk')
    await expect(page.getByRole('heading', { name: demoMessages.sk.publicHeading })).toBeVisible()
    await expect(page.getByTestId('header-login')).toHaveText(demoMessages.sk.login)
    await page.getByTestId('header-login').click()
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await expect(page.getByTestId('aa-screen')).toHaveAttribute('lang', 'sk')
  })
})

test('has no horizontal overflow on a phone, as guest or signed in', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await page.goto('/?mode=public')
  await expect(page.getByTestId('unauthenticated')).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByTestId('login').click()
  await signInWithArc76(page)
  await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
  expect(await overflow()).toBeLessThanOrEqual(0)
})

test('the demo starts on the public page for guests', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('unauthenticated')).toBeVisible()
  await expect(page.getByTestId('aa-screen')).toHaveCount(0)
  await expect(page.getByTestId('mode-select')).toHaveValue('public')
  await expect(page.getByTestId('chip-guest')).toBeVisible()
  await expect(page.getByTestId('header-login')).toBeVisible()
  await expect(page.getByRole('heading', { name: d.publicHeading })).toBeVisible()
  await expect(page.getByTestId('locked-area')).toBeVisible()
})

test.describe('protected app (?mode=protected)', () => {
  test('shows only the sign-in screen until the user signs in', async ({ page }) => {
    await page.goto('/?mode=protected')
    await expect(page.getByTestId('aa-screen')).toBeVisible()
    await expect(page.getByTestId('mode-select')).toHaveValue('protected')
    await expect(page.getByTestId('unauthenticated')).toHaveCount(0)
    // the page content is not rendered at all behind the sign-in screen
    await expect(page.getByTestId('chip-guest')).toHaveCount(0)
    await signInWithArc76(page)
    await expect(page.getByTestId('authenticated')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('aa-screen')).toHaveCount(0)
  })
})
