import { test, expect } from '@playwright/experimental-ct-react';
import { TerminalLog } from './TerminalLog';
import React from 'react';
import { useUIStore } from '@/store/useUIStore';

test.describe('TerminalLog Component', () => {
  test('renders logs and handles filters correctly', async ({ mount }) => {
    useUIStore.setState({ isTerminalOpen: true, areTooltipsEnabled: false });
    const component = await mount(<TerminalLog />);

    await expect(component).toBeVisible();
    
    const systemFilterBtn = component.getByRole('button', { name: 'S' }).first();
    await expect(systemFilterBtn).toBeVisible({ timeout: 15000 });
    
    const criticalFilterBtn = component.getByRole('button', { name: 'C' }).first();
    await expect(criticalFilterBtn).toBeVisible({ timeout: 15000 });
  });
});
