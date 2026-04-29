import { useEffect, useRef } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { Agent, ATCState, LogEntry } from '@/contexts/atcTypes';
import { BufferedAgent, BufferedState } from '@/workers/streamMerger.logic';
import { logger } from '@/utils/logger';

import { getSafeBaseUrl } from '@/utils/apiClient';
import { ATC_CONFIG } from '@/constants/atcConfig';

const getStreamUrl = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const baseUrl = envBaseUrl ? getSafeBaseUrl(envBaseUrl) : '';
  return `${baseUrl}/api/stream`;
};

export const useATCStream = () => {
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedLogTimestampRef = useRef<number>(0); 
  const dataBuffer = useRef<{ agents: BufferedAgent[] | null, state: BufferedState | null }>({ agents: null, state: null });
  const workerRef = useRef<Worker | null>(null);
  const isWorkerBusy = useRef(false);
  const lastAutoTriggerRef = useRef<number>(0);
  const lastFlushTimeRef = useRef<number>(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/streamWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'STREAM_PROCESSED') {
        const { agents, state, locksToDelete } = payload as {
          agents: Agent[] | null;
          state: ATCState | null;
          locksToDelete: { uuid: string; field: string }[];
        };
        
        useATCStore.setState((s) => {
          const next: Record<string, unknown> = {};

          if (agents) {
            const deletedIds = s.deletedIds;
            const fieldLocks = s.fieldLocks;
            next.agents = agents
              .map((workerAgent) => {
                const originalId = String(workerAgent.uuid || workerAgent.id);
                const locks = fieldLocks.get(originalId);
                if (!locks) return workerAgent;
                const newAgent = { ...workerAgent } as Record<string, unknown>;
                locks.forEach((lock, field) => {
                  newAgent[field] = lock.value;
                });
                return newAgent as unknown as Agent;
              })
              .filter((a) => !deletedIds.has(String(a.uuid || a.id)));
          }

          if (state) {
            const prev = s.state;
            const mergedProposals = prev.pendingProposals && prev.pendingProposals.size > 0 ? prev.pendingProposals : new Map();

            const uniqueMap = new Map<string, LogEntry>();
            (state.logs || []).forEach((l: LogEntry) => uniqueMap.set(l.id, l));
            (prev.logs || []).forEach((l: LogEntry) => {
              if (String(l.id).startsWith('ui-') || String(l.id).startsWith('LOG-')) {
                uniqueMap.set(l.id, l);
              }
            });

            const mergedLogs = Array.from(uniqueMap.values()).sort(
              (a: LogEntry, b: LogEntry) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)
            );
            const maxLogs = ATC_CONFIG.LOGS?.MAX_DISPLAY || 1000;
            const finalLogs = mergedLogs.length > maxLogs ? mergedLogs.slice(-maxLogs) : mergedLogs;

            const finalState: Record<string, unknown> = {
              ...state,
              pendingProposals: mergedProposals,
              logs: finalLogs,
            };

            const globalLocks = s.fieldLocks.get('SYSTEM_GLOBAL');
            if (globalLocks) {
              globalLocks.forEach((lock, field) => {
                finalState[field] = lock.value;
              });
            }

            next.state = finalState as unknown as ATCState;
          }

          if (locksToDelete && locksToDelete.length > 0) {
            const newFieldLocks = new Map(s.fieldLocks);
            locksToDelete.forEach(({ uuid, field }) => {
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
            next.fieldLocks = newFieldLocks;
          }

          return next as unknown as Partial<typeof s>;
        });
        isWorkerBusy.current = false;
        if (dataBuffer.current.agents || dataBuffer.current.state) {
          flushBuffer();
        }
      } else if (type === 'ERROR') {
        logger.error('[WORKER_ERROR]', payload?.error || 'Unknown Error');
        const store = useATCStore.getState();
        if (store.addLog) {
          store.addLog(`Agent Worker Error: ${payload?.error || 'Unknown Error'}`, 'critical', 'SYSTEM');
        }
        isWorkerBusy.current = false;
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
      eventSource = new EventSource(getStreamUrl());
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.agents) {
            const existingAgents = dataBuffer.current.agents || [];
            const newAgents = data.agents || [];
            const mergedAgentsMap = new Map();
            existingAgents.forEach((a: BufferedAgent) => mergedAgentsMap.set(a.uuid || a.id, a));
            newAgents.forEach((a: BufferedAgent) => mergedAgentsMap.set(a.uuid || a.id, a));
            dataBuffer.current.agents = Array.from(mergedAgentsMap.values());
          }
          if (data.state) {
            const existingLogs = dataBuffer.current.state?.logs || [];
            const newLogs = data.state.logs || [];
            const mergedMap = new Map<string, LogEntry>();
            existingLogs.forEach((l: unknown) => { const log = l as LogEntry; mergedMap.set(log.id, log); });
            newLogs.forEach((l: unknown) => { const log = l as LogEntry; mergedMap.set(log.id, log); });
            
            const mergedLogs = Array.from(mergedMap.values())
               .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
               .slice(-(ATC_CONFIG.LOGS?.MAX_DISPLAY || 1000));
            
            dataBuffer.current.state = {
              ...data.state,
              logs: mergedLogs
            };

            const store = useATCStore.getState();
            if (store.isAiMode && store.isAiAutoMode && newLogs.length > 0) {
              
              const unprocessedConditions = newLogs.filter(
                (log: LogEntry) => {
                  const isCondition = log.message && log.message.includes('[CONDITION:') && log.type !== 'policy';
                  const ts = typeof log.timestamp === 'number' ? log.timestamp : log.timestamp.getTime();
                  return isCondition && ts > lastProcessedLogTimestampRef.current;
                }
              );
              
              if (unprocessedConditions.length > 0) {
                lastProcessedLogTimestampRef.current = Math.max(...unprocessedConditions.map((l: LogEntry) => Number(l.timestamp) || 0));
                const now = Date.now();
                const cooldownMs = ATC_CONFIG.AI?.ANALYSIS_COOLDOWN_MS || 10000;
                if (now - lastAutoTriggerRef.current > cooldownMs) {
                  lastAutoTriggerRef.current = now;
                  
                  const latest = unprocessedConditions[unprocessedConditions.length - 1];
                  const conditionLine = String(latest?.message || '').slice(0, 300);
                  const agentName = String(latest?.agentName || latest?.agentId || 'AGENT');

                  const triggerCommand =
                    `[AUTO_TRIGGER]\n` +
                    `[DETECTED_LOG] ${agentName} ${conditionLine}\n` +
                    `자동 관제 이벤트가 감지되었습니다. 아래 조건을 기준으로 즉시 분석 및 조치하십시오.\n` +
                    `- 로그에 [CONDITION:] 또는 [RISK_LEVEL:]가 존재하면 이를 최우선으로 반영하십시오.\n` +
                    `- <THOUGHT>, <PREDICTION>, <REPORT>, <ACTIONS> 4개 섹션을 반드시 포함하십시오.\n` +
                    `- 조치가 필요하면 <ACTIONS>에는 반드시 유효한 JSON 배열로 1개 이상 액션을 포함하십시오.\n` +
                    `- 조치가 불필요하면 <ACTIONS>[]</ACTIONS>로 명시하십시오.`;
                  
                  if (store.addLog) {
                    store.addLog("🚨 EVENT_TRIGGER: Auto-invoking Kanana-O for incident response...", "system", "SYSTEM");
                  }
                  
                  if (autoTriggerTimeoutRef.current) clearTimeout(autoTriggerTimeoutRef.current);
                  autoTriggerTimeoutRef.current = setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('AUTO_ANALYZE_TRIGGER', { detail: triggerCommand }));
                  }, ATC_CONFIG.SIMULATOR.AUTO_ANALYZE_DELAY_MS);
                }
              }
            }
          }
          if (!isWorkerBusy.current) {
            if (Date.now() - lastFlushTimeRef.current > ATC_CONFIG.SIMULATOR.STREAM_FLUSH_THROTTLE_MS) {
              lastFlushTimeRef.current = Date.now();
              if (typeof window !== 'undefined') {
                requestAnimationFrame(flushBuffer);
              } else {
                setTimeout(flushBuffer, 16);
              }
            }
          }
        } catch (err) { 
          logger.error("Stream Parsing Error:", err, "Raw Data:", event.data);
        }
      };
      eventSource.onerror = () => {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (autoTriggerTimeoutRef.current) clearTimeout(autoTriggerTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, ATC_CONFIG.SIMULATOR.STREAM_RECONNECT_MS);
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
