import { useMemo, useCallback, useEffect, useRef } from 'react';
import { Agent, ATCState } from '@/contexts/atcTypes';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { useATCStore } from '@/store/useATCStore';

export const useAutonomy = (state: ATCState, agents: Agent[], addLog: any) => {
  const riskHistory = useRef<number[]>([]);
  const lastActionTimestamp = useRef<number>(0);
  const { RISK, LOG_MSG, LEVELS } = ATC_CONFIG;

  const riskScore = useMemo(() => {
    const highLoad = agents.filter(a => {
      const loadVal = parseFloat(String(a.metrics?.load || '0').replace('%', ''));
      return loadVal > RISK.LOAD_THRESHOLD; 
    }).length;
    
    const latencySpikes = agents.filter(a => {
      const latVal = parseFloat(String(a.metrics?.lat || '0').replace('ms', ''));
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

    
    // NOTE: Calculate trend based on the latest riskScore
    const currentHistory = [...riskHistory.current, riskScore];

    if (currentHistory.length >= RISK.TREND_WINDOW) {
      const isWorsening = currentHistory.slice(-RISK.TREND_WINDOW).every((val, i, arr) => i === 0 || val >= arr[i-1]);
      if (isWorsening && riskScore > LEVELS.CAUTION) {
        addLog(LOG_MSG.EARLY_EXIT, "critical", "KANANA-O");
        lastActionTimestamp.current = 0;
        return true; 
      }
    }
    return false;
  }, [riskScore, addLog, RISK, LOG_MSG, LEVELS]);

  const recordAction = () => {
    lastActionTimestamp.current = Date.now();
    riskHistory.current = [riskScore];
  };

  const autonomyLevel = useMemo(() => {
    if (riskScore > RISK.EMERGENCY_LEVEL) return LEVELS.EMERGENCY;
    if (riskScore > LEVELS.CAUTION) return LEVELS.CAUTION;
    return LEVELS.NORMAL;
  }, [riskScore, RISK, LEVELS]);
  
  useEffect(() => {
    const isJustActioned = Date.now() - lastActionTimestamp.current < 500;
    if (!isJustActioned) {
      riskHistory.current.push(riskScore);
      if (riskHistory.current.length > RISK.HISTORY_LIMIT) riskHistory.current.shift();
    }
  }, [riskScore, RISK.HISTORY_LIMIT]);

  // NOTE: Sync riskScore with global store (MSW mode)
  useEffect(() => {
    if (import.meta.env.VITE_USE_MSW === 'true') {
      const msw = (window as any).msw;
      if (msw && msw.worker) {
        const newRiskLevel = Math.round(riskScore / 10);
        const currentRiskLevel = (useATCStore.getState().state as any)?.risk_level;
        
        if (currentRiskLevel !== newRiskLevel) {
          useATCStore.setState((s: any) => ({
            state: { ...s.state, risk_level: newRiskLevel }
          }));
        }
      }
    }
  }, [riskScore]);

  return { riskScore, autonomyLevel, recordAction, checkDeltaSafety };
};