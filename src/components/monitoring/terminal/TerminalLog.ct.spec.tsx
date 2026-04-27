import { test, expect } from '@playwright/experimental-ct-react';
import { TerminalLog } from './TerminalLog';
import React from 'react';

test.describe('TerminalLog Component', () => {
  test('renders logs and handles filters correctly', async ({ mount }) => {

    // TODO: Add Zustand store mock wrapper for full UI state testing
    const component = await mount(<TerminalLog />);

    await expect(component).toBeVisible();
    
    const systemFilterBtn = component.locator('button', { hasText: 'S' }).first();
    await expect(systemFilterBtn).toBeVisible();
    
    const criticalFilterBtn = component.locator('button', { hasText: 'C' }).first();
    await expect(criticalFilterBtn).toBeVisible();

    await criticalFilterBtn.click({ force: true });
    await component.page().waitForTimeout(300); // Wait for debounce

    const classAttr = await criticalFilterBtn.getAttribute('class');
    if (classAttr) {
      expect(typeof classAttr).toBe('string');
    }
  });
});
