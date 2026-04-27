import { useMemo } from 'react';
import { Agent, ATCState } from '@/contexts/atcTypes';

/**
 * @param agent Target agent object
 * @param state Global ATC state
 */
export const useAgentLogic = (agent: Agent, state: ATCState) => {
  const agentId = String(agent.uuid || agent.id);
  const isLocked = String(state.holder) === agentId;
  
  const isPaused = useMemo(() => {
    const status = String(agent.status || '').toLowerCase();
    return status === 'paused' || agent.isPaused === true || state.globalStop === true;
  }, [agent.status, agent.isPaused, state.globalStop]);

  const isForced = String(state.forcedCandidate) === agentId;

  const isPriority = useMemo(() => {
    return !!agent.priority || (state.priorityAgents || []).map(id => String(id)).includes(agentId);
  }, [agent.priority, agentId, state.priorityAgents]);

  const isOverride = !!state.overrideSignal;

  const isWaiting = useMemo(() => 
    (state.waitingAgents || []).map(id => String(id)).includes(agentId) || agent.status === 'waiting',
    [state.waitingAgents, agentId, agent.status]
  );
  
  return {
    isLocked,
    isPaused,
    isForced,
    isPriority,
    isOverride,
    isWaiting,
    statusLabel: isOverride ? 'EMERGENCY' : 
                 isForced ? 'SEIZING...' : 
                 isPaused ? 'HALTED' : 
                 isLocked ? 'ACTIVE_CONTROL' : 
                 isWaiting ? 'IN_QUEUE' : 'STANDBY'
  };
};