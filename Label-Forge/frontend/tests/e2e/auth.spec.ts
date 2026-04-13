import { test, expect } from "@playwright/test"
import { loginWithEmail, logout, TEST_EMAIL } from "./helpers/auth"

test.describe("Authentication", () => {

  test("shows login page when not authenticated", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator('[data-testid="login-page"]'))
      .toBeVisible({ timeout: 10000 })
  })

  test("login with email and password", async ({ page }) => {
    await loginWithEmail(page)
    await expect(page.locator('[data-testid="dashboard"]'))
      .toBeVisible()
  })

  test("shows user email after login", async ({ page }) => {
    await loginWithEmail(page)
    await expect(page.locator('[data-testid="user-email"]'))
      .toContainText(TEST_EMAIL)
  })

  test("sign out returns to login page", async ({ page }) => {
    await loginWithEmail(page)
    await logout(page)
    await expect(page.locator('[data-testid="login-page"]'))
      .toBeVisible()
  })

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector('[data-testid="login-page"]')
    await page.fill('[data-testid="email-input"]', TEST_EMAIL)
    await page.fill('[data-testid="password-input"]', "wrongpassword")
    await page.click('[data-testid="signin-button"]')
    await expect(page.locator('[data-testid="auth-error"]'))
      .toBeVisible({ timeout: 5000 })
  })

  test("cannot access dashboard without login", async ({ page }) => {
    await page.goto("/wizard/setup")
    // should redirect to login
    await expect(page.locator('[data-testid="login-page"]'))
      .toBeVisible({ timeout: 10000 })
  })
})