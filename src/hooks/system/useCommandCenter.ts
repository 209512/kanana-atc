// src/hooks/system/useCommandCenter.ts
import { useState, useCallback } from 'react';
import { useATC } from '@/hooks/system/useATC';
import { atcApi } from '@/contexts/atcApi';
import { aiParser } from '@/utils/aiParser';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { ATC_PROMPTS } from '@/constants/prompts';

export const useCommandCenter = () => {
    const { 
        agents, state, addLog, playClick, playAlert,
        isAiMode, isAiAutoMode, approveProposals, setState 
    } = useATC();
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const { LOG_MSG, AI } = ATC_CONFIG;

    const handleAnalyze = useCallback(async (manualText?: string) => {
      if (!isAiMode || isAnalyzing) return;
      const commandText = manualText || inputValue || "Analyze status.";
      setIsAnalyzing(true);
      playClick();
      addLog(LOG_MSG.AI_THINKING, "insight", AI.THINKING_AGENT);

      try {
        const radarContext = {
          timestamp: Date.now(),
          global_status: { stop_active: state.globalStop, intensity: state.trafficIntensity, active_count: agents.length },
          agents: agents.map(a => ({ 
            uuid: a.uuid, id: a.displayName || a.id, status: a.status, 
            isPaused: !!a.isPaused, priority: !!a.priority, 
            load: a.metrics?.load || '0%', lat: a.metrics?.lat || '0ms' 
          }))
        };

        const fullPrompt = ATC_PROMPTS.buildFullPrompt(radarContext, commandText, state.autonomyLevel);
        const result = await atcApi.askKanana({ messages: fullPrompt });
        console.log("DEBUG: CommandCenter에 도착한 결과 ->", result);

        if (result.message) {
          const msg = result.message;
          const thought = aiParser.extractSection(msg, 'THOUGHT');
          const prediction = aiParser.extractSection(msg, 'PREDICTION');
          // const report = aiParser.extractSection(msg, 'REPORT');
          let report = aiParser.extractSection(msg, 'REPORT');

          agents.forEach(agent => {
            if (report.includes(agent.uuid)) {
              report = report.replaceAll(agent.uuid, agent.displayName || agent.id);
            }
          });
          const proposals = aiParser.parseActions(msg, report || "Strategic Shift");

          if (thought) addLog(`🧠 THOUGHT: ${thought}`, "insight", AI.THINKING_AGENT);
          if (prediction) addLog(`🔮 PREDICTION: ${prediction}`, "insight", AI.THINKING_AGENT);
          if (report) addLog(`📋 REPORT: ${report}`, "info", AI.SYSTEM_AGENT);
          
          if (proposals.length > 0) {
            addLog(LOG_MSG.AI_PROPOSALS_FOUND(proposals.length), "proposal", AI.SYSTEM_AGENT);
            const taggedProposals = proposals.map(p => ({
                ...p,
                type: 'proposal' 
            }));
            setState(prev => ({ ...prev, pendingProposals: taggedProposals }));
            
            if (isAiAutoMode) {
              addLog(LOG_MSG.AI_AUTO_PILOT(proposals.length), "exec", AI.SYSTEM_AGENT);
              queueMicrotask(() => approveProposals());
            } else {
              playAlert();
            }
          } else if (!thought && !report) {
            addLog(msg, "insight", AI.THINKING_AGENT);
          }
        }
        setInputValue("");
      } catch (err: any) {
        const errMsg = err.message || "";
        let finalLog = LOG_MSG.ERR_GENERIC(errMsg.substring(0, 20));
        
        if (errMsg.includes("QUOTA")) finalLog = LOG_MSG.AI_QUOTA_EXCEEDED;
        else if (errMsg.includes("429")) finalLog = LOG_MSG.ERR_429;
        else if (errMsg.includes("500")) finalLog = LOG_MSG.ERR_500;

        addLog(finalLog, "critical", AI.NETWORK_AGENT);
      } finally {
        setIsAnalyzing(false);
      }
    }, [isAiMode, isAnalyzing, inputValue, agents, state, isAiAutoMode, addLog, playClick, playAlert, approveProposals, setState]);
    
    return { inputValue, setInputValue, isAnalyzing, handleAnalyze };
};