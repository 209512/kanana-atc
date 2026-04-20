// src/hooks/system/useAutonomy.ts
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

  // Optional: Update risk level visual indicator
  useEffect(() => {
    if (riskScore > RISK.EMERGENCY_LEVEL) {
      document.body.classList.add('emergency-pulse');
    } else {
      document.body.classList.remove('emergency-pulse');
    }
  }, [riskScore, RISK.EMERGENCY_LEVEL]);

  // Gemini 에이전트의 모드 스위칭을 위해 시뮬레이터에 riskScore 전달
  useEffect(() => {
    if (import.meta.env.VITE_USE_MSW === 'true') {
      // 전역 객체(window.msw)를 통해 MSW 워커 확인
      const msw = (window as any).msw;
      if (msw && msw.worker) {
        const newRiskLevel = Math.round(riskScore / 10);
        const currentRiskLevel = (useATCStore.getState().state as any)?.risk_level;
        
        // 값이 변경된 경우에만 상태를 업데이트하여 무한 리렌더링 루프 방지 (논리 오류 해결)
        // 불변성(Immutability)을 준수하여 새로운 상태 객체를 반환하도록 수정 (State Mutation 오류 해결)
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