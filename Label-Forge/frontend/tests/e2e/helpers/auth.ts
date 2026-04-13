import { Page } from "@playwright/test"

export const TEST_EMAIL = process.env.TEST_EMAIL || "test@labelforge.dev"
export const TEST_PASSWORD = process.env.TEST_PASSWORD || "testpassword123"

export async function loginWithEmail(page: Page) {
  await page.goto("/")

  // wait for login page to appear
  await page.waitForSelector('[data-testid="login-page"]',
    { timeout: 10000 })

  // click email/password tab if needed
  const emailTab = page.locator('[data-testid="email-signin-tab"]')
  if (await emailTab.isVisible()) {
    await emailTab.click()
  }

  await page.fill('[data-testid="email-input"]', TEST_EMAIL)
  await page.fill('[data-testid="password-input"]', TEST_PASSWORD)
  await page.click('[data-testid="signin-button"]')

  // wait for dashboard to appear after login
  await page.waitForSelector('[data-testid="dashboard"]',
    { timeout: 15000 })
}

export async function logout(page: Page) {
  const signOutBtn = page.locator('[data-testid="signout-button"]')
  if (await signOutBtn.isVisible()) {
    await signOutBtn.click()
    await page.waitForSelector('[data-testid="login-page"]')
  }
}