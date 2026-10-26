import { test, expect } from '@playwright/test';

test.describe('JittaDrives Smoke Test', () => {
  test('Admin dashboard loads and title is present', async ({ page }) => {
    const response = await page.goto('/admin/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/JittaDrives/i);
  });

  test('Customer / Driver webapp loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });
});
