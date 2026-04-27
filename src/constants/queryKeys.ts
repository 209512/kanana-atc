export const queryKeys = {
  all: ['atc'] as const,
  auth: () => [...queryKeys.all, 'auth'] as const,
  agents: () => [...queryKeys.all, 'agents'] as const,
  agent: (uuid: string) => [...queryKeys.agents(), uuid] as const,
  mutations: {
    togglePause: () => [...queryKeys.agents(), 'mutation', 'togglePause'] as const,
    togglePriority: () => [...queryKeys.agents(), 'mutation', 'togglePriority'] as const,
    transferLock: () => [...queryKeys.agents(), 'mutation', 'transferLock'] as const,
    terminateAgent: () => [...queryKeys.agents(), 'mutation', 'terminateAgent'] as const,
    toggleGlobalStop: () => [...queryKeys.all, 'mutation', 'toggleGlobalStop'] as const,
    triggerOverride: () => [...queryKeys.all, 'mutation', 'triggerOverride'] as const,
    releaseLock: () => [...queryKeys.all, 'mutation', 'releaseLock'] as const,
    updatePriorityOrder: () => [...queryKeys.agents(), 'mutation', 'updatePriorityOrder'] as const,
    renameAgent: () => [...queryKeys.agents(), 'mutation', 'renameAgent'] as const,
    updateAgentConfig: () => [...queryKeys.agents(), 'mutation', 'updateAgentConfig'] as const,
    scaleAgents: () => [...queryKeys.all, 'mutation', 'scaleAgents'] as const,
  }
};