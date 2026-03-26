// src/hooks/system/useATCSystem.ts
import { useState, useCallback } from 'react';
import { Agent, ATCState, LogEntry } from '@/contexts/atcTypes';

export const useATCSystem = () => {
  const [state, setState] = useState<ATCState>({
    holder: null, 
    waitingAgents: [], 
    priorityAgents: [],
    forcedCandidate: null,
    globalStop: false, 
    collisionCount: 0, 
    logs: [], 
    activeAgentCount: 3,
    overrideSignal: false, 
    latency: 24, 
    trafficIntensity: 3 
  });
  
  const [agents, setAgents] = useState<Agent[]>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', agentId: string = 'SYSTEM') => {
    const newLog: LogEntry = { 
      id: `ui-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, 
      agentId, 
      message: message.toUpperCase(),
      timestamp: Date.now(), 
      type 
    };

    setState(prev => ({ 
      ...prev, 
      logs: [...(prev.logs || []), newLog].slice(-200) 
    }));
  }, []);

  return { state, setState, agents, setAgents, addLog };
};