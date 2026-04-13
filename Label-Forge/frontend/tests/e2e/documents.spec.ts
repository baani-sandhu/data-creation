import { test, expect } from "@playwright/test"
import { loginWithEmail } from "./helpers/auth"
import path from "path"

test.describe("Document Library", () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmail(page)
  })

  test("documents section visible on dashboard", async ({ page }) => {
    await expect(page.locator('[data-testid="documents-section"]'))
      .toBeVisible()
  })

  test("uploaded document appears in documents gallery", async ({ page }) => {
    // create a job with a file upload to trigger document save
    await page.click('[data-testid="new-job-button"]')
    await page.waitForSelector('[data-testid="step1-setup"]')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/sample.txt")
    )

    await page.fill('[data-testid="field-input"]', "input")
    await page.click('[data-testid="add-field-button"]')
    await page.fill('[data-testid="field-input"]', "output")
    await page.click('[data-testid="add-field-button"]')
    await page.fill('[data-testid="task-prompt-input"]', "Extract pairs")
    await page.click('[data-testid="next-button"]')

    // wait for chunking to complete
    await page.waitForSelector('[data-testid="chunk-list"]',
      { timeout: 30000 })

    // go back to dashboard
    await page.click('[data-testid="back-to-dashboard"]')

    // check documents section
    await expect(page.locator('[data-testid="documents-section"]'))
      .toContainText("sample.txt")
  })
})