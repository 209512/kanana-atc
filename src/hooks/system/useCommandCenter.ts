import { useState, useCallback, useEffect, useRef } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { atcApi } from '@/contexts/atcApi';
import { aiParser } from '@/utils/aiParser';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { ATC_PROMPTS } from '@/constants/prompts';
import { audioService } from '@/utils/audioService';
import { logger } from '@/utils/logger';
import { applyPrivacyMasking } from '@/utils/privacyFilter';
import { guardKananaOutput } from '@/utils/aiOutputGuard';

import { useTranslation } from 'react-i18next';

import { useUIStore } from '@/store/useUIStore';

export const useCommandCenter = () => {
    const { t, i18n } = useTranslation();
    const triggerVisualHaptic = useUIStore(s => s.triggerVisualHaptic);
    const addLog = useATCStore(s => s.addLog);
    const playClick = useATCStore(s => s.playClick);
    const playAlert = useATCStore(s => s.playAlert);
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
      const autonomyLevel = currentStoreState.autonomyLevel;
      const isAiModeCurrent = currentStoreState.isAiMode;
      const isAiAutoModeCurrent = currentStoreState.isAiAutoMode;

      if (!isAiModeCurrent) return;
      const rawCommand = manualText || inputValueRef.current || "Analyze status.";
      const isAutoTrigger = rawCommand.trim().startsWith('[AUTO_TRIGGER]');
      if (isAnalyzingRef.current && abortControllerRef.current) {
        logger.warn("[AI_CALL_ABORT] 새로운 분석 요청으로 인해 이전 분석을 취소합니다.");
        abortControllerRef.current.abort("NEW_ANALYSIS_REQUESTED");
        audioService.stopAll();
        analysisQueue.current = [];
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setAnalysisState(true);
      audioService.stopAll();
      const commandText = applyPrivacyMasking(rawCommand);
      playClick();
      addLog(LOG_MSG.AI_THINKING, "insight", AI.THINKING_AGENT);

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

        const selected = new Map<string, any>();
        const pickAgent = (id: string | null | undefined) => {
          if (!id) return;
          const found = agents.find((a) => a.uuid === id || a.id === id || a.displayName === id);
          if (!found) return;
          if (selected.has(found.uuid)) return;
          if (selected.size >= 3) return;
          selected.set(found.uuid, found);
        };

        const holderId = state.holder;
        if (holderId && holderId !== 'USER') {
          pickAgent(holderId);
        }

        for (const p of (state.priorityAgents || []).slice(0, 3)) {
          pickAgent(p);
        }

        const conditionAgentIds = (state.logs || [])
          .filter((l: any) => l?.message?.includes?.('[CONDITION:') && l?.agentId)
          .slice(-10)
          .reverse()
          .map((l: any) => String(l.agentId));
        for (const id of conditionAgentIds) {
          pickAgent(id);
        }

        const fallbackAgents = [...agents].sort((a, b) => {
          const loadA = parseFloat(String(a.metrics?.load || '0').replace('%', ''));
          const loadB = parseFloat(String(b.metrics?.load || '0').replace('%', ''));
          if (loadB !== loadA) return loadB - loadA;
          const latA = parseFloat(String(a.metrics?.lat || '0').replace('ms', ''));
          const latB = parseFloat(String(b.metrics?.lat || '0').replace('ms', ''));
          return latB - latA;
        });
        for (const a of fallbackAgents) {
          if (selected.size >= 3) break;
          if (selected.has(a.uuid)) continue;
          selected.set(a.uuid, a);
        }

        const reportAgents = Array.from(selected.values()).slice(0, 3);

        const fieldReports: any[] = [];
        for (const a of reportAgents) {
          try {
            const report = await atcApi.askGemini({
              agentId: a.uuid,
              agentName: a.displayName || a.id || a.name,
              externalData: {
                risk_level: Math.round((currentStoreState.riskScore || 0) / 10),
                load: a.metrics?.load,
                lat: a.metrics?.lat,
              },
              state: {
                logs: (state.logs || [])
                  .filter((l) => l.agentId === a.uuid)
                  .slice(-5)
                  .map((l) => ({ ts: l.timestamp, msg: applyPrivacyMasking(l.message) })),
              }
            });
            if (report) fieldReports.push(report);
          } catch {
          }
        }

        const fullPrompt = ATC_PROMPTS.buildFullPrompt(radarContext, commandText, autonomyLevel);
        if (fieldReports.length > 0) {
          fullPrompt.splice(1, 0, { role: 'system', content: `<field_reports_json>${JSON.stringify(fieldReports)}</field_reports_json>` });
        }
        
        
        let finalImage = attachedImage;
        if (!finalImage && !isAutoTrigger) {
          const canvas = (document.querySelector('canvas.radar-canvas') || document.querySelector('canvas')) as HTMLCanvasElement | null;
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
        let receivedAudioChunk = false;
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
            
            receivedAudioChunk = true;
            audioService.playPCM(audioBase64).catch(e => logger.error("PCM Play Error:", e));
          }
        });
        const finalMessage = fullMessage || result.message || "";
        logger.debug("DEBUG: finalMessage is:", finalMessage.substring(0, 50));

        if (finalMessage) {
          const msg = finalMessage;
          const thought = aiParser.extractSection(msg, 'THOUGHT');
          const prediction = aiParser.extractSection(msg, 'PREDICTION');
          let report = aiParser.extractSection(msg, 'REPORT') || "";
          const riskMatch = msg.match(/"risk_level"\s*:\s*(\d+)/) || msg.match(/\[RISK_LEVEL:(\d+)\]/);
          if (riskMatch && parseInt(riskMatch[1], 10) >= 8) {
              triggerVisualHaptic();
          }

          agents.forEach(agent => {
            if (report.includes(agent.uuid)) {
              report = report.replaceAll(agent.uuid, agent.displayName || agent.id);
            }
          });
          let proposals = aiParser.parseActions(msg, report || "Strategic Shift");
          const guard = guardKananaOutput(msg, report, proposals as any, agents as any, currentStoreState.riskScore || 0);
          if (guard.blocked) {
            const store = useATCStore.getState();
            store.triggerHandover?.(guard.reason || "OUTPUT_POLICY_VIOLATION");
            addLog(LOG_MSG.HANDOVER(guard.reason || "OUTPUT_POLICY_VIOLATION"), "critical", "SYSTEM");
            return;
          }
          report = guard.report;
          proposals = guard.proposals as any;

          useATCStore.getState().addAuditLog?.({
            prompt: (fullPrompt as unknown) as Record<string, unknown>,
            response: guard.message,
            reasoning: { thought: thought || "", prediction: prediction || "", report: report || "" },
            actions: proposals as unknown as import("@/contexts/atcTypes").ParsedAction[]
          });

          if (thought) addLog(`🧠 THOUGHT: ${thought}`, "insight", "SYSTEM");
          if (prediction) addLog(`🔮 PREDICTION: ${prediction}`, "proposal", "SYSTEM");
          if (!prediction && thought && proposals.length > 0) {
            addLog(`⚠️ AI_WARN: Prediction skipped. Generating proposals directly from THOUGHT.`, "warn", "SYSTEM");
          }
          if (report && report !== thought) {
            addLog(`📋 REPORT: ${report}`, "exec", "SYSTEM");
          }
          else if (msg && !thought && proposals.length === 0) addLog(`📋 REPORT: ${msg}`, "exec", "SYSTEM");
          else if (msg && proposals.length > 0 && !report) addLog(`📋 REPORT: Actions executed based on analysis.`, "exec", "SYSTEM");
          
          if (proposals.length > 0) {
            const detailedProposals = proposals.map((p) => `[${p.action}: ${p.targetId}]`).join(', ');
            addLog(`🤖 AI_PROPOSALS(${proposals.length}): ${detailedProposals}`, "proposal", "SYSTEM");
            const proposalsMap = new Map();
            proposals.forEach(p => {
              proposalsMap.set(p.id, { ...p, type: 'proposal' });
            });
            useATCStore.setState((prev) => ({ 
              state: { ...prev.state, pendingProposals: proposalsMap } 
            }));
            
            if (isAiAutoModeCurrent) {
              addLog(LOG_MSG.AI_AUTO_PILOT(proposals.length), "exec", "SYSTEM");
              const store = useATCStore.getState();
              const onlyRecoveryActions = proposals.every((p) => ['START', 'RELEASE'].includes(String((p as any).action || '').toUpperCase()));
              const blocked =
                !!store.state.handoverTarget ||
                !!store.state.overrideSignal ||
                (store.state.globalStop && !onlyRecoveryActions);

              if (blocked) {
                const reason = store.state.handoverTarget
                  ? String(store.state.handoverTarget)
                  : store.state.overrideSignal
                    ? 'MANUAL_OVERRIDE_ACTIVE'
                    : 'GLOBAL_STOP_ACTIVE';
                addLog(LOG_MSG.HANDOVER(reason), "warn", "SYSTEM");
                playAlert();
              } else {
                queueMicrotask(() => approveProposals());
              }
            } else {
              playAlert();
            }
          } else if (!thought && !report) {
            addLog(msg, "insight", "SYSTEM");
          }

          const hasAudio = receivedAudioChunk || !!result.audio;
          if (!hasAudio && report) {
            const cleanText = report.replace(/[<>[\]*_-]/g, '').trim();
            if (cleanText) {
              const langCode = /[가-힣]/.test(cleanText) ? 'ko-KR' : 'en-US';
              audioService.playTTS(cleanText, langCode);
            }
          }
        }
        
        if (!manualText) {
          setInputValue(prev => prev === inputValueRef.current ? "" : prev);
          inputValueRef.current = "";
        }
        setAttachedImage(null);
      } catch (err: unknown) {
        const error = err as Error;
        const errMsg = error.message || "";
        if (error.name === 'AbortError' || errMsg === 'NEW_ANALYSIS_REQUESTED' || errMsg.includes('aborted')) {
          logger.debug("[AI_CALL] Previous analysis successfully aborted.");
          return;
        }

        let finalLog = LOG_MSG.ERR_GENERIC(errMsg.substring(0, 20)) || t('error.generic', '❌ AI_ERR: Unknown error');
        if (errMsg.includes("MISSING_API_KEY")) finalLog = t('error.missingKey', 'AI 기능을 활성화하려면 Kanana-o API Key가 필요합니다.');
        else if (errMsg.includes("INVALID_API_KEY") || errMsg.includes("401")) finalLog = t('error.invalidKey', '유효하지 않은 키입니다. 콘솔에서 키를 다시 확인하세요.');
        else if (errMsg.includes("QUOTA") || errMsg.includes("429")) finalLog = t('error.quota', '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.');
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
