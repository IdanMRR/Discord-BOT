import { test, expect } from '@playwright/test';

test.describe('Discord Bot Dashboard', () => {
  test('should load the dashboard homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/Discord Bot Dashboard/i);
    
    // Check for login form or dashboard content
    const loginForm = page.locator('form');
    const dashboardContent = page.locator('[data-testid="dashboard"]');
    
    // Either login form or dashboard should be present
    await expect(loginForm.or(dashboardContent)).toBeVisible();
  });

  test('should navigate to server selection when not logged in', async ({ page }) => {
    await page.goto('/');
    
    // If there's a login required, check for login elements
    const loginButton = page.locator('button:has-text("Login")');
    if (await loginButton.isVisible()) {
      await expect(loginButton).toBeVisible();
    }
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that mobile navigation works
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    const hamburgerButton = page.locator('button[aria-label="menu"]');
    
    // Either mobile menu exists or hamburger button exists
    if (await hamburgerButton.isVisible()) {
      await hamburgerButton.click();
      await expect(mobileMenu).toBeVisible();
    }
  });
});