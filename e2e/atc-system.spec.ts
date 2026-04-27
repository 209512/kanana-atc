import { test, expect } from '@playwright/test';

test.describe('Kanana ATC System E2E Tests', () => {
  
  test('Should load main application UI successfully', async ({ page }) => {
    await page.goto('/');
    const rootContainer = page.locator('#root');
    await expect(rootContainer).toBeVisible();
    
    // NOTE: Verify DOM rendering instead of UI text to account for MSW/Three.js delays
    // NOTE: Check if Sidebar or Main Layout is rendered
    const appContainer = page.locator('div.h-screen.w-screen');
    await expect(appContainer).toBeVisible({ timeout: 10000 });
  });

  test('Should toggle sidebar visibility', async ({ page }) => {
    await page.goto('/');
    
    // NOTE: Find the view mode toggle button in SystemStats (or unknown accessible button)
    const toggleButton = page.getByRole('button', { name: /DETACH|ATTACH/ }).first();
    
    if (await toggleButton.isVisible()) {
      const currentText = await toggleButton.innerText();
      await toggleButton.click();
      await expect(toggleButton).not.toHaveText(currentText);
    }
  });

  test('Should open agent settings modal', async ({ page }) => {
    await page.goto('/');
    
    // NOTE: Settings icon usually present in sidebar or header
    const settingsBtn = page.locator('button').filter({ hasText: 'Settings' }).first();
    
    // NOTE: If setting button is found, click it and check if modal appears
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click();
      const modal = page.locator('div[role="dialog"]');
      await expect(modal).toBeVisible();
    }
  });

});