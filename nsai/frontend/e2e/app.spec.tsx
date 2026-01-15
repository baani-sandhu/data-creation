import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect title "to contain" a substring dashboard
  await expect(page).toHaveTitle(/frontend/);
});


