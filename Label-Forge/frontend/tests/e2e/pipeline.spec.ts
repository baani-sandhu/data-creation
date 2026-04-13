import { test, expect } from "@playwright/test"
import { loginWithEmail } from "./helpers/auth"
import path from "path"

test.describe("Pipeline - Full Flow", () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmail(page)
  })

  test("complete pipeline: upload ? chunk ? annotate ? generate ? export",
    async ({ page }) => {
      // Step 1: Setup
      await page.click('[data-testid="new-job-button"]')
      await page.waitForSelector('[data-testid="step1-setup"]')

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles(
        path.join(__dirname, "../fixtures/sample.txt")
      )

      await page.fill('[data-testid="field-input"]', "question")
      await page.click('[data-testid="add-field-button"]')
      await page.fill('[data-testid="field-input"]', "answer")
      await page.click('[data-testid="add-field-button"]')

      await page.fill('[data-testid="task-prompt-input"]',
        "Extract question and answer pairs")

      await page.click('[data-testid="next-button"]')

      // Step 2: Wait for chunking
      await page.waitForSelector('[data-testid="step2-extract"]',
        { timeout: 10000 })
      await page.waitForSelector('[data-testid="chunk-list"]',
        { timeout: 30000 })
      await expect(page.locator('[data-testid="chunk-list"]'))
        .toBeVisible()

      await page.click('[data-testid="start-annotating-button"]')

      // Step 3: Sample labeling
      await page.waitForSelector('[data-testid="step3-sample"]')

      // skip labeling — use zero-shot path
      await page.click('[data-testid="skip-to-generate-button"]')

      // Step 4: Generation
      await page.waitForSelector('[data-testid="step4-generation"]',
        { timeout: 10000 })
      await page.waitForSelector('[data-testid="generation-complete"]',
        { timeout: 60000 })
      await expect(page.locator('[data-testid="total-pairs-stat"]'))
        .toBeVisible()

      await page.click('[data-testid="review-button"]')

      // Step 5: Review
      await page.waitForSelector('[data-testid="step5-review"]')
      await expect(page.locator('[data-testid="approved-column"]'))
        .toBeVisible()

      await page.click('[data-testid="export-button"]')

      // Step 6: Export
      await page.waitForSelector('[data-testid="step6-export"]')
      await expect(page.locator('[data-testid="export-preview"]'))
        .toBeVisible()

      // download
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.click('[data-testid="download-button"]')
      ])
      expect(download.suggestedFilename()).toMatch(/labelforge/)
    }
  )

  test("skip labeling uses zero-shot path", async ({ page }) => {
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

    await page.waitForSelector('[data-testid="chunk-list"]',
      { timeout: 30000 })
    await page.click('[data-testid="start-annotating-button"]')
    await page.waitForSelector('[data-testid="step3-sample"]')

    await expect(page.locator('[data-testid="skip-to-generate-button"]'))
      .toBeVisible()
    await page.click('[data-testid="skip-to-generate-button"]')

    await page.waitForSelector('[data-testid="step4-generation"]',
      { timeout: 10000 })
  })
})