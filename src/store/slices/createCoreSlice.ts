import { StateCreator } from 'zustand';
import { ATCStore, CoreSlice } from './types';
import { LogEntry } from '@/contexts/atcTypes';

export const createCoreSlice: StateCreator<
  ATCStore,
  [],
  [],
  CoreSlice
> = (set) => ({
  state: {
    activeAgentCount: 0,
    globalStop: false,
    trafficIntensity: 5,
    logs: [],
    pendingProposals: new Map(),
    handoverTarget: null,
    holder: null,
    waitingAgents: [],
    priorityAgents: [],
    forcedCandidate: null,
    overrideSignal: false,
    collisionCount: 0,
    latency: 0,
  },
  agents: [],
  setState: (updater) => set((s) => ({ state: typeof updater === 'function' ? updater(s.state) : updater })),
  setAgents: (updater) => set((s) => ({ agents: typeof updater === 'function' ? updater(s.agents) : updater })),
  
  addLog: (message, type, agentId) => {
    set((s) => {
      let resolvedAgentName = undefined;
      if (agentId && !['SYSTEM', 'USER', 'ADMIN', 'POLICY'].includes(agentId.toUpperCase())) {
        const foundAgent = s.agents.find(a => a.uuid === agentId || a.id === agentId);
        if (foundAgent) {
          resolvedAgentName = foundAgent.displayId || foundAgent.displayName || foundAgent.name || `Agent-Unknown`;
        } else if (type === 'insight' || type === 'exec' || type === 'proposal') {
          resolvedAgentName = 'SYSTEM';
        } else {
          resolvedAgentName = `Agent-Unknown`;
        }
      } else {
        resolvedAgentName = agentId;
      }

      const newLog: LogEntry = {
        id: `ui-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        message, 
        type, 
        agentId,
        agentName: resolvedAgentName
      };
      const maxLogs = 100;
      const newLogs = [...s.state.logs, newLog].slice(-maxLogs);
      
      return { state: { ...s.state, logs: newLogs } };
    });
  },

  setTrafficIntensityLocal: (val) => {
    set((s) => ({ state: { ...s.state, trafficIntensity: val } }));
  },
});
