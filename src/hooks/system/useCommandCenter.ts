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
    const addLog = useATCStore(s => s.addLog);
    const playClick = useATCStore(s => s.playClick);
    const playAlert = useATCStore(s => s.playAlert);
    const isAiMode = useATCStore(s => s.isAiMode);
    const isAiAutoMode = useATCStore(s => s.isAiAutoMode);
    const approveProposals = useATCStore(s => s.approveProposals);
    const setIsAnalyzingStore = useATCStore(s => s.setIsAnalyzing);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const isAnalyzingRef = useRef(false);
    const analysisQueue = useRef<string[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { LOG_MSG, AI } = ATC_CONFIG;

    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [streamingText, setStreamingText] = useState("");
    const inputValueRef = useRef("");

    // NOTE: Sync ref with state
    useEffect(() => {
      inputValueRef.current = inputValue;
    }, [inputValue]);

    const setAnalysisState = useCallback((state: boolean) => {
      isAnalyzingRef.current = state;
      setIsAnalyzing(state);
      setIsAnalyzingStore(state);
    }, [setIsAnalyzingStore]);

    const handleAnalyze = useCallback(async (manualText?: string) => {
      const currentStoreState = useATCStore.getState();
      const agents = currentStoreState.agents;
      const state = currentStoreState.state;
      const isAiModeCurrent = currentStoreState.isAiMode;
      const isAiAutoModeCurrent = currentStoreState.isAiAutoMode;

      if (!isAiModeCurrent) return;
      const rawCommand = manualText || inputValueRef.current || "Analyze status.";

      // NOTE: Race Condition & Stale Audio Prevention (Abort Controller)
      // NOTE: Abort ongoing analysis to prevent audio overlapping and stale UI states
      if (isAnalyzingRef.current && abortControllerRef.current) {
        logger.warn("[AI_CALL_ABORT] 새로운 분석 요청으로 인해 이전 분석을 취소합니다.");
        abortControllerRef.current.abort("NEW_ANALYSIS_REQUESTED");
        // NOTE: Force stop any currently playing Kanana-o PCM audio or TTS when aborted
        audioService.stopAll();
        // NOTE: Clear queue on new threat detection
        analysisQueue.current = [];
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setAnalysisState(true);
      const commandText = applyPrivacyMasking(rawCommand);
      playClick();
      addLog(LOG_MSG.AI_THINKING, "insight", AI.THINKING_AGENT);

      // NOTE: Check if component unmounted or AI mode turned off during analysis
      // NOTE: to prevent queue deadlock where commands get stuck forever
      const isAlive = () => {
        const currentStoreState = useATCStore.getState();
        return currentStoreState.isAiMode && isAnalyzingRef.current;
      };

      try {
        currentStoreState.recordMetric?.('call');
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
        
        
        let finalImage = attachedImage;
        
        // NOTE: Optimize performance by using OffscreenCanvas Worker
        if (!finalImage) {
          // NOTE: Prevent capturing wrong canvases by explicitly targeting the Radar canvas
          const canvas = document.querySelector('canvas.radar-canvas') || document.querySelector('canvas');
          if (canvas) {
             try {
               const bitmap = await window.createImageBitmap(canvas);
               
               finalImage = await new Promise<string>((resolve, reject) => {
                 const worker = new Worker(new URL('../../workers/imageWorker.ts', import.meta.url), { type: 'module' });
                 
                 worker.onmessage = (e) => {
                   if (e.data.type === 'CAPTURE_SUCCESS') {
                     resolve(e.data.result);
                     worker.terminate();
                   } else if (e.data.type === 'CAPTURE_ERROR') {
                     reject(new Error(e.data.error));
                     worker.terminate();
                   }
                 };
                 
                 worker.onerror = (err) => {
                   reject(err);
                   worker.terminate();
                 };
                 
                 
                 worker.postMessage({ type: 'CAPTURE_CANVAS', payload: { bitmap, quality: 0.1 } }, [bitmap]);
               });
             } catch (err) {
               logger.warn("OffscreenCanvas Worker failed, falling back to sync toDataURL", err);
               finalImage = canvas.toDataURL('image/jpeg', 0.1); 
             }
          }
        }

        if (finalImage) {
          const userMsgIndex = fullPrompt.findIndex(msg => msg.role === 'user');
          if (userMsgIndex !== -1) {
            const textContent = fullPrompt[userMsgIndex].content as string;
            
            // NOTE: CONDITION: Differentiate Global Radar VS Local Camera context for LLM
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
        
        const result = await atcApi.askKanana({ messages: fullPrompt, signal: controller.signal }, (text, audioBase64) => {
          logger.debug("DEBUG: onChunk received text length:", text?.length);
          if (text) {
            
            if (text.startsWith(fullMessage) && fullMessage.length > 0) {
              fullMessage = text;
            } else {
              fullMessage += text;
            }
            setStreamingText(fullMessage);
          }
          if (audioBase64) {
            
            audioService.playPCM(audioBase64).catch(e => logger.error("PCM Play Error:", e));
          }
        });
        
        // NOTE: Use fullMessage if populated via stream, else use result.message
        const finalMessage = fullMessage || result.message || "";
        logger.debug("DEBUG: finalMessage is:", finalMessage.substring(0, 50));

        if (finalMessage) {
          const msg = finalMessage;
          const thought = aiParser.extractSection(msg, 'THOUGHT');
          const prediction = aiParser.extractSection(msg, 'PREDICTION');
          let report = aiParser.extractSection(msg, 'REPORT') || "";

          // NOTE: Visual Haptic Trigger
          const riskMatch = msg.match(/"risk_level"\s*:\s*(\d+)/) || msg.match(/\[RISK_LEVEL:(\d+)\]/);
          if (riskMatch && parseInt(riskMatch[1], 10) >= 8) {
              triggerVisualHaptic();
          }

          agents.forEach(agent => {
            if (report.includes(agent.uuid)) {
              report = report.replaceAll(agent.uuid, agent.displayName || agent.id);
            }
          });
          const proposals = aiParser.parseActions(msg, report || "Strategic Shift");

          useATCStore.getState().addAuditLog?.({
            prompt: (fullPrompt as unknown) as Record<string, unknown>,
            response: msg,
            reasoning: { thought: thought || "", prediction: prediction || "", report: report || "" },
            actions: proposals as unknown as import("@/contexts/atcTypes").ParsedAction[]
          });

          if (thought) addLog(`🧠 THOUGHT: ${thought}`, "insight", "SYSTEM");
          if (prediction) addLog(`🔮 PREDICTION: ${prediction}`, "proposal", "SYSTEM");
          
          // NOTE: Add warning if PREDICTION was skipped by AI to provide context to the operator
          if (!prediction && thought && proposals.length > 0) {
            addLog(`⚠️ AI_WARN: Prediction skipped. Generating proposals directly from THOUGHT.`, "warn", "SYSTEM");
          }

          // NOTE: Prevent duplicate logs when LMM ignores structured tags
          if (report && report !== thought) {
            addLog(`📋 REPORT: ${report}`, "exec", "SYSTEM");
          }
          else if (msg && !thought && proposals.length === 0) addLog(`📋 REPORT: ${msg}`, "exec", "SYSTEM");
          else if (msg && proposals.length > 0 && !report) addLog(`📋 REPORT: Actions executed based on analysis.`, "exec", "SYSTEM");
          
          if (proposals.length > 0) {
            addLog(LOG_MSG.AI_PROPOSALS_FOUND(proposals.length), "proposal", "SYSTEM");
            const proposalsMap = new Map();
            proposals.forEach(p => {
              proposalsMap.set(p.id, { ...p, type: 'proposal' });
            });
            // NOTE: Using setState from zustand correctly
            useATCStore.setState((prev) => ({ 
              state: { ...prev.state, pendingProposals: proposalsMap } 
            }));
            
            if (isAiAutoModeCurrent) {
              addLog(LOG_MSG.AI_AUTO_PILOT(proposals.length), "exec", "SYSTEM");
              queueMicrotask(() => approveProposals());
            } else {
              playAlert();
            }
          } else if (!thought && !report) {
            addLog(msg, "insight", "SYSTEM");
          }

          // NOTE: ACTION: Fallback to Web Speech API if Kanana Audio is disabled or if in Vercel environment
          const envAudio = import.meta.env?.VITE_USE_KANANA_AUDIO;
          const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
          if (envAudio !== 'true' && envAudio !== true || isVercel) {
            if (report) {
              // NOTE: Lite Version (Web Speech API)
              const cleanText = report.replace(/[<>[\]*_-]/g, '').trim();
              if (cleanText) {
                const langCode = /[가-힣]/.test(cleanText) ? 'ko-KR' : 'en-US';
                audioService.playTTS(cleanText, langCode);
              }
            }
          }
        }
        
        if (!manualText) {
          // NOTE: Use ref to clear input value to prevent Race Condition
          setInputValue(prev => prev === inputValueRef.current ? "" : prev);
          inputValueRef.current = "";
        }
        setAttachedImage(null);
      } catch (err: unknown) {
        const error = err as Error;
        const errMsg = error.message || "";
        
        // NOTE: Ignore Abort errors since they are intentional (triggered by a new request)
        if (error.name === 'AbortError' || errMsg === 'NEW_ANALYSIS_REQUESTED' || errMsg.includes('aborted')) {
          logger.debug("[AI_CALL] Previous analysis successfully aborted.");
          return;
        }

        let finalLog = LOG_MSG.ERR_GENERIC(errMsg.substring(0, 20)) || t('error.generic', '❌ AI_ERR: Unknown error');
        
        // NOTE: MAPPING: Parse error codes to localized strings
        if (errMsg.includes("MISSING_API_KEY")) finalLog = t('error.missingKey', 'AI 기능을 활성화하려면 Kanana-o API Key가 필요합니다.');
        else if (errMsg.includes("INVALID_API_KEY") || errMsg.includes("401")) finalLog = t('error.invalidKey', '유효하지 않은 키입니다. 콘솔에서 키를 다시 확인하세요.');
        else if (errMsg.includes("QUOTA") || errMsg.includes("429")) finalLog = t('error.quota', '금일 이용 쿼터를 모두 소진했습니다. 내일 00시에 초기화됩니다.');
        else if (errMsg.includes("FORBIDDEN_REQUEST")) {
          finalLog = t('error.forbidden', '해당 지시는 보안 가이드라인에 위배되어 거부되었습니다.');
          useATCStore.getState().recordMetric?.('jailbreak');
        }
        else if (errMsg.includes("SERVICE_TEMPORARILY_UNAVAILABLE") || errMsg.includes("500")) {
          finalLog = t('error.serverOverload', '현재 서버 요청 폭주로 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
        }
        else if (errMsg.includes("400")) finalLog = t('error.badRequest', '요청 형식이 올바르지 않습니다. 파라미터를 확인해 주세요.');
        else if (errMsg.includes("504") || errMsg.toUpperCase().includes("TIMEOUT") || errMsg.includes("AbortError")) finalLog = t('error.timeout', '요청 시간이 초과되었습니다. (Timeout)');

        addLog(finalLog, "critical", AI.NETWORK_AGENT);
 
         if (errMsg.includes("MISSING_API_KEY") || errMsg.includes("INVALID_API_KEY") || errMsg.includes("401")) {
           try {
             useUIStore.getState().openKananaKeyModal?.();
           } catch {}
         }
      } finally {
        // NOTE: Only clean up if this was the last active controller
        if (abortControllerRef.current === controller) {
          setAnalysisState(false);
          setStreamingText("");
          
          if (analysisQueue.current.length > 0 && useATCStore.getState().isAiMode) {
            const nextCommand = analysisQueue.current.shift();
            if (nextCommand) {
              queueMicrotask(() => handleAnalyze(nextCommand));
            }
          } else if (!useATCStore.getState().isAiMode) {
              analysisQueue.current = []; 
          }
        }
      }
    }, [addLog, playClick, playAlert, approveProposals, setAnalysisState, attachedImage, LOG_MSG, AI, i18n.language, t, triggerVisualHaptic]);
    
    // NOTE: EVENT: Trigger global analysis loop
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
