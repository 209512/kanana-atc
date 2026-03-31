// src/hooks/system/useATCActions.ts
import { useCallback } from 'react';
import { atcApi } from '@/contexts/atcApi';
import { Agent, ATCState } from '@/contexts/atcTypes';

export const useATCActions = (
  agents: Agent[],
  state: ATCState,
  setState: React.Dispatch<React.SetStateAction<ATCState>>,
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>,
  markAction: any,
  addLog: any,
  playClick: any,
  playAlert: any,
  playSuccess: any
) => {
  const setTrafficIntensity = useCallback((val: number) => {
    const minRequired = state.priorityAgents?.length || 1;
    const finalValue = Math.max(minRequired, Math.floor(val));

    if (finalValue !== state.trafficIntensity) {
      playClick();
      atcApi.scaleAgents(finalValue)
        .then(() => {
          setState(prev => ({ ...prev, trafficIntensity: finalValue }));
        })
        .catch(() => {
          playAlert();
        });
    }
  }, [state.trafficIntensity, state.priorityAgents, setState, playClick, playAlert]);

  const togglePause = useCallback((uuid: string) => {
    playClick();
    // 클라이언트 Resolver: uuid뿐만 아니라 displayName으로도 탐색 가능하도록 수정
    const target = agents.find(a => 
      a.uuid === uuid || a.id === uuid || a.displayName === uuid
    );
    if (!target) return;

    const actualUuid = target.uuid;
    const nextPaused = !target.isPaused;
    markAction(actualUuid, 'isPaused', nextPaused);
    
    atcApi.togglePause(actualUuid, nextPaused)
      .catch(() => {
        playAlert();
        markAction(actualUuid, 'isPaused', !nextPaused); 
      });
  }, [agents, markAction, playClick, playAlert]);

  const togglePriority = useCallback((uuid: string) => {
    const target = agents.find(a => 
      a.uuid === uuid || a.id === uuid || a.displayName === uuid
    );
    if (!target) return;

    const actualUuid = target.uuid;
    const nextPriority = !target.priority;
    nextPriority ? playSuccess() : playClick();
    markAction(actualUuid, 'priority', nextPriority);

    atcApi.togglePriority(actualUuid, nextPriority)
      .catch(() => {
        playAlert();
        markAction(actualUuid, 'priority', !nextPriority); 
      });
  }, [agents, markAction, playClick, playSuccess, playAlert]);

  const terminateAgent = useCallback((uuid: string) => {
    if (agents.length <= 1) {
      playAlert();
      return;
    }
    playClick();

    const target = agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
    const actualUuid = target?.uuid || uuid;

    markAction(actualUuid, '', null, true);

    atcApi.terminateAgent(actualUuid)
      .then(() => {
        setState(prev => ({ ...prev, trafficIntensity: Math.max(0, agents.length - 1) }));
      })
      .catch(() => {
        playAlert();
        markAction(actualUuid, '', null, false);
      });
  }, [agents.length, agents, setState, markAction, playClick, playAlert]);

  const transferLock = useCallback((uuid: string) => {
    playAlert();
    const target = agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
    const actualUuid = target?.uuid || uuid;

    markAction('', 'forcedCandidate', actualUuid);
    markAction('', 'holder', null); 
    
    atcApi.transferLock(actualUuid).catch(() => {
      markAction('', 'forcedCandidate', null);
    });
  }, [agents, markAction, playAlert]);

  const toggleGlobalStop = useCallback(() => {
    playAlert();
    const nextStop = !state.globalStop;
    markAction('', 'globalStop', nextStop);
    atcApi.toggleGlobalStop(nextStop).catch(() => markAction('', 'globalStop', !nextStop));
  }, [state.globalStop, markAction, playAlert]);

  const triggerOverride = useCallback(async () => {
    playAlert();
    markAction('', 'overrideSignal', true);
    markAction('', 'holder', 'USER');
    return atcApi.triggerOverride().catch(() => {
      markAction('', 'overrideSignal', false);
      markAction('', 'holder', null);
    });
  }, [playAlert, markAction]);

  const releaseLock = useCallback(async () => {
    playSuccess();
    markAction('', 'overrideSignal', false);
    markAction('', 'holder', null);
    return atcApi.releaseLock().catch(() => {
      markAction('', 'overrideSignal', true);
      markAction('', 'holder', 'USER');
    });
  }, [playSuccess, markAction]);

  const handleRename = useCallback(async (uuid: string, newName: string) => {
    if (!newName) return;
    const target = agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
    const actualUuid = target?.uuid || uuid;

    markAction(actualUuid, 'displayName', newName); 
    try {
      await atcApi.renameAgent(actualUuid, newName);
      playSuccess();
    } catch {
      playAlert();
      markAction(actualUuid, 'displayName', null);
    }
  }, [agents, markAction, playSuccess, playAlert]);

  const updateAgentConfig = useCallback(async (uuid: string, config: any) => {
    const target = agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
    const actualUuid = target?.uuid || uuid;

    setAgents(prev => prev.map(a => a.uuid === actualUuid ? { ...a, ...config } : a));
    try {
      await atcApi.updateConfig(actualUuid, config);
      playSuccess();
    } catch {
      playAlert();
    }
  }, [agents, setAgents, playSuccess, playAlert]);

  return {
    setTrafficIntensity, togglePause, togglePriority, terminateAgent,
    transferLock, toggleGlobalStop, triggerOverride, releaseLock,
    handleRename, updateAgentConfig
  };
};