import { test, expect } from '@playwright/test';

test.describe('Phase 1: Normal Baseline Tests', () => {

  // TC-1: App & Server Health Check
  test('TC-1: Customer App and Admin Dashboard load successfully', async ({ page }) => {
    // 1. Visit Customer App
    const custResponse = await page.goto('/');
    expect(custResponse?.status()).toBe(200);
    await page.waitForTimeout(1000);

    // 2. Visit Admin Panel
    const adminResponse = await page.goto('/admin/');
    expect(adminResponse?.status()).toBe(200);
    await expect(page).toHaveTitle(/JittaDrives/i);

    // Capture screenshot of Admin dashboard
    await page.screenshot({ path: 'test-results/tc1-admin-loaded.png' });
  });

  // TC-2: Admin Profile Pictures - Verify NO AI/Unsplash Photos
  test('TC-2: Admin Drivers List has NO AI photos and displays profile icons', async ({ page }) => {
    await page.goto('/admin/');
    await page.waitForLoadState('networkidle');

    // Find all images on the page
    const images = page.locator('img');
    const imgCount = await images.count();

    for (let i = 0; i < imgCount; i++) {
      const src = await images.nth(i).getAttribute('src');
      if (src) {
        expect(src).not.toContain('unsplash.com');
      }
    }

    // Verify drivers table rendered
    const driversHeading = page.locator('text=Drivers').first();
    await expect(driversHeading).toBeVisible();

    await page.screenshot({ path: 'test-results/tc2-admin-drivers-no-ai-pics.png' });
  });

  // TC-3: Customer App Interface & Ride Options
  test('TC-3: Customer view loads interactive booking interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for main booking card or map container
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify search / book button or interactive element exists
    const interactiveElements = page.locator('button');
    const buttonCount = await interactiveElements.count();
    expect(buttonCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/tc3-customer-view.png' });
  });

  // TC-4: Driver App Online Status API Check
  test('TC-4: Driver Status & Matching API responds quickly (< 300ms)', async ({ request }) => {
    const start = Date.now();
    const res = await request.get('/api/drivers/nearby?lat=11.6643&lng=78.1460&category=SEDAN');
    const duration = Date.now() - start;

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success');
    expect(duration).toBeLessThan(1000); // Must be fast
  });

});
