// src/hooks/system/useAutonomy.ts
import { useMemo, useCallback, useEffect, useRef } from 'react';
import { Agent, ATCState } from '@/contexts/atcTypes';
import { ATC_CONFIG } from '@/constants/atcConfig';

export const useAutonomy = (state: ATCState, agents: Agent[], addLog: any) => {
  const riskHistory = useRef<number[]>([]);
  const lastActionTimestamp = useRef<number>(0);
  const { RISK, LOG_MSG, LEVELS } = ATC_CONFIG;

  const riskScore = useMemo(() => {
    const highLoad = agents.filter(a => {
      const loadVal = parseFloat(a.metrics?.load?.toString().replace('%', '') || '0');
      return loadVal > RISK.LOAD_THRESHOLD; 
    }).length;
    
    const latencySpikes = agents.filter(a => {
      const latVal = parseFloat(a.metrics?.lat?.replace('ms', '') || '0');
      return latVal > RISK.LATENCY_THRESHOLD; 
    }).length;

    const collisionPenalty = (state.collisionCount || 0) * RISK.PENALTY_COLLISION; 
    const agentDensityPenalty = Math.max(0, (agents.length - 10) * RISK.PENALTY_DENSITY);

    return Math.min(RISK.MAX_SCORE, (highLoad * 15) + (latencySpikes * 10) + collisionPenalty + agentDensityPenalty);
  }, [agents, state.collisionCount, RISK]);

  const checkDeltaSafety = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimestamp.current < RISK.COOL_DOWN_MS || lastActionTimestamp.current === 0) return false;
    if (now - lastActionTimestamp.current > RISK.TREND_MAX_AGE) return false;

    riskHistory.current.push(riskScore);
    if (riskHistory.current.length > RISK.TREND_WINDOW + 2) riskHistory.current.shift();

    if (riskHistory.current.length >= RISK.TREND_WINDOW) {
      const isWorsening = riskHistory.current.every((val, i, arr) => i === 0 || val >= arr[i-1]);
      if (isWorsening && riskScore > 60) {
        addLog(LOG_MSG.EARLY_EXIT, "critical", "KANANA-O");
        lastActionTimestamp.current = 0;
        return true; 
      }
    }
    return false;
  }, [riskScore, addLog, RISK, LOG_MSG]);

  const recordAction = () => {
    lastActionTimestamp.current = Date.now();
    riskHistory.current = [riskScore];
  };

  const autonomyLevel = useMemo(() => {
    if (riskScore > RISK.EMERGENCY_LEVEL) return LEVELS.EMERGENCY;
    if (riskScore > 50) return LEVELS.CAUTION;
    return LEVELS.NORMAL;
  }, [riskScore, RISK, LEVELS]);
  
  useEffect(() => {
    const isJustActioned = Date.now() - lastActionTimestamp.current < 500;
    if (!isJustActioned) {
      riskHistory.current.push(riskScore);
      if (riskHistory.current.length > RISK.HISTORY_LIMIT) riskHistory.current.shift();
    }
  }, [riskScore, RISK.HISTORY_LIMIT]);

  return { riskScore, autonomyLevel, recordAction, checkDeltaSafety };
};