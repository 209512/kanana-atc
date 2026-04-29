import { test, expect } from '@playwright/experimental-ct-react';
import { TerminalLog } from './TerminalLog';
import React from 'react';

test.describe('TerminalLog Component', () => {
  test('renders logs and handles filters correctly', async ({ mount }) => {
    // TODO: add Zustand store wrapper
    const component = await mount(<TerminalLog />);

    await expect(component).toBeVisible();
    
    const systemFilterBtn = component.locator('button').filter({ hasText: /^S$/ }).first();
    await expect(systemFilterBtn).toBeVisible();
    
    const criticalFilterBtn = component.locator('button').filter({ hasText: /^C$/ }).first();
    await expect(criticalFilterBtn).toBeVisible();
  });
});
