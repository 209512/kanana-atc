export const mockAgentBase = {
  id: 'Agent-1',
  uuid: '1234-5678',
  displayId: 'Alpha',
  model: 'Drone X',
  activity: 'Patrolling',
  status: 'active',
  isPaused: false,
  priority: false,
  lockedBy: null,
  overrideSignal: false,
  position: [0, 0, 0] as [number, number, number],
  activeTime: 0,
  index: 0,
  seed: 1234
};

export const mockAgentPaused = {
  ...mockAgentBase,
  isPaused: true,
  activity: 'Paused'
};

export const mockAgentPriority = {
  ...mockAgentBase,
  priority: true,
  activity: 'High Priority'
};

export const mockAgentLocked = {
  ...mockAgentBase,
  lockedBy: 'user',
  activity: 'Locked'
};

export const mockAgentOverride = {
  ...mockAgentBase,
  overrideSignal: true,
  activity: 'Override Mode'
};