// src/hooks/system/useATCStream.ts
import { useEffect, useRef } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { Agent, ATCState, LogEntry } from '@/contexts/atcTypes';
import { BufferedAgent, BufferedState } from '@/workers/streamMerger.logic';
import { logger } from '@/utils/logger';

const STREAM_URL = '/api/stream';

export const useATCStream = () => {
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedLogIdsRef = useRef<Set<string>>(new Set()); // 처리된 로그 ID 추적
  const dataBuffer = useRef<{ agents: BufferedAgent[] | null, state: BufferedState | null }>({ agents: null, state: null });
  const workerRef = useRef<Worker | null>(null);
  const isWorkerBusy = useRef(false);
  const lastAutoTriggerRef = useRef<number>(0);
  const lastFlushTimeRef = useRef<number>(0);

  // 워커 초기화
  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/streamWorker.ts', import.meta.url), { type: 'module' });
    
    // 워커에서 처리된 결과를 받아 스토어에 반영
    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'STREAM_PROCESSED') {
        const store = useATCStore.getState();
        const { agents, state, locksToDelete } = payload as {
          agents: Agent[] | null;
          state: ATCState | null;
          locksToDelete: { uuid: string; field: string }[];
        };
        
        if (agents) {
          store.setAgents(() => {
            // 워커가 보낸 에이전트 목록에 현재 메인 스레드에 남아있는 낙관적 락(fieldLocks)을 다시 덧씌워
            // 워커가 미처 알지 못한 최신 락으로 인한 깜빡임(Flickering)을 완벽히 방지합니다.
            return agents.map(workerAgent => {
              const originalId = String(workerAgent.uuid || workerAgent.id);
              const locks = store.fieldLocks.get(originalId);
              if (locks) {
                const newAgent = { ...workerAgent };
                locks.forEach((lock, field) => {
                  (newAgent as Record<string, unknown>)[field] = lock.value;
                });
                return newAgent;
              }
              return workerAgent;
            });
          });
        }
        if (state) {
          store.setState((prev) => {
            const mergedProposals = prev.pendingProposals && prev.pendingProposals.size > 0
                ? prev.pendingProposals 
                : state.pendingProposals;

            const uniqueMap = new Map<string, LogEntry>();
            (state.logs || []).forEach((l: LogEntry) => uniqueMap.set(l.id, l));
            (prev.logs || []).forEach((l: LogEntry) => {
               if (String(l.id).startsWith('ui-') || String(l.id).startsWith('LOG-')) {
                   uniqueMap.set(l.id, l);
               }
            });
            const mergedLogs = Array.from(uniqueMap.values())
               .sort((a: LogEntry, b: LogEntry) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
            
            // 최적화: slice 전에 length 검사로 불필요한 배열 생성 방지
            const finalLogs = mergedLogs.length > 1000 ? mergedLogs.slice(-1000) : mergedLogs;

            const finalState = {
              ...state,
              pendingProposals: mergedProposals,
              logs: finalLogs
            };

            const globalLocks = store.fieldLocks.get('SYSTEM_GLOBAL');
            if (globalLocks) {
              globalLocks.forEach((lock, field) => {
                (finalState as Record<string, unknown>)[field] = lock.value;
              });
            }

            return finalState as ATCState;
          });
        }
        
        // 메인 스레드의 만료된 락 정리
        if (locksToDelete && locksToDelete.length > 0) {
          useATCStore.setState((s) => {
          // 메인 스레드에 보존된 락 객체 가져오기
          const newFieldLocks = new Map((s as { fieldLocks: Map<string, Map<string, { value: unknown, expiry: number }>> }).fieldLocks);
          locksToDelete.forEach(({ uuid, field }: { uuid: string, field: string }) => {
            const agentLocks = new Map(newFieldLocks.get(uuid) || new Map());
            if (agentLocks.has(field)) {
              agentLocks.delete(field);
              if (agentLocks.size === 0) {
                newFieldLocks.delete(uuid);
              } else {
                newFieldLocks.set(uuid, agentLocks);
              }
            }
          });
          return { fieldLocks: newFieldLocks };
        });
        }
        isWorkerBusy.current = false;
      } else if (type === 'ERROR') {
        // 워커 내부 에러 발생 시 이를 무시하지 않고 메인 스레드 로거와 상태에 반영 (Silent Failure 해결)
        logger.error('[WORKER_ERROR]', payload?.error || 'Unknown Error');
        const store = useATCStore.getState();
        if (store.addLog) {
          store.addLog(`Agent Worker Error: ${payload?.error || 'Unknown Error'}`, 'critical', 'SYSTEM');
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const flushBuffer = () => {
    if (isWorkerBusy.current || !workerRef.current) return;
    
    const { agents: bufferedAgents, state: bufferedState } = dataBuffer.current;
    if (!bufferedAgents && !bufferedState) return;

    isWorkerBusy.current = true;
    const now = Date.now();
    
    const store = useATCStore.getState();
    // 락 데이터를 직렬화 (Worker로 전달 시 복제 가능한 형태로 변환)
    // 에러나 복제 불가능한 객체(Error, Window, Function 등)가 섞여 DataCloneError를 유발하지 않도록 단순화된 구조로 매핑
    const serializedFieldLocks = Array.from(store.fieldLocks.entries()).map(([uuid, fields]) => [
      uuid, 
      Array.from(fields.entries()).map(([key, lockObj]) => [key, { value: lockObj.value, expiry: lockObj.expiry }])
    ]);

    workerRef.current.postMessage({
      type: 'PROCESS_STREAM',
      payload: {
        agents: bufferedAgents,
        state: bufferedState,
        now,
        deletedIds: Array.from(store.deletedIds),
        fieldLocks: serializedFieldLocks
      }
    });

    dataBuffer.current.agents = null;
    dataBuffer.current.state = null;
  };

  useEffect(() => {
    let eventSource: EventSource | null = null;
    const connect = () => {
      if (eventSource) eventSource.close();
      eventSource = new EventSource(STREAM_URL);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.agents) dataBuffer.current.agents = data.agents;
          if (data.state) {
            // Merge logs instead of overwriting to prevent data loss
            // 단, id를 기준으로 중복을 제거하여 배열 병합으로 인한 메모리 누수 방지
            const existingLogs = dataBuffer.current.state?.logs || [];
            const newLogs = data.state.logs || [];
            const mergedMap = new Map<string, LogEntry>();
            existingLogs.forEach((l: unknown) => { const log = l as LogEntry; mergedMap.set(log.id, log); });
            newLogs.forEach((l: unknown) => { const log = l as LogEntry; mergedMap.set(log.id, log); });
            
            const mergedLogs = Array.from(mergedMap.values()).slice(-1000); // Keep last 1000 logs
            
            dataBuffer.current.state = {
              ...data.state,
              logs: mergedLogs
            };

            // === Auto-Trigger 로직 (Event-Driven) ===
            // 최근 들어온 로그 중 [CONDITION:...] 태그가 포함된 위협/이벤트 감지 (모두 검사하되 처리된 것은 제외)
            const store = useATCStore.getState();
            if (store.isAiMode && store.isAiAutoMode && newLogs.length > 0) {
              
              // 주기적인 Set 크기 관리 (Memory Leak 방지)
              if (processedLogIdsRef.current.size > 1000) {
                const arr = Array.from(processedLogIdsRef.current).slice(-500);
                processedLogIdsRef.current.clear();
                arr.forEach(id => processedLogIdsRef.current.add(id));
              }

              const hasUnprocessedCondition = newLogs.some(
                (log: LogEntry) => {
                  const isCondition = log.message && log.message.includes('[CONDITION:') && log.type !== 'policy';
                  if (isCondition && !processedLogIdsRef.current.has(log.id)) {
                    processedLogIdsRef.current.add(log.id); // 처리됨으로 마킹
                    return true;
                  }
                  return false;
                }
              );
              
              if (hasUnprocessedCondition) {
                const now = Date.now();
                // 안전장치(Guardrail): 동일한 위협에 대해 10초 이내에는 재호출하지 않음 (Rate Limiting)
                if (now - lastAutoTriggerRef.current > 10000) {
                  lastAutoTriggerRef.current = now;
                  
                  // Kanana-O 자동 호출 ("분석해" 라는 트리거 명령어 대신 구체적인 상황 전달)
                  const triggerCommand = `A new event has been detected in the system logs. Analyze the logs and take immediate action.`;
                  
                  if (store.addLog) {
                    store.addLog("🚨 EVENT_TRIGGER: Auto-invoking Kanana-O for incident response...", "system", "SYSTEM");
                  }
                  
                  // 약간의 딜레이를 주어 UI가 렌더링된 후 호출되도록 함
                  autoTriggerTimeoutRef.current = setTimeout(() => {
                    // isAnalyzing 중이라도 큐에 담기도록 이벤트를 발송
                    window.dispatchEvent(new CustomEvent('AUTO_ANALYZE_TRIGGER', { detail: triggerCommand }));
                  }, 500);
                }
              }
            }
          }
          // 워커가 유휴 상태일 때만 처리 지시 (UI 렌더링 부하 및 드래그 랙 방지를 위해 10fps로 스로틀링)
          if (!isWorkerBusy.current) {
            if (Date.now() - lastFlushTimeRef.current > 100) {
              lastFlushTimeRef.current = Date.now();
              requestAnimationFrame(flushBuffer);
            }
          }
        } catch (err) { 
          logger.error("Stream Parsing Error:", err);
          // If stream data is corrupted, we might want to force a reconnect or just skip the bad chunk.
          // For now, we skip the bad chunk.
        }
      };
      eventSource.onerror = (e) => {
        // SSE 연결이 종료되었거나 에러가 발생한 경우 무한 재연결 루프 방지 및 조용히 닫기
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      if (eventSource) {
          eventSource.close();
          eventSource = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (autoTriggerTimeoutRef.current) clearTimeout(autoTriggerTimeoutRef.current);
    };
  }, []);
};