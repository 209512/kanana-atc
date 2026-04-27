import { StateCreator } from 'zustand';
import { ATCStore, AiSlice } from './types';
import { atcApi } from '@/contexts/atcApi';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { AIProposal } from '@/contexts/atcTypes';
import { logger } from '@/utils/logger';

import { atcEventBus } from '@/utils/eventBus';

const levenshtein = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[a.length][b.length];
};

export const createAiSlice: StateCreator<
  ATCStore,
  [],
  [],
  AiSlice
> = (set, get) => ({
  isAiMode: false,
  isAiAutoMode: false,
  isAnalyzing: false,
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
    
    // NOTE: Log the mode change
    if (s.addLog) {
        s.addLog(`AI Autopilot Mode ${newValue ? 'ACTIVATED' : 'DEACTIVATED'}`, newValue ? 'warn' : 'info', 'SYSTEM');
    }
    
    return { isAiAutoMode: newValue };
  }),

  setIsAnalyzing: (isAnalyzing: boolean) => set({ isAnalyzing }),
  
  setRiskData: (riskScore, autonomyLevel) => set({ riskScore, autonomyLevel }),

  approveProposals: async () => {
    const store = get();
    const proposalsMap = store.state.pendingProposals;
    if (!proposalsMap || proposalsMap.size === 0) return;
    
    const proposals = Array.from(proposalsMap.values());
    
    // NOTE: Create detailed execution log for each proposal
    const detailedActions = proposals.map(p => `[${p.action}: ${p.targetId}]`).join(', ');
    store.addLog(`⚙️ AI_EXECUTION: ${detailedActions}`, "exec", "SYSTEM");
    
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
          // NOTE: Dynamic Fuzzy Matching via Levenshtein Distance & Substring Inclusion
          // NOTE: Remove non-alphanumeric characters for clean comparison
          const cleanTk = targetKey.replace(/[^a-zA-Z0-9가-힣]/g, '');
          
          let bestMatch = null;
          let bestScore = Infinity;

          for (const a of store.agents) {
            const uuid = a.uuid.toUpperCase();
            const id = (a.id || '').toUpperCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
            const dName = (a.displayName || '').toUpperCase().replace(/[^a-zA-Z0-9가-힣]/g, '');
            const aName = (a.name || '').toUpperCase().replace(/[^a-zA-Z0-9가-힣]/g, '');

            // NOTE: Exact Match or Substring Inclusion (Highest priority)
            if (uuid === targetKey || id === cleanTk || dName === cleanTk || aName === cleanTk || 
                (cleanTk.length >= 2 && (dName.includes(cleanTk) || aName.includes(cleanTk) || id.includes(cleanTk) || uuid.includes(cleanTk)))) {
              bestMatch = a;
              bestScore = 0;
              break;
            }

            // NOTE: Fuzzy Matching (Levenshtein Distance)
            // NOTE: Calculate distance against all possible identifiers
            const distances = [
              levenshtein(cleanTk, id),
              levenshtein(cleanTk, dName),
              levenshtein(cleanTk, aName)
            ];
            
            const minDistance = Math.min(...distances);
            
            // NOTE: Prevent executing critical commands on wrong agent
            // NOTE: 20% error tolerance to prevent mismatch
            const threshold = Math.max(1, Math.floor(cleanTk.length * 0.2)); // 20% error tolerance
            
            if (minDistance <= threshold && minDistance < bestScore) {
              bestScore = minDistance;
              bestMatch = a;
            }
          }
          
          if (bestMatch) {
            actualUuid = bestMatch.uuid;
          }
        }

        if (['SYSTEM', 'GLOBAL'].includes(targetKey)) {
          atcEventBus.emit('SYSTEM_ACTION', { action, pVal: pVal as string | null });
          continue;
        }

        if (!actualUuid) continue;
        atcEventBus.emit('AGENT_ACTION', { action, actualUuid, pVal: pVal as string | null, agents: store.agents });
      }
      store.playSuccess();
      set((s) => ({ state: { ...s.state, pendingProposals: new Map() } }));
    } catch (err) {
      logger.error("AI Action Execution Failed:", err);
      store.addLog("❌ EXECUTION_FAILED: Please retry.", "critical", "SYSTEM");
      // NOTE: Clear pending proposals on failure to prevent stale state
      // NOTE: Clear pending proposals on failure
      set((s) => ({ state: { ...s.state, pendingProposals: new Map() } }));
    }
  },

  rejectProposals: () => {
    get().addLog(ATC_CONFIG.LOG_MSG.PROPOSAL_REJECT, "system", "SYSTEM");
    set((s) => ({ state: { ...s.state, pendingProposals: new Map() } }));
  },

  // NOTE: Added clear method for manual dismiss
  clearProposals: () => {
    set((s) => ({ state: { ...s.state, pendingProposals: new Map() } }));
  },
});
