import { useEffect, useRef } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { Agent, ATCState, LogEntry } from '@/contexts/atcTypes';
import { BufferedAgent, BufferedState } from '@/workers/streamMerger.logic';
import { logger } from '@/utils/logger';

import { getSafeBaseUrl } from '@/utils/apiClient';
import { ATC_CONFIG } from '@/constants/atcConfig';

const getStreamUrl = () => {
  const envBaseUrl = import.meta.env?.VITE_API_BASE_URL || '';
  const baseUrl = envBaseUrl ? getSafeBaseUrl(envBaseUrl) : '';
  return `${baseUrl}/api/stream`;
};

export const useATCStream = () => {
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // NOTE: Timestamp-based watermark to prevent GC race conditions completely
  const lastProcessedLogTimestampRef = useRef<number>(0); 
  const dataBuffer = useRef<{ agents: BufferedAgent[] | null, state: BufferedState | null }>({ agents: null, state: null });
  const workerRef = useRef<Worker | null>(null);
  const isWorkerBusy = useRef(false);
  const lastAutoTriggerRef = useRef<number>(0);
  const lastFlushTimeRef = useRef<number>(0);

  // NOTE: Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/streamWorker.ts', import.meta.url), { type: 'module' });
    
    // NOTE: Receive processed results and update store
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
            // NOTE: Re-apply optimistic UI field locks to prevent flickering
            // NOTE: Prevent deleted agents from reappearing from worker state
            // NOTE: Filter out agents deleted in main thread
            const deletedIds = store.deletedIds;
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
            }).filter(a => !deletedIds.has(String(a.uuid || a.id))); // Ensure deleted agents stay dead
          });
        }
        if (state) {
          store.setState((prev) => {
            // NOTE: Prioritize client-side pendingProposals over MSW state to prevent overwrite
            const mergedProposals = prev.pendingProposals && prev.pendingProposals.size > 0
                ? prev.pendingProposals 
                : new Map();

            const uniqueMap = new Map<string, LogEntry>();
            (state.logs || []).forEach((l: LogEntry) => uniqueMap.set(l.id, l));
            (prev.logs || []).forEach((l: LogEntry) => {
               if (String(l.id).startsWith('ui-') || String(l.id).startsWith('LOG-')) {
                   uniqueMap.set(l.id, l);
               }
            });
            const mergedLogs = Array.from(uniqueMap.values())
               .sort((a: LogEntry, b: LogEntry) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
            
            // NOTE: Optimize log slicing to prevent array creation overhead
            const maxLogs = ATC_CONFIG.LOGS?.MAX_DISPLAY || 1000;
            const finalLogs = mergedLogs.length > maxLogs ? mergedLogs.slice(-maxLogs) : mergedLogs;

            const finalState = {
              ...state,
              // NOTE: Actually use the mergedProposals variable instead of strictly forcing prev.pendingProposals
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
        
        // NOTE: Clean up expired locks from main thread
        if (locksToDelete && locksToDelete.length > 0) {
          useATCStore.setState((s) => {
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
        // NOTE: Flush buffer immediately after worker finishes to prevent UI rendering delays
        if (dataBuffer.current.agents || dataBuffer.current.state) {
          flushBuffer();
        }
      } else if (type === 'ERROR') {
        // NOTE: Prevent silent worker failures by logging to main thread and releasing lock
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
    // NOTE: Serialize lock data for Worker postMessage
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
            // NOTE: Merge agents using Map to prevent dropping intermittent updates while worker is busy
            const existingAgents = dataBuffer.current.agents || [];
            const newAgents = data.agents || [];
            const mergedAgentsMap = new Map();
            existingAgents.forEach((a: BufferedAgent) => mergedAgentsMap.set(a.uuid || a.id, a));
            newAgents.forEach((a: BufferedAgent) => mergedAgentsMap.set(a.uuid || a.id, a));
            dataBuffer.current.agents = Array.from(mergedAgentsMap.values());
          }
          if (data.state) {
            // NOTE: Merge logs based on ID to prevent data loss
            const existingLogs = dataBuffer.current.state?.logs || [];
            const newLogs = data.state.logs || [];
            const mergedMap = new Map<string, LogEntry>();
            existingLogs.forEach((l: unknown) => { const log = l as LogEntry; mergedMap.set(log.id, log); });
            newLogs.forEach((l: unknown) => { const log = l as LogEntry; mergedMap.set(log.id, log); });
            
            // NOTE: Sort logs by timestamp before slicing to prevent data loss on network jitter
            const mergedLogs = Array.from(mergedMap.values())
               .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
               .slice(-1000);
            
            dataBuffer.current.state = {
              ...data.state,
              logs: mergedLogs
            };

            // NOTE: Event-Driven Auto-Trigger Logic
            const store = useATCStore.getState();
            if (store.isAiMode && store.isAiAutoMode && newLogs.length > 0) {
              
              // NOTE: Process logs exactly once via timestamp watermark
              const unprocessedConditions = newLogs.filter(
                (log: LogEntry) => {
                  const isCondition = log.message && log.message.includes('[CONDITION:') && log.type !== 'policy';
                  return isCondition && log.timestamp > lastProcessedLogTimestampRef.current;
                }
              );
              
              if (unprocessedConditions.length > 0) {
                // NOTE: Parse timestamp to number before Math.max to prevent NaN
                lastProcessedLogTimestampRef.current = Math.max(...unprocessedConditions.map((l: LogEntry) => Number(l.timestamp) || 0));
                const now = Date.now();
                // NOTE: Guardrail - Replace magic number 10000 with configurable cooldown to prevent rubber-banding
                const cooldownMs = ATC_CONFIG.AI?.ANALYSIS_COOLDOWN_MS || 10000;
                if (now - lastAutoTriggerRef.current > cooldownMs) {
                  lastAutoTriggerRef.current = now;
                  
                  // NOTE: Auto-invoke Kanana-O
                  const triggerCommand = `A new event has been detected in the system logs. Analyze the logs and take immediate action.`;
                  
                  if (store.addLog) {
                    store.addLog("🚨 EVENT_TRIGGER: Auto-invoking Kanana-O for incident response...", "system", "SYSTEM");
                  }
                  
                  // NOTE: Add slight delay to ensure UI renders before analysis
                  autoTriggerTimeoutRef.current = setTimeout(() => {
                    // NOTE: Dispatch event to queue analysis if already running
                    window.dispatchEvent(new CustomEvent('AUTO_ANALYZE_TRIGGER', { detail: triggerCommand }));
                  }, 500);
                }
              }
            }
          }
          // NOTE: Process buffer when worker is idle
          if (!isWorkerBusy.current) {
            if (Date.now() - lastFlushTimeRef.current > 100) {
              lastFlushTimeRef.current = Date.now();
              // NOTE: Prevent render queue flooding when tab is inactive
              if (typeof window !== 'undefined') {
                requestAnimationFrame(flushBuffer);
              } else {
                setTimeout(flushBuffer, 16);
              }
            }
          }
        } catch (err) { 
          // NOTE: Only log non-empty lines to prevent noisy parsing errors
          if (dataStr) {
              logger.error("Stream Parsing Error:", err, "Raw Data:", dataStr);
          }
          // NOTE: If stream data is corrupted, we might want to force a reconnect or just skip the bad chunk
          // NOTE: For now, we skip the bad chunk
        }
      };
      eventSource.onerror = (e) => {
        // NOTE: Prevent infinite reconnect loops on stream closure
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (autoTriggerTimeoutRef.current) clearTimeout(autoTriggerTimeoutRef.current);
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