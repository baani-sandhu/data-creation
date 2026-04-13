# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: setup.spec.ts >> Step 1 - Setup >> can add fields
- Location: tests\e2e\setup.spec.ts:40:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="dashboard"]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]: LabelForge
    - generic [ref=e7]: Sign in to continue your labeling session.
  - generic [ref=e8]:
    - button "Sign In" [ref=e9]
    - button "Sign Up" [ref=e10]
  - button "Sign in with Google" [ref=e11]
  - generic [ref=e12]: or
  - generic [ref=e13]:
    - textbox "Email address" [ref=e14]: test@labelforge.dev
    - textbox "Password" [ref=e15]: testpassword123
    - button "Sign in" [ref=e16]
  - generic [ref=e17]: Unable to sign in with email.
```

# Test source

```ts
  1  | import { Page } from "@playwright/test"
  2  | 
  3  | export const TEST_EMAIL = process.env.TEST_EMAIL || "test@labelforge.dev"
  4  | export const TEST_PASSWORD = process.env.TEST_PASSWORD || "testpassword123"
  5  | 
  6  | export async function loginWithEmail(page: Page) {
  7  |   await page.goto("/")
  8  | 
  9  |   // wait for login page to appear
  10 |   await page.waitForSelector('[data-testid="login-page"]',
  11 |     { timeout: 10000 })
  12 | 
  13 |   // click email/password tab if needed
  14 |   const emailTab = page.locator('[data-testid="email-signin-tab"]')
  15 |   if (await emailTab.isVisible()) {
  16 |     await emailTab.click()
  17 |   }
  18 | 
  19 |   await page.fill('[data-testid="email-input"]', TEST_EMAIL)
  20 |   await page.fill('[data-testid="password-input"]', TEST_PASSWORD)
  21 |   await page.click('[data-testid="signin-button"]')
  22 | 
  23 |   // wait for dashboard to appear after login
> 24 |   await page.waitForSelector('[data-testid="dashboard"]',
     |              ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  25 |     { timeout: 15000 })
  26 | }
  27 | 
  28 | export async function logout(page: Page) {
  29 |   const signOutBtn = page.locator('[data-testid="signout-button"]')
  30 |   if (await signOutBtn.isVisible()) {
  31 |     await signOutBtn.click()
  32 |     await page.waitForSelector('[data-testid="login-page"]')
  33 |   }
  34 | }
```