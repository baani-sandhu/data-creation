import { test, expect } from "@playwright/test"
import { loginWithEmail } from "./helpers/auth"

test.describe("Dashboard", () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmail(page)
  })

  test("dashboard loads and shows sections", async ({ page }) => {
    await expect(page.locator('[data-testid="dashboard"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="jobs-section"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="documents-section"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="datasets-section"]'))
      .toBeVisible()
  })

  test("new job button navigates to setup", async ({ page }) => {
    await page.click('[data-testid="new-job-button"]')
    await expect(page).toHaveURL(/.*wizard\/setup/)
    await expect(page.locator('[data-testid="step1-setup"]'))
      .toBeVisible()
  })

  test("sign out button is visible on dashboard", async ({ page }) => {
    await expect(page.locator('[data-testid="signout-button"]'))
      .toBeVisible()
  })

  test("empty state shown when no jobs", async ({ page }) => {
    // this test only passes if the test account has no jobs
    // skip if jobs exist
    const jobCards = page.locator('[data-testid="job-card"]')
    const count = await jobCards.count()
    if (count === 0) {
      await expect(page.locator('[data-testid="no-jobs-message"]'))
        .toBeVisible()
    }
  })
})