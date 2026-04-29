import { create } from 'zustand';
import { Agent, ATCState, AIProposal, LogEntry } from '@/contexts/atcTypes';
import { createCoreSlice } from './slices/createCoreSlice';
import { createAiSlice } from './slices/createAiSlice';
import { createActionSlice } from './slices/createActionSlice';
import { ATCStore } from './slices/types';
import { atcEventBus } from '@/utils/eventBus';
import { logger } from '@/utils/logger';
import { idbService } from '@/utils/idbService';

export type { ATCStore, CoreSlice, AiSlice, ActionSlice } from './slices/types';

export const useATCStore = create<ATCStore>()((...a) => {
  const set = a[0];
  return {
    ...createCoreSlice(...a),
    ...createAiSlice(...a),
    ...createActionSlice(...a),
    metrics: {
      totalAiCalls: 0,
      jailbreakAttempts: 0,
      jsonParseFailures: 0,
      successfulActions: 0,
    },
    recordMetric: (type: 'call' | 'jailbreak' | 'parseFailure' | 'success') => set((s: ATCStore) => {
      const metrics = { ...(s.metrics || { totalAiCalls: 0, jailbreakAttempts: 0, jsonParseFailures: 0, successfulActions: 0 }) };
      if (type === 'call') metrics.totalAiCalls += 1;
      if (type === 'jailbreak') metrics.jailbreakAttempts += 1;
      if (type === 'parseFailure') metrics.jsonParseFailures += 1;
      if (type === 'success') metrics.successfulActions += 1;
      return { metrics } as Partial<ATCStore>;
    }),
    auditLogs: [], // Temporary UI state
    addAuditLog: (log: any) => {
      set((s: ATCStore) => {
        const newLogs = [...(s.auditLogs || []), { ...log, timestamp: Date.now() }];
        return { auditLogs: newLogs.slice(-50) } as Partial<ATCStore>;
      });
      atcEventBus.emit('AUDIT_LOG_ADDED', log);
    },
    initAuditLogs: async () => {
      try {
        const logs = await idbService.getRecentAuditLogs(50);
        set({ auditLogs: logs });
      } catch (err) {
        logger.error("Failed to init audit logs from IDB", err);
      }
    },
    isInitializing: false
  } as any;
});

let eventBusInitialized = false;

export const initATCEventBus = () => {
  if (eventBusInitialized) return;
  eventBusInitialized = true;

  atcEventBus.on('SYSTEM_ACTION', ({ action, pVal }) => {
    const store = useATCStore.getState();
    if (action === 'SCALE') store.setTrafficIntensityLocal(Number(pVal));
    if (action === 'STOP' || action === 'START') {
      const isStop = action === 'STOP';
      store.markAction('', 'globalStop', isStop);
    }
    if (action === 'OVERRIDE') {
      store.markAction('', 'overrideSignal', true);
      store.markAction('', 'holder', 'USER');
    }
    if (action === 'RELEASE') {
      store.markAction('', 'overrideSignal', false);
      store.markAction('', 'holder', null);
    }
  });

  atcEventBus.on('AGENT_ACTION', ({ action, actualUuid, pVal, agents }) => {
    const store = useATCStore.getState();
    const agent = agents.find(a => a.uuid === actualUuid);
    
    switch (action) {
      case 'PAUSE': 
        if (agent && !agent.isPaused) store.markAction(actualUuid, 'isPaused', true); 
        break;
      case 'RESUME': 
        if (agent && agent.isPaused) store.markAction(actualUuid, 'isPaused', false); 
        break;
      case 'PRIORITY': 
      case 'PRIORITY_HIGH':
        if (agent && !agent.priority) store.markAction(actualUuid, 'priority', true); 
        break;
      case 'REVOKE': 
      case 'PRIORITY_LOW':
      case 'PRIORITY_NORMAL':
        if (agent && agent.priority) store.markAction(actualUuid, 'priority', false); 
        break;
      case 'RENAME': 
        if (pVal) store.markAction(actualUuid, 'displayName', String(pVal)); 
        break;
      case 'CONFIG':
        if (pVal) {
          try {
            const configUpdates = JSON.parse(pVal);
            store.updateAgentConfigLocal(actualUuid, configUpdates);
          } catch {
            logger.error("Invalid CONFIG JSON in proposal:", pVal);
          }
        }
        break;
      case 'TERMINATE': {
        if (agents.length > 1) {
          store.markAction(actualUuid, '', null, true);
          store.setTrafficIntensityLocal(Math.max(0, agents.length - 1));
        }
        break;
      }
      case 'TRANSFER': 
        store.markAction('', 'forcedCandidate', actualUuid);
        break;
    }
  });

  atcEventBus.on('AUDIT_LOG_ADDED', (log) => {
    idbService.addAuditLog(log).then((ok) => {
      if (!ok) {
        const store = useATCStore.getState();
        store.addLog?.('AUDIT_LOG_PERSISTENCE_FAILED', 'warn', 'SYSTEM');
      }
    }).catch(err => logger.error("IDB Add Error", err));
  });
};

initATCEventBus();

if (typeof window !== 'undefined' && (import.meta.env.MODE !== 'production' || import.meta.env.VITE_USE_MSW === 'true')) {
  (window as unknown as { useATCStore: unknown }).useATCStore = useATCStore;
}
