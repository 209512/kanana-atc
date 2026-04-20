import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, fn } from '@storybook/test';
import { AgentCard } from './AgentCard';
import { Reorder } from 'framer-motion';
import { 
  mockAgentBase, 
  mockAgentPaused, 
  mockAgentPriority, 
  mockAgentLocked,
  mockAgentOverride 
} from '@/mocks/fixtures/agent';
import { mockStateBase } from '@/mocks/fixtures/state';

const meta: Meta<typeof AgentCard> = {
  title: 'Monitoring/AgentCard',
  component: AgentCard,
  decorators: [
    (Story) => (
      <div className="w-[350px] p-4 bg-slate-900 h-screen">
        <Reorder.Group values={['Agent-1']} onReorder={() => {}}>
          <Story />
        </Reorder.Group>
      </div>
    ),
  ],
  args: {
    state: mockStateBase as any,
    isDark: true,
    isSelected: false,
    isPrioritySection: false,
    renamingId: null,
    newName: '',
    onSelect: fn(),
    onStartRename: fn(),
    onConfirmRename: fn(),
    onCancelRename: fn(),
    onTogglePause: fn(),
    onTransferLock: fn(),
    onTogglePriority: fn(),
    onTerminate: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AgentCard>;

export const Interactive: Story = {
  args: {
    agent: mockAgentBase as any,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // 1. AgentCard 전체 클릭 시 onSelect 호출 확인
    const cardText = canvas.getByText('Alpha');
    await userEvent.click(cardText);
    await expect(args.onSelect).toHaveBeenCalled();
  },
};

export const Selected: Story = {
  args: {
    agent: mockAgentBase as any,
    isSelected: true,
  },
};

export const Paused: Story = {
  args: {
    agent: mockAgentPaused as any,
  },
};

export const Priority: Story = {
  args: {
    agent: mockAgentPriority as any,
  },
};

export const Locked: Story = {
  args: {
    agent: mockAgentLocked as any,
  },
};

export const Override: Story = {
  args: {
    agent: mockAgentOverride as any,
  },
};