// src/contexts/ATCProvider.tsx
import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useATCSystem } from '@/hooks/system/useATCSystem';
import { useATCStream } from '@/hooks/system/useATCStream'; 
import { atcApi, setApiMode } from '@/contexts/atcApi';
import { useAudio } from '@/hooks/system/useAudio';
import { useAutonomy } from '@/hooks/system/useAutonomy';
import { useATCActions } from '@/hooks/system/useATCActions';
import { Agent, ATCState } from '@/contexts/atcTypes';
import { ATC_CONFIG } from '@/constants/atcConfig';

export interface ATCContextType {
  state: ATCState;
  agents: Agent[];
  setState: React.Dispatch<React.SetStateAction<ATCState>>;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  updateAgentConfig: (uuid: string, config: any) => Promise<void>;
  isAdminMuted: boolean;
  setIsAdminMuted: React.Dispatch<React.SetStateAction<boolean>>;
  toggleAdminMute: () => void;
  toggleGlobalStop: () => void;
  togglePause: (uuid: string) => void;
  togglePriority: (uuid: string) => void;
  transferLock: (uuid: string) => void;
  terminateAgent: (uuid: string) => void;
  markAction: (uuid: string, field: string, value: any, isDelete?: boolean) => void;
  setTrafficIntensity: (val: number) => void;
  triggerOverride: () => Promise<any>;
  releaseLock: () => Promise<any>;
  playAlert: () => void;
  playClick: () => void;
  addLog: (message: string, type: any, agentId?: string) => void;
  updatePriorityOrder: (newOrder: string[]) => void;
  renameAgent: (uuid: string, newName: string) => Promise<void>;
  submitRename: (uuid: string, newName: string) => Promise<void>;
  isAiMode: boolean;
  toggleAiMode: (isAi: boolean) => Promise<void>;
  pendingProposals: any | null; 
  approveProposals: () => Promise<void>;
  rejectProposals: () => void;
  isAiAutoMode: boolean;
  toggleAiAutoMode: () => void;
  riskScore: number;
  autonomyLevel: number;
  handoverTarget: string | null;
  resetHandover: () => void;
  aiQuota: number;
}

export const ATCContext = createContext<ATCContextType | null>(null);

export const ATCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, setState, agents, setAgents, addLog } = useATCSystem();
  const { markAction } = useATCStream(setState, setAgents);
  const [isAiMode, setIsAiMode] = useState(false);
  const [isAdminMuted, setIsAdminMuted] = useState(false);
  const [isAiAutoMode, setIsAiAutoMode] = useState(false);
  
  const { playAlert, playSuccess, playClick } = useAudio(isAdminMuted);
  const { riskScore, autonomyLevel, recordAction, checkDeltaSafety } = useAutonomy(state, agents, addLog);

  const actions = useATCActions(
    agents, state, setState, setAgents, markAction, addLog, 
    playClick, playAlert, playSuccess
  );

  useEffect(() => {
    if (state.activeAgentCount === 0 && state.trafficIntensity > 0) {
      atcApi.scaleAgents(state.trafficIntensity).catch(() => {});
    }
  }, []);

  const [aiQuota, setAiQuota] = useState(20);
  useEffect(() => {
    const unsubscribe = atcApi.subscribeQuota((newQuota) => {
      setAiQuota(newQuota);
    });
    return () => unsubscribe();
  }, [])

  // const findUuid = useCallback((idOrName: string) => {
  //   if (!idOrName || idOrName === 'SYSTEM') return idOrName;
  //   const searchKey = String(idOrName).trim().toUpperCase();
    
  //   const byUuid = agents.find(a => String(a.uuid).toUpperCase() === searchKey);
  //   if (byUuid) return byUuid.uuid;

  //   const byName = agents.find(a => 
  //     String(a.displayName || '').toUpperCase() === searchKey ||
  //     String(a.name || '').toUpperCase() === searchKey
  //   );
  //   if (byName) return byName.uuid;

  //   const byId = agents.find(a => String(a.id).toUpperCase() === searchKey);
  //   return byId?.uuid;
  // }, [agents]);
  const findUuid = useCallback((idOrName: string) => {
    if (!idOrName) return null;
    const key = String(idOrName).trim().toUpperCase();
    
    if (['SYSTEM', 'GLOBAL', 'USER'].includes(key)) return key;
    
    const byUuid = agents.find(a => a.uuid.toUpperCase() === key);
    if (byUuid) return byUuid.uuid;

    const found = agents.find(a => 
      (a.displayName || '').toUpperCase() === key || 
      a.id.toUpperCase() === key
    );
    return found?.uuid || null;
  }, [agents]);

  // const executeActionWithGuardrail = useCallback(async (proposal: any) => {
  //   if (!proposal || !proposal.action) return false;

  //   const { action, targetId, value: pVal } = proposal;
  //   const actualUuid = findUuid(targetId);
  //   console.log(`[AI_EXEC_ATTEMPT] Action: ${action}, TargetInput: ${targetId}, FoundUUID: ${actualUuid}`);
  //   const agent = agents.find(a => a.uuid === actualUuid);

  //   if (!agent && !['SYSTEM', 'USER'].includes(targetId)) return false;

  //   try {
  //     switch (action) {
  //       case 'PAUSE': 
  //         if (actualUuid && agent && !agent.isPaused) await actions.togglePause(actualUuid); 
  //         break;
  //       case 'RESUME': 
  //         if (actualUuid && agent && agent.isPaused) await actions.togglePause(actualUuid); 
  //         break;
  //       case 'PRIORITY': 
  //         if (actualUuid && agent && !agent.priority) await actions.togglePriority(actualUuid); 
  //         break;
  //       case 'REVOKE': 
  //         if (actualUuid && agent && agent.priority) await actions.togglePriority(actualUuid); 
  //         break;
  //       case 'TRANSFER': 
  //         if (actualUuid) await actions.transferLock(actualUuid); 
  //         break;
  //       case 'TERMINATE': 
  //         if (actualUuid) await actions.terminateAgent(actualUuid); 
  //         break;
  //       case 'RENAME': 
  //         if (actualUuid && pVal) await actions.handleRename(actualUuid, String(pVal)); 
  //         break;
  //       case 'STOP': 
  //         if (!state.globalStop) await actions.toggleGlobalStop(); 
  //         break;
  //       case 'START': 
  //         if (state.globalStop) await actions.toggleGlobalStop(); 
  //         break;
  //       case 'SCALE': 
  //         if (pVal !== undefined) await actions.setTrafficIntensity(Number(pVal)); 
  //         break;
  //       case 'OVERRIDE': 
  //         await actions.triggerOverride(); 
  //         break;
  //       case 'RELEASE': 
  //         await actions.releaseLock(); 
  //         break;
  //       default:
  //         return false;
  //     }
  //     recordAction();
  //     return true;
  //   } catch (err) {
  //     console.warn(`[AI_EXEC_FAIL] Action: ${proposal.action} | Reason: ${err}`);
  //     return false;
  //   }
  // }, [agents, state.globalStop, findUuid, actions, recordAction]);
  
  const executeActionWithGuardrail = useCallback(async (proposal: any) => {
    if (!proposal || !proposal.action) return false;

    const { action, targetId, value: pVal } = proposal;
    const targetKey = String(targetId).toUpperCase();
    const actualUuid = findUuid(targetId);

    try {
      if (targetKey === 'SYSTEM' || targetKey === 'GLOBAL') {
        if (action === 'SCALE') return await actions.setTrafficIntensity(Number(pVal));
        if (action === 'STOP') return await actions.toggleGlobalStop();
        if (action === 'START') return await actions.toggleGlobalStop();
        if (action === 'OVERRIDE') return await actions.triggerOverride();
        if (action === 'RELEASE') return await actions.releaseLock();
      }

      if (!actualUuid) return false;
      const agent = agents.find(a => a.uuid === actualUuid);

      switch (action) {
        case 'PAUSE': 
          if (agent && !agent.isPaused) await actions.togglePause(actualUuid); 
          break;
        case 'RESUME': 
          if (agent && agent.isPaused) await actions.togglePause(actualUuid); 
          break;
        case 'PRIORITY': 
          if (agent && !agent.priority) await actions.togglePriority(actualUuid); 
          break;
        case 'REVOKE': 
          if (agent && agent.priority) await actions.togglePriority(actualUuid); 
          break;
        case 'RENAME': 
          if (pVal) await actions.handleRename(actualUuid, String(pVal)); 
          break;
        case 'TERMINATE': 
          await actions.terminateAgent(actualUuid); 
          break;
        case 'TRANSFER': 
          await actions.transferLock(actualUuid); 
          break;
        default: return false;
      }
      recordAction();
      return true;
    } catch (err) {
      console.error(`[EXEC_ERR] ${action} on ${targetId}:`, err);
      return false;
    }
  }, [agents, findUuid, actions, recordAction]);

  const approveProposals = useCallback(async () => {
    const proposals = state.pendingProposals;
    if (!proposals || proposals.length === 0) return;
    
    addLog(ATC_CONFIG.LOG_MSG.PROPOSAL_EXEC(proposals.length), "exec", "SYSTEM");
    
    try {
      await atcApi.executeProposals(proposals);
      
      for (const prop of proposals) {
        await executeActionWithGuardrail(prop);
      }
      playSuccess();
    } catch (err) {
      console.error("AI Action Execution Failed:", err);
      addLog("❌ EXECUTION_FAILED", "critical", "SYSTEM");
    } finally {
      setState(prev => ({ ...prev, pendingProposals: [] }));
    }
  }, [state.pendingProposals, executeActionWithGuardrail, setState, addLog, playSuccess]);

  const handleModeToggle = useCallback(async (isAi: boolean) => {
    setApiMode(isAi);
    setIsAiMode(isAi);
    if (!isAi) {
        setIsAiAutoMode(false);
        setState(prev => ({ ...prev, pendingProposals: [] }));
    }
    addLog(isAi ? ATC_CONFIG.LOG_MSG.AI_MODE_ON : ATC_CONFIG.LOG_MSG.AI_MODE_OFF, 
           isAi ? "insight" : "system", "SYSTEM");
  }, [addLog, setState]);

  const resetHandover = useCallback(() => {
    playClick();
    setIsAiAutoMode(false); 
    setState(prev => ({ ...prev, handoverTarget: null }));
    addLog(ATC_CONFIG.LOG_MSG.RECOVERY_COMPLETE, "success", "USER");
  }, [playClick, setState, addLog]);

  const triggerHandover = useCallback((reason: string) => {
    const topEmergency = [...agents].sort((a, b) => 
      parseFloat(b.metrics?.load || '0') - parseFloat(a.metrics?.load || '0')
    )[0];
    
    addLog(ATC_CONFIG.LOG_MSG.HANDOVER(reason), "critical", "SYSTEM");
    
    playAlert();
    setIsAiAutoMode(false);
    setState(prev => ({ ...prev, handoverTarget: topEmergency?.uuid || 'SYSTEM' }));
  }, [agents, addLog, playAlert, setState]);

  useEffect(() => {
    if (isAiAutoMode && checkDeltaSafety()) {
      triggerHandover(ATC_CONFIG.LOG_MSG.EARLY_EXIT);
    }
  }, [isAiAutoMode, checkDeltaSafety, triggerHandover]);

  const value = useMemo(() => ({
    state, agents, setState, setAgents, ...actions,
    isAdminMuted, setIsAdminMuted, toggleAdminMute: () => setIsAdminMuted(prev => !prev),
    markAction, addLog, playAlert, playClick,
    updatePriorityOrder: (newOrder: string[]) => {
      markAction('', 'priorityAgents', newOrder);
      atcApi.updatePriorityOrder(newOrder).catch(() => {});
    },
    renameAgent: actions.handleRename,
    submitRename: actions.handleRename,
    pendingProposals: state.pendingProposals,
    approveProposals, 
    rejectProposals: () => {
      playClick();
      addLog(ATC_CONFIG.LOG_MSG.PROPOSAL_REJECT, "warn", "USER");
      setState(prev => ({ ...prev, pendingProposals: [] }));
    },
    isAiMode, toggleAiMode: handleModeToggle,
    isAiAutoMode, toggleAiAutoMode: () => {
      playClick();
      setIsAiAutoMode(prev => !prev);
    },
    riskScore, autonomyLevel,
    handoverTarget: state.handoverTarget,
    resetHandover, aiQuota,
  }), [state, agents, actions, aiQuota, isAdminMuted, isAiMode, isAiAutoMode, riskScore, autonomyLevel, approveProposals, handleModeToggle, resetHandover, markAction, addLog, playAlert, playClick, setState]);

  return (
    <ATCContext.Provider value={value}>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b82f655; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6aa; }
      `}</style>
      {children}
    </ATCContext.Provider>
  );
};