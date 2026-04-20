// src/store/slices/createCoreSlice.ts
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
    autonomyLevel: 100
  },
  agents: [],
  setState: (updater) => set((s) => ({ state: typeof updater === 'function' ? updater(s.state) : updater })),
  setAgents: (updater) => set((s) => ({ agents: typeof updater === 'function' ? updater(s.agents) : updater })),
  
  addLog: (message, type, agentId) => {
    const newLog: LogEntry = {
      id: `ui-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      message, type, agentId
    };
    set((s) => {
      // 배열 스프레드 연산자 제거 (가비지 컬렉션 최적화)
      const logs = s.state.logs.slice();
      logs.push(newLog);
      if (logs.length > 1000) {
        logs.shift(); // 오래된 로그 삭제
      }
      return { state: { ...s.state, logs } };
    });
  },

  setTrafficIntensityLocal: (val) => {
    set((s) => ({ state: { ...s.state, trafficIntensity: val } }));
  },
});
