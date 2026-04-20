// src/store/slices/createAiSlice.ts
import { StateCreator } from 'zustand';
import { ATCStore, AiSlice } from './types';
import { atcApi } from '@/contexts/atcApi';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { AIProposal } from '@/contexts/atcTypes';
import { logger } from '@/utils/logger';

export const createAiSlice: StateCreator<
  ATCStore,
  [],
  [],
  AiSlice
> = (set, get) => ({
  isAiMode: false,
  isAiAutoMode: false,
  aiQuota: 20,
  pendingProposals: new Map<string, AIProposal>(),
  riskScore: 0,
  autonomyLevel: 100,

  toggleAiMode: async (isAi) => {
    set((s) => {
      const newState = { ...s.state };
      if (!isAi) {
        newState.pendingProposals = new Map();
      }
      return { isAiMode: isAi, isAiAutoMode: isAi ? s.isAiAutoMode : false, state: newState };
    });
    get().addLog(isAi ? ATC_CONFIG.LOG_MSG.AI_MODE_ON : ATC_CONFIG.LOG_MSG.AI_MODE_OFF, 
                 isAi ? "insight" : "system", "SYSTEM");
  },

  toggleAiAutoMode: (val?: boolean) => set((s) => {
    const newValue = val !== undefined ? val : !s.isAiAutoMode;
    
    // Log the mode change
    if (s.addLog) {
        s.addLog(`AI Autopilot Mode ${newValue ? 'ACTIVATED' : 'DEACTIVATED'}`, newValue ? 'warn' : 'info', 'SYSTEM');
    }
    
    return { isAiAutoMode: newValue };
  }),

  setAiQuota: (quota) => set({ aiQuota: quota }),
  
  setRiskData: (riskScore, autonomyLevel) => set({ riskScore, autonomyLevel }),

  approveProposals: async () => {
    const store = get();
    const proposalsMap = store.state.pendingProposals;
    if (!proposalsMap || proposalsMap.size === 0) return;
    
    const proposals = Array.from(proposalsMap.values());
    store.addLog(ATC_CONFIG.LOG_MSG.PROPOSAL_EXEC(proposals.length), "exec", "SYSTEM");
    
    try {
      await atcApi.executeProposals(proposals as unknown as Record<string, unknown>[]);
      
      for (const prop of proposals) {
        if (!prop || !prop.action) continue;
        const { action, targetId, value: pVal } = prop;
        const targetKey = String(targetId).toUpperCase();
        
        let actualUuid = null;
        if (['SYSTEM', 'GLOBAL', 'USER'].includes(targetKey)) {
          actualUuid = targetKey;
        } else {
          const agent = store.agents.find(a => 
            a.uuid.toUpperCase() === targetKey || 
            (a.displayName || '').toUpperCase() === targetKey || 
            a.id.toUpperCase() === targetKey
          );
          if (agent) actualUuid = agent.uuid;
        }

        if (['SYSTEM', 'GLOBAL'].includes(targetKey)) {
          await store._executeSystemAction(action, pVal as string | null);
          continue;
        }

        if (!actualUuid) continue;
        await store._executeAgentAction(action, actualUuid, pVal as string | null);
      }
      store.playSuccess();
      set((s) => ({ state: { ...s.state, pendingProposals: new Map() } }));
    } catch (err) {
      logger.error("AI Action Execution Failed:", err);
      store.addLog("❌ EXECUTION_FAILED: Please retry.", "critical", "SYSTEM");
    }
  },

  _executeSystemAction: async (action: string, pVal: string | null) => {
    const store = get();
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
  },

  _executeAgentAction: async (action: string, actualUuid: string, pVal: string | null) => {
    const store = get();
    const agent = store.agents.find(a => a.uuid === actualUuid);
    
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
        const agents = store.agents;
        if (agents.length > 1) {
          store.markAction(actualUuid, '', null, true);
          store.setTrafficIntensityLocal(Math.max(0, agents.length - 1));
        }
        break;
      }
      case 'TRANSFER': 
        store.markAction('', 'forcedCandidate', actualUuid);
        // store.markAction('', 'holder', null); // 락 이양 시 holder 초기화로 인한 전체 일시정지 버그 방지
        break;
    }
  },

  rejectProposals: () => {
    get().addLog(ATC_CONFIG.LOG_MSG.PROPOSAL_REJECT, "system", "SYSTEM");
    set((s) => ({ state: { ...s.state, pendingProposals: new Map() } }));
  },
});
