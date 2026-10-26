import { test, expect } from '@playwright/test';

test.describe('Basic Automated Test Suite', () => {

  test('Test 1: Customer & Driver App Interface Inspection', async ({ page }) => {
    // Set viewport to a realistic mobile screen
    await page.setViewportSize({ width: 412, height: 915 });
    
    console.log('Navigating to Customer & Driver App...');
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify app loaded
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible();

    // Check for interactive elements (buttons, inputs)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} interactive buttons on Customer view.`);
    expect(buttonCount).toBeGreaterThan(0);

    // Click the first button or tab to show interaction
    if (buttonCount > 0) {
      await buttons.first().hover();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'test-results/basic-customer-view.png' });
    await page.waitForTimeout(2000);
  });

  test('Test 2: Admin Dashboard & Avatar Profile Audit', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log('Navigating to Admin Dashboard...');
    await page.goto('http://127.0.0.1:8000/admin/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify Title
    await expect(page).toHaveTitle(/JittaDrives/i);

    // Assert that NO Unsplash AI mock photos exist on the page
    const images = page.locator('img');
    const count = await images.count();
    console.log(`Scanned ${count} images in Admin Panel.`);

    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute('src');
      if (src) {
        expect(src).not.toContain('unsplash.com');
      }
    }
    console.log('Verified: ZERO Unsplash AI stock images exist in Admin!');

    await page.screenshot({ path: 'test-results/basic-admin-view.png' });
    await page.waitForTimeout(2000);
  });

});
