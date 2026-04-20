// src/store/useATCStore.ts
import { create } from 'zustand';
import { Agent, ATCState, AIProposal, LogEntry } from '@/contexts/atcTypes';
import { createCoreSlice } from './slices/createCoreSlice';
import { createAiSlice } from './slices/createAiSlice';
import { createActionSlice } from './slices/createActionSlice';
import { ATCStore } from './slices/types';

export type { ATCStore, CoreSlice, AiSlice, ActionSlice } from './slices/types';

export const useATCStore = create<ATCStore>()((...a) => {
  const set = a[0];
  return {
    ...createCoreSlice(...a),
    ...createAiSlice(...a),
    ...createActionSlice(...a),
    lastKnownGoodActions: [], // Fallback actions
    setLastKnownGoodActions: (actions: any[]) => set({ lastKnownGoodActions: actions }),
    metrics: {
      totalAiCalls: 0,
      jailbreakAttempts: 0,
      jsonParseFailures: 0,
      successfulActions: 0,
    },
    recordMetric: (type: 'call' | 'jailbreak' | 'parseFailure' | 'success') => set((s: any) => {
      const metrics = { ...(s.metrics || { totalAiCalls: 0, jailbreakAttempts: 0, jsonParseFailures: 0, successfulActions: 0 }) };
      if (type === 'call') metrics.totalAiCalls += 1;
      if (type === 'jailbreak') metrics.jailbreakAttempts += 1;
      if (type === 'parseFailure') metrics.jsonParseFailures += 1;
      if (type === 'success') metrics.successfulActions += 1;
      return { metrics };
    }),
    auditLogs: [],
    addAuditLog: (log: any) => set((s: any) => ({ auditLogs: [...(s.auditLogs || []), { ...log, timestamp: Date.now() }] })),
    isInitializing: false
  } as any;
});

// Window global expose for E2E testing
if (typeof window !== 'undefined' && (import.meta.env.MODE !== 'production' || import.meta.env.VITE_USE_MSW === 'true')) {
  (window as unknown as { useATCStore: unknown }).useATCStore = useATCStore;
}
