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
  
  // NOTE: Stream Initialization
  useATCStream();

  // NOTE: Audio Initialization
  const { playAlert, playSuccess, playClick } = useAudio(isAdminMuted);
  
  useEffect(() => {
    useATCStore.setState({ playAlert, playSuccess, playClick });
  }, [playAlert, playSuccess, playClick]);

  // NOTE: Autonomy Risk Calculation
  const { riskScore, autonomyLevel, recordAction, checkDeltaSafety } = useAutonomy(state, agents, addLog);
  
  useEffect(() => {
    useATCStore.setState({ riskScore, autonomyLevel, recordAction });
  }, [riskScore, autonomyLevel, recordAction]);

  useEffect(() => {
    if (isAiAutoMode && checkDeltaSafety()) {
      triggerHandover(ATC_CONFIG.LOG_MSG.EARLY_EXIT);
    }
  }, [isAiAutoMode, checkDeltaSafety, triggerHandover]);

  
  useEffect(() => {
    
    
    let mounted = true;
    
    
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
  }, []); 

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
