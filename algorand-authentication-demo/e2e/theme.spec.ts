/** Light / dark mode: follows the OS by default, can be forced, and reaches the component. */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockAlgod } from './fixtures'

test.beforeEach(async ({ page }) => {
  await mockAlgod(page)
})

const background = (page: import('@playwright/test').Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor)

const scheme = (page: Page) =>
  page.getByTestId('aa-screen').evaluate((el) => getComputedStyle(el).colorScheme)

test('follows the OS colour scheme by default (theme="auto")', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/?mode=protected')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('theme-select')).toHaveValue('system')
  // "System" leaves the component on auto: no forced attribute, the scheme comes from the host marker
  await expect(page.getByTestId('aa-screen')).not.toHaveAttribute('data-theme', /.+/)
  expect(await scheme(page)).toBe('dark')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await scheme(page)).toBe('light')
})

test('the host page marker beats the OS in auto mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/?mode=protected')
  expect(await scheme(page)).toBe('dark')
  // a host app that forces light on <html> although the OS is dark
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'))
  expect(await scheme(page)).toBe('light')
})

test('Light / Dark in the switcher win over the OS and are remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/?mode=protected')
  await page.getByTestId('theme-select').selectOption('light')
  await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', 'light')
  expect(await scheme(page)).toBe('light')

  await page.reload()
  await expect(page.getByTestId('theme-select')).toHaveValue('light')
  expect(await scheme(page)).toBe('light')

  await page.getByTestId('theme-select').selectOption('dark')
  await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', 'dark')
  expect(await scheme(page)).toBe('dark')
})

test('the public page is themed too', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/?mode=public')
  await expect(page.getByTestId('public-content')).toBeVisible()
  const light = await background(page, 'public-content')
  await page.getByTestId('theme-select').selectOption('dark')
  await expect.poll(() => background(page, 'public-content')).not.toBe(light)
})

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} colour contrast`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto('/?mode=protected')
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
      expect(await scheme(page)).toBe(colorScheme)
    })

    // The form card sits on a solid surface, so contrast is meaningful there (the wallet panel is
    // translucent over a photo and is reviewed by hand).
    const contrast = (page: Page) =>
      new AxeBuilder({ page }).include('.aa-card').withRules(['color-contrast']).analyze()

    test('sign-in card, with the button enabled and hovered', async ({ page }) => {
      await page.locator('#e').fill('user@example.com')
      await page.locator('#p').fill('a-very-long-password-123')
      const submit = page.locator('.aa-btn--primary')
      await expect(submit).toBeEnabled()
      await submit.hover()
      expect((await contrast(page)).violations).toEqual([])
    })

    test('registration card', async ({ page }) => {
      await page.getByRole('button', { name: 'Register' }).click()
      await expect(page.locator('#p2')).toBeVisible()
      expect((await contrast(page)).violations).toEqual([])
    })

    test('form error alert', async ({ page }) => {
      await page.locator('#e').fill('not-an-email')
      await page.locator('#p').fill('x')
      await expect(page.getByTestId('aa-form-error')).toBeVisible()
      expect((await contrast(page)).violations).toEqual([])
    })
  })
}
