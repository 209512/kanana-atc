export const mockLogsBase = [
  { id: '1', message: 'System initialized', type: 'system', timestamp: Date.now(), agentId: 'SYSTEM' },
  { id: '2', message: 'Test alert', type: 'critical', timestamp: Date.now(), agentId: 'SYSTEM' }
];

export const mockLogsFiltered = [
  { id: '1', message: 'System message', type: 'system', timestamp: Date.now(), agentId: 'SYSTEM' },
  { id: '2', message: 'Critical error', type: 'critical', timestamp: Date.now(), agentId: 'SYSTEM' }
];
