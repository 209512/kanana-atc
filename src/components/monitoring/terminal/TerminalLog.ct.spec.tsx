import { test, expect } from '@playwright/experimental-ct-react';
import { TerminalLog } from './TerminalLog';
import React from 'react';

test.describe('TerminalLog Component', () => {
  test('renders logs and handles filters correctly', async ({ mount }) => {

    // NOTE: Since TerminalLog reads from Zustand store directly in the real app,
    // NOTE: we would typically mock the store. For CT, we might need a wrapper or
    // NOTE: inject props. Assuming TerminalLog internally uses `useATCStore`,
    // NOTE: we can either mock the store or just test its rendering if it accepts props
    // NOTE: For now, let's verify that the component mounts without crashing
    const component = await mount(<TerminalLog />);

    await expect(component).toBeVisible();
    
    // NOTE: The filter buttons use the 'shortcut' letter as text, e.g., 'S' for SYS, 'C' for CRIT
    const systemFilterBtn = component.locator('button', { hasText: 'S' }).first();
    await expect(systemFilterBtn).toBeVisible();
    
    const criticalFilterBtn = component.locator('button', { hasText: 'C' }).first();
    await expect(criticalFilterBtn).toBeVisible();

    // NOTE: Click filter and check state (visual check)
    await criticalFilterBtn.click();
    // NOTE: Assuming clicking toggles some active class, we can check for it
    // NOTE: Wait for the UI to update (active state turns it to bg-blue-600)
    await expect(criticalFilterBtn).toHaveClass(/bg-blue-600/);
  });
});
