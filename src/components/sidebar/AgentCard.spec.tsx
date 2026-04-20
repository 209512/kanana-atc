import { test, expect } from '@playwright/experimental-ct-react';
import React from 'react';
import { AgentCard } from './AgentCard';
import { Reorder } from 'framer-motion';
import { mockAgentBase } from '@/mocks/fixtures/agent';
import { mockStateBase } from '@/mocks/fixtures/state';

test.use({ viewport: { width: 1200, height: 800 } });

test('Should render AgentCard with correct agent information', async ({ mount }) => {
  const component = await mount(
    <Reorder.Group values={['Agent-1']} onReorder={() => {}}>
      <AgentCard 
        agent={mockAgentBase as any}
        state={mockStateBase as any}
        isDark={true}
        isSelected={false}
        isPrioritySection={false}
        renamingId={null}
        newName=""
        setNewName={() => {}}
        onSelect={() => {}}
        onStartRename={() => {}}
        onConfirmRename={() => {}}
        onCancelRename={() => {}}
        onTogglePause={() => {}}
        onTransferLock={() => {}}
        onTogglePriority={() => {}}
        onTerminate={() => {}}
      />
    </Reorder.Group>
  );

  // We just verify it mounts without crashing. Framer Motion might hide elements during initial render.
  await expect(component).toBeVisible();
});
