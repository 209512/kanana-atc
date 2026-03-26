// src/hooks/agent/useAgentLogic.ts
import { useMemo } from 'react';
import { Agent, ATCState } from '@/contexts/atcTypes';

/**
 * @param agent 개별 에이전트 객체
 * @param state ATC 전역 상태
 */
export const useAgentLogic = (agent: Agent, state: ATCState) => {
  const s = useMemo(() => state || { 
    holder: null, 
    globalStop: false, 
    waitingAgents: [], 
    priorityAgents: [],
    forcedCandidate: null, 
    logs: [],
    overrideSignal: false 
  }, [state]);

  const agentId = useMemo(() => String(agent.uuid || agent.id), [agent.uuid, agent.id]);
  const isLocked = useMemo(() => String(s.holder) === agentId, [s.holder, agentId]);
  const isPaused = useMemo(() => {
    const status = String(agent.status || '').toLowerCase();
    return status === 'paused' || agent.isPaused === true || s.globalStop === true;
  }, [agent.status, agent.isPaused, s.globalStop]);

  const isForced = useMemo(() => String(s.forcedCandidate) === agentId, [s.forcedCandidate, agentId]);

  const isPriority = useMemo(() => {
    return !!agent.priority || (s.priorityAgents || []).map(id => String(id)).includes(agentId);
  }, [agent.priority, agentId, s.priorityAgents]);

  const isOverride = useMemo(() => !!s.overrideSignal, [s.overrideSignal]);

  const isWaiting = useMemo(() => 
    (s.waitingAgents || []).map(id => String(id)).includes(agentId) || agent.status === 'waiting',
    [s.waitingAgents, agentId, agent.status]
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