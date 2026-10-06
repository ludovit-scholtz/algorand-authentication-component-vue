/** Light / dark mode: follows the OS by default, can be forced, and reaches the component. */
import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockAlgod } from './fixtures'

test.beforeEach(async ({ page }) => {
  await mockAlgod(page)
})

const background = (page: import('@playwright/test').Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor)

test('follows the OS colour scheme by default', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/?mode=protected')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('theme-select')).toHaveValue('system')

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', 'light')
})

test('the switcher overrides the OS and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/?mode=protected')
  const card = page.locator('.aa-card').first()
  const light = await card.evaluate((el) => getComputedStyle(el).backgroundColor)

  await page.getByTestId('theme-select').selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const dark = await card.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(dark).not.toBe(light)

  await page.reload()
  await expect(page.getByTestId('theme-select')).toHaveValue('dark')
  await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', 'dark')
})

test('the public page is themed too', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/?mode=public')
  await expect(page.getByTestId('public-content')).toBeVisible()
  const light = await background(page, 'public-content')
  await page.getByTestId('theme-select').selectOption('dark')
  await expect.poll(() => background(page, 'public-content')).not.toBe(light)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} sign-in screen has no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/?mode=protected')
    await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', scheme)
    const results = await new AxeBuilder({ page })
      .include('.aa-card')
      // the form card sits on a solid surface, so contrast is meaningful here
      .withRules(['color-contrast'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}
