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
  test.describe(`${scheme} colour contrast`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/?mode=protected')
      await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', scheme)
    })

    // The form card sits on a solid surface, so contrast is meaningful there (the wallet panel is
    // translucent over a photo and is reviewed by hand).
    const contrast = (page: import('@playwright/test').Page) =>
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

test('theme="light" / "dark" win over the OS, and auto follows a host marker', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/?mode=protected&theme=light')
  // forced light (the demo passes the resolved theme) although the OS is dark
  await expect(page.getByTestId('aa-screen')).toHaveAttribute('data-theme', 'light')
  const scheme = () =>
    page.getByTestId('aa-screen').evaluate((el) => getComputedStyle(el).colorScheme)
  expect(await scheme()).toBe('light')

  // theme="auto" (no attribute) under a host marker: dark ancestor beats a light OS
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByTestId('aa-screen').evaluate((el) => {
    el.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme') // the demo's own marker
    document.body.classList.add('dark')
  })
  expect(await scheme()).toBe('dark')
  await page.evaluate(() => {
    document.body.classList.replace('dark', 'light')
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await scheme()).toBe('light')
})
