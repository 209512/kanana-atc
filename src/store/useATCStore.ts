// src/store/useATCStore.ts
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
    auditLogs: [], // UI 렌더링용 임시 상태 (실제 저장은 idbService에서 담당)
    addAuditLog: (log: any) => {
      // 1. 비동기로 IndexedDB에 안전하게 영구 저장 (메모리 오프로딩)
      idbService.addAuditLog(log).catch(err => logger.error("IDB Add Error", err));
      
      // 2. UI 즉각 반영을 위해 Zustand 메모리에는 최근 50개만 남기고 GC 유도
      set((s: any) => {
        const newLogs = [...(s.auditLogs || []), { ...log, timestamp: Date.now() }];
        return { auditLogs: newLogs.slice(-50) };
      });
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

// EventBus 구독을 통한 슬라이스 디커플링 처리
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
      if (agent && !agent.priority) store.markAction(actualUuid, 'priority', true); 
      break;
    case 'REVOKE': 
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

// Window global expose for E2E testing
if (typeof window !== 'undefined' && (import.meta.env.MODE !== 'production' || import.meta.env.VITE_USE_MSW === 'true')) {
  (window as unknown as { useATCStore: unknown }).useATCStore = useATCStore;
}
