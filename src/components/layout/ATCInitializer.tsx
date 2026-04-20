// src/components/layout/ATCInitializer.tsx
import React, { useEffect } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { useATCStream } from '@/hooks/system/useATCStream';
import { useAudio } from '@/hooks/system/useAudio';
import { useAutonomy } from '@/hooks/system/useAutonomy';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';

export const ATCInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useATCStore(s => s.state);
  const agents = useATCStore(s => s.agents);
  const isAdminMuted = useATCStore(s => s.isAdminMuted);
  const isAiAutoMode = useATCStore(s => s.isAiAutoMode);
  const triggerHandover = useATCStore(s => s.triggerHandover);
  const addLog = useATCStore(s => s.addLog);
  
  const { scaleAgents } = useAgentMutations();
  
  // 1. Stream Initialization
  useATCStream();

  // 2. Audio Initialization
  const { playAlert, playSuccess, playClick } = useAudio(isAdminMuted);
  
  useEffect(() => {
    useATCStore.setState({ playAlert, playSuccess, playClick });
  }, [playAlert, playSuccess, playClick]);

  // 3. Autonomy Risk Calculation
  const { riskScore, autonomyLevel, recordAction, checkDeltaSafety } = useAutonomy(state, agents, addLog);
  
  useEffect(() => {
    useATCStore.setState({ riskScore, autonomyLevel, recordAction });
  }, [riskScore, autonomyLevel, recordAction]);

  useEffect(() => {
    if (isAiAutoMode && checkDeltaSafety()) {
      triggerHandover(ATC_CONFIG.LOG_MSG.EARLY_EXIT);
    }
  }, [isAiAutoMode, checkDeltaSafety, triggerHandover]);

  // 4. Initial Scale (Stale Closure Bug 해결)
  useEffect(() => {
    // scaleAgents 호출 시 Zustand 스토어 업데이트 및 서버 요청이 이루어지므로,
    // Strict Mode 환경(개발 모드)에서 2번 렌더링되면서 중복 호출되지 않도록 방어 로직 추가
    let mounted = true;
    
    // 컴포넌트 마운트 시 최신 상태를 Zustand Store에서 직접 조회하여 Stale Closure 방지
    const currentState = useATCStore.getState().state;
    const currentAgents = useATCStore.getState().agents;

    if (currentState.activeAgentCount === 0 && currentState.trafficIntensity > 0 && mounted) {
      if (currentAgents.length === 0 && !useATCStore.getState().isInitializing) {
        useATCStore.setState({ isInitializing: true });
        scaleAgents.mutate(currentState.trafficIntensity, {
          onSettled: () => useATCStore.setState({ isInitializing: false })
        });
      }
    }
    return () => { mounted = false; };
  }, []); // 마운트 시 1회만 실행하되 최신 상태를 직접 조회하므로 무한 루프 위험 제거

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b82f655; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6aa; }
      `}</style>
      {children}
    </>
  );
};
