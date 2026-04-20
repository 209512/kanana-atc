// src/hooks/system/useCommandCenter.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { atcApi } from '@/contexts/atcApi';
import { aiParser } from '@/utils/aiParser';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { ATC_PROMPTS } from '@/constants/prompts';
import { audioService } from '@/utils/audioService';
import { logger } from '@/utils/logger';
import { applyPrivacyMasking } from '@/utils/privacyFilter';

import { useTranslation } from 'react-i18next';

import { useUIStore } from '@/store/useUIStore';

export const useCommandCenter = () => {
    const { t, i18n } = useTranslation();
    const triggerVisualHaptic = useUIStore(s => s.triggerVisualHaptic);
    const agents = useATCStore(s => s.agents);
    const state = useATCStore(s => s.state);
    const addLog = useATCStore(s => s.addLog);
    const playClick = useATCStore(s => s.playClick);
    const playAlert = useATCStore(s => s.playAlert);
    const isAiMode = useATCStore(s => s.isAiMode);
    const isAiAutoMode = useATCStore(s => s.isAiAutoMode);
    const approveProposals = useATCStore(s => s.approveProposals);
    const setState = useATCStore(s => s.setState);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const isAnalyzingRef = useRef(false);
    const analysisQueue = useRef<string[]>([]);
    const { LOG_MSG, AI } = ATC_CONFIG;

    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [streamingText, setStreamingText] = useState("");

    const handleAnalyze = useCallback(async (manualText?: string) => {
      if (!isAiMode) return;
      const rawCommand = manualText || inputValue || "Analyze status.";

      if (isAnalyzingRef.current) {
        analysisQueue.current.push(rawCommand);
        logger.debug("Command queued due to ongoing analysis:", rawCommand);
        return;
      }

      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      const commandText = applyPrivacyMasking(rawCommand);
      playClick();
      addLog(LOG_MSG.AI_THINKING, "insight", AI.THINKING_AGENT);

      try {
        useATCStore.getState().recordMetric?.('call');
        const radarContext = {
          timestamp: Date.now(),
          global_status: { stop_active: state.globalStop, intensity: state.trafficIntensity, active_count: agents.length },
          agents: agents.map(a => ({ 
            uuid: a.uuid, id: a.displayName || a.id, status: a.status, 
            isPaused: !!a.isPaused, priority: !!a.priority, 
            load: a.metrics?.load || '0%', lat: a.metrics?.lat || '0ms',
            logs: state.logs?.filter(l => l.agentId === a.uuid).slice(-3) || [] 
          }))
        };

        const fullPrompt = ATC_PROMPTS.buildFullPrompt(radarContext, commandText, state.autonomyLevel, i18n.language);
        
        // 첨부된 이미지가 있으면 user 메시지에 이미지 추가
        let finalImage = attachedImage;
        
        // 4. "중간의 텍스트 로그 단계를 생략하고, Kanana-O가 드론의 바이너리 상태 데이터를 직접 스트리밍으로 읽어들이는 방식으로 진화"
        // 명시적으로 캡처된 이미지가 없더라도, 항상 현재 레이더의 상태를 캡처하여 Kanana-O에게 바이너리 데이터(이미지)로 전송
        if (!finalImage) {
          const canvas = document.querySelector('canvas');
          if (canvas) {
             finalImage = canvas.toDataURL('image/jpeg', 0.5); // 압축률을 높여 전송 지연 및 페이로드 크기 최적화
          }
        }

        if (finalImage) {
          const userMsgIndex = fullPrompt.findIndex(msg => msg.role === 'user');
          if (userMsgIndex !== -1) {
            const textContent = fullPrompt[userMsgIndex].content as string;
            
            // 만약 사용자가 이미지를 직접 첨부했다면 (attachedImage가 있다면), 
            // 이는 "드론의 시야(Local Camera)"가 아니라 사용자가 첨부한 "외부 상황" 이미지일 가능성이 큼
            // 반면 레이더 캡처 화면은 "관제탑의 전역 시야(Global Radar)"임.
            // 두 시야의 한계를 프롬프트에 명시적으로 구분하여 제공
            const isRadarCapture = finalImage !== attachedImage;
            const contextNote = isRadarCapture 
              ? "[DIRECT_SENSOR_STREAM_ACTIVE] 이 이미지는 개별 드론의 카메라(Local)가 아닌, 관제탑의 전역 레이더(Global) 시각 캡처본입니다. 점이 겹쳐 보이거나 문제가 없는 상황이라면, 반드시 텍스트로 전달된 개별 드론 센서 로그(<radar_data>)를 최우선으로 신뢰하여 판단하세요."
              : "[USER_ATTACHED_IMAGE] 사용자가 직접 첨부한 현장 상황 이미지입니다. 텍스트 로그와 함께 이 시각적 증거를 분석하여 판단하세요.";

            fullPrompt[userMsgIndex].content = [
              { type: "image_url", image_url: { url: finalImage } },
              { type: "text", text: `${contextNote}\n\n${textContent}` }
            ];
          }
        }

        let fullMessage = "";
        setStreamingText("");
        
        const result = await atcApi.askKanana({ messages: fullPrompt }, (text, audioBase64) => {
          logger.debug("DEBUG: onChunk received text length:", text?.length);
          if (text) {
            fullMessage += text;
            setStreamingText(fullMessage);
          }
          if (audioBase64) {
            // chunk된 오디오 데이터를 받자마자 바로 큐에 넣어서 재생
            audioService.playPCM(audioBase64).catch(e => logger.error("PCM Play Error:", e));
          }
        });
        
        // Use fullMessage if populated via stream, else use result.message
        const finalMessage = fullMessage || result.message || "";
        logger.debug("DEBUG: finalMessage is:", finalMessage.substring(0, 50));

        if (finalMessage) {
          const msg = finalMessage;
          const thought = aiParser.extractSection(msg, 'THOUGHT');
          const prediction = aiParser.extractSection(msg, 'PREDICTION');
          let report = aiParser.extractSection(msg, 'REPORT') || "";

          // Visual Haptic Trigger
          const riskMatch = msg.match(/"risk_level"\s*:\s*(\d+)/) || msg.match(/\[RISK_LEVEL:(\d+)\]/);
          if (riskMatch && parseInt(riskMatch[1], 10) >= 8) {
              triggerVisualHaptic();
          }

          agents.forEach(agent => {
            if (report.includes(agent.uuid)) {
              report = report.replaceAll(agent.uuid, agent.displayName || agent.id);
            }
          });
          const lastKnownGoodActions = useATCStore.getState().lastKnownGoodActions || [];
          const proposals = aiParser.parseActions(msg, report || "Strategic Shift", lastKnownGoodActions);

          useATCStore.getState().addAuditLog?.({
            prompt: (fullPrompt as unknown) as Record<string, unknown>,
            response: msg,
            reasoning: { thought: "", prediction: "", report: report || "" },
            actions: proposals as unknown as import("@/contexts/atcTypes").ParsedAction[]
          });

          if (thought) addLog(`🧠 THOUGHT: ${thought}`, "insight", AI.THINKING_AGENT);
          if (prediction) addLog(`🔮 PREDICTION: ${prediction}`, "proposal", AI.THINKING_AGENT);
          if (report) addLog(`📋 REPORT: ${report}`, "exec", AI.SYSTEM_AGENT);
          
          if (proposals.length > 0) {
            // Update last known good actions
            if (useATCStore.getState().setLastKnownGoodActions) {
              (useATCStore.getState() as any).setLastKnownGoodActions(proposals as unknown as import("@/contexts/atcTypes").ParsedAction[]);
            }
            
            addLog(LOG_MSG.AI_PROPOSALS_FOUND(proposals.length), "proposal", AI.SYSTEM_AGENT);
            const proposalsMap = new Map();
            proposals.forEach(p => {
              proposalsMap.set(p.id, { ...p, type: 'proposal' });
            });
            setState(prev => ({ ...prev, pendingProposals: proposalsMap }));
            
            if (isAiAutoMode) {
              addLog(LOG_MSG.AI_AUTO_PILOT(proposals.length), "exec", AI.SYSTEM_AGENT);
              queueMicrotask(() => approveProposals());
            } else {
              playAlert();
            }
          } else if (!thought && !report) {
            addLog(msg, "insight", AI.THINKING_AGENT);
          }

          // 오디오 처리 (Kanana-O 오디오 직접 활용 or Web Speech API)
          if (!import.meta.env.VITE_USE_KANANA_AUDIO || import.meta.env.VITE_USE_KANANA_AUDIO !== 'true') {
            if (report) {
              // Lite Version (Web Speech API)
              const cleanText = report.replace(/[<>[\]*_-]/g, '').trim();
              if (cleanText) {
                const langCode = /[가-힣]/.test(cleanText) ? 'ko-KR' : 'en-US';
                audioService.playTTS(cleanText, langCode);
              }
            }
          }
        }
        
        if (!manualText) {
          setInputValue(prev => prev === rawCommand ? "" : prev);
        }
        setAttachedImage(null);
      } catch (err: unknown) {
        const error = err as Error;
        const errMsg = error.message || "";
        
        let finalLog = LOG_MSG.ERR_GENERIC(errMsg.substring(0, 20)) || t('error.generic');
        
        // 에러코드 명세 반영
        if (errMsg.includes("MISSING_API_KEY")) finalLog = "AI 기능을 활성화하려면 Kanana-o API Key가 필요합니다.";
        else if (errMsg.includes("INVALID_API_KEY")) finalLog = "유효하지 않은 키입니다. 콘솔에서 키를 다시 확인하세요.";
        else if (errMsg.includes("QUOTA")) finalLog = "금일 이용 쿼터를 모두 소진했습니다. 내일 00시에 초기화됩니다.";
        else if (errMsg.includes("FORBIDDEN_REQUEST")) {
          finalLog = "해당 지시는 보안 가이드라인에 위배되어 거부되었습니다.";
          useATCStore.getState().recordMetric?.('jailbreak');
        }
        else if (errMsg.includes("SERVICE_TEMPORARILY_UNAVAILABLE")) {
          finalLog = "현재 서버 요청 폭주로 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
        }
        else if (errMsg.includes("400")) finalLog = "요청 형식이 올바르지 않습니다. 파라미터를 확인해 주세요.";
        else if (errMsg.includes("401")) finalLog = "유효하지 않은 키입니다. 콘솔에서 키를 다시 확인하세요.";
        else if (errMsg.includes("429")) finalLog = "금일 이용 쿼터를 모두 소진했습니다. 내일 00시에 초기화됩니다.";
        else if (errMsg.includes("500")) finalLog = "현재 서버 요청 폭주로 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
        else if (errMsg.includes("504") || errMsg.toUpperCase().includes("TIMEOUT") || errMsg.includes("AbortError")) finalLog = t('error.timeout');

        addLog(finalLog, "critical", AI.NETWORK_AGENT);
 
         if (errMsg.includes("MISSING_API_KEY") || errMsg.includes("INVALID_API_KEY") || errMsg.includes("401")) {
           try {
             useUIStore.getState().openKananaKeyModal?.();
           } catch {}
         }
      } finally {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
        setStreamingText("");
        if (analysisQueue.current.length > 0) {
          const nextCommand = analysisQueue.current.shift();
          if (nextCommand) {
            setTimeout(() => handleAnalyze(nextCommand), 300);
          }
        }
      }
    }, [isAiMode, inputValue, agents, state, isAiAutoMode, addLog, playClick, playAlert, approveProposals, setState, attachedImage, LOG_MSG, AI, i18n.language, t, triggerVisualHaptic]);
    
    // 워커 스레드나 타 시스템 파트에서 발생하는 AUTO_ANALYZE_TRIGGER 이벤트를 감지하여 자동 분석 실행 (Silent Failure 해결)
  useEffect(() => {
    const handleAutoAnalyze = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      handleAnalyze(customEvent.detail || "Auto risk detection and tactical analysis request");
    };
    
    const handleAttachImage = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setAttachedImage(customEvent.detail);
      }
    };

    window.addEventListener('AUTO_ANALYZE_TRIGGER', handleAutoAnalyze);
    window.addEventListener('ATTACH_IMAGE', handleAttachImage);
    
    return () => {
        window.removeEventListener('AUTO_ANALYZE_TRIGGER', handleAutoAnalyze);
        window.removeEventListener('ATTACH_IMAGE', handleAttachImage);
    };
  }, [handleAnalyze]);

  return { inputValue, setInputValue, isAnalyzing, handleAnalyze, attachedImage, setAttachedImage, streamingText };
};
