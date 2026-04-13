import { test, expect } from "@playwright/test"
import { loginWithEmail } from "./helpers/auth"
import path from "path"

test.describe("Step 1 - Setup", () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmail(page)
    await page.click('[data-testid="new-job-button"]')
    await page.waitForSelector('[data-testid="step1-setup"]')
  })

  test("shows all setup sections", async ({ page }) => {
    await expect(page.locator('[data-testid="upload-section"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="task-prompt-section"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="fields-section"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="export-config-section"]'))
      .toBeVisible()
  })

  test("next button disabled without files and fields", async ({ page }) => {
    await expect(page.locator('[data-testid="next-button"]'))
      .toBeDisabled()
  })

  test("can upload a file", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(
      path.join(__dirname, "../fixtures/sample.txt")
    )
    await expect(page.locator('[data-testid="file-list"]'))
      .toBeVisible()
    await expect(page.locator('[data-testid="file-list"]'))
      .toContainText("sample.txt")
  })

  test("can add fields", async ({ page }) => {
    await page.fill('[data-testid="field-input"]', "input")
    await page.click('[data-testid="add-field-button"]')
    await page.fill('[data-testid="field-input"]', "output")
    await page.click('[data-testid="add-field-button"]')
    await expect(page.locator('[data-testid="fields-list"]'))
      .toContainText("input")
    await expect(page.locator('[data-testid="fields-list"]'))
      .toContainText("output")
  })

  test("cannot add more than 7 fields", async ({ page }) => {
    for (let i = 1; i <= 7; i++) {
      await page.fill('[data-testid="field-input"]', `field${i}`)
      await page.click('[data-testid="add-field-button"]')
    }
    await expect(page.locator('[data-testid="add-field-button"]'))
      .toBeDisabled()
  })

  test("refine prompt button calls API", async ({ page }) => {
    await page.fill('[data-testid="task-prompt-input"]',
      "extract questions from documents")

    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes("/prompts/refine")),
      page.click('[data-testid="refine-prompt-button"]')
    ])

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.refined_prompt).toBeTruthy()
  })

  test("upload source selector tabs work", async ({ page }) => {
    await page.click('[data-testid="tab-saved-documents"]')
    await expect(page.locator('[data-testid="upload-section"]'))
      .not.toBeVisible()
    await expect(page.locator('[data-testid="saved-docs-list"]'))
      .toBeVisible()

    await page.click('[data-testid="tab-upload-new"]')
    await expect(page.locator('[data-testid="upload-section"]'))
      .toBeVisible()
  })
})