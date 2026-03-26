// src/hooks/system/useATCStream.ts
import { useEffect, useRef, useCallback } from 'react';
import { Agent, ATCState } from '@/contexts/atcTypes';

const STREAM_URL = '/api/stream';

const getSpiralPos = (i: number): [number, number, number] => {
  const r = 2.5 * Math.sqrt(i + 1);
  const theta = i * 137.508 * (Math.PI / 180);
  return [Math.cos(theta) * r, 0, Math.sin(theta) * r];
};

export const useATCStream = (
  setState: React.Dispatch<React.SetStateAction<ATCState>>,
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>
) => {
  const deletedIds = useRef<Set<string>>(new Set());
  const fieldLocks = useRef<Map<string, Map<string, { value: any, expiry: number }>>>(new Map());
  const reconnectTimeoutRef = useRef<any>(null);
  const dataBuffer = useRef<{ agents: any[] | null, state: any | null }>({ agents: null, state: null });
  const rafRef = useRef<number | null>(null);

  const flushBuffer = useCallback(() => {
    const { agents: bufferedAgents, state: bufferedState } = dataBuffer.current;
    const now = Date.now();

    if (bufferedAgents) {
      setAgents((prevAgents) => {
        return bufferedAgents.map((agent: any, i: number) => {
          const originalId = String(agent.uuid || agent.id);
          if (deletedIds.current.has(originalId)) return null;

          const agentLocks = fieldLocks.current.get(originalId);
          
          let finalIsPaused = agent.isPaused;
          let finalPriority = agent.priority;
          let finalDisplayName = agent.displayName || agent.name || originalId;

          if (agentLocks) {
            if (agentLocks.has('isPaused')) {
              const lock = agentLocks.get('isPaused')!;
              if (lock.value === !!agent.isPaused || lock.expiry <= now) {
                agentLocks.delete('isPaused');
                finalIsPaused = agent.isPaused;
              } else {
                finalIsPaused = lock.value;
              }
            }

            if (agentLocks.has('priority')) {
              const lock = agentLocks.get('priority')!;
              if (lock.value === !!agent.priority || lock.expiry <= now) {
                agentLocks.delete('priority');
                finalPriority = agent.priority;
              } else {
                finalPriority = lock.value;
              }
            }

            if (agentLocks.has('displayName')) {
              const lock = agentLocks.get('displayName')!;
              if (lock.value === agent.displayName || lock.expiry <= now) {
                agentLocks.delete('displayName');
                finalDisplayName = agent.displayName;
              } else {
                finalDisplayName = lock.value;
              }
            }
            
            if (agentLocks.size === 0) fieldLocks.current.delete(originalId);
          }

          const rawPos = agent.position;
          const finalPosition: [number, number, number] = 
            (Array.isArray(rawPos) && rawPos.length === 3) 
              ? [Number(rawPos[0]), Number(rawPos[1]), Number(rawPos[2])] 
              : getSpiralPos(i);

          return {
            ...agent,
            id: originalId,
            uuid: originalId,
            displayName: finalDisplayName,
            displayId: agent.displayId || finalDisplayName,
            isPaused: !!finalIsPaused,
            priority: !!finalPriority,
            status: String(agent.status || 'idle').toLowerCase() as any,
            position: finalPosition
          } as Agent;
        }).filter(Boolean) as Agent[];
      });
      dataBuffer.current.agents = null;
    }

    if (bufferedState) {
      setState((prev) => {
        const serverLogs = bufferedState.logs || [];
        const uniqueMap = new Map();
        
        (prev.logs || []).filter(l => String(l.id).startsWith('ui-')).forEach(l => uniqueMap.set(l.id, l));
        serverLogs.forEach((l: any) => { if (l && l.id) uniqueMap.set(l.id, l); });

        const sortedLogs = Array.from(uniqueMap.values())
          .sort((a: any, b: any) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
          .slice(-100);

        let finalState = { ...prev, ...bufferedState, logs: sortedLogs };
        
        const globalLocks = fieldLocks.current.get('SYSTEM_GLOBAL');
        if (globalLocks) {
           globalLocks.forEach((lock, field) => {
             const serverValue = (bufferedState as any)[field];
             if (lock.value === serverValue || lock.expiry <= now) {
               globalLocks.delete(field);
             } else {
               (finalState as any)[field] = lock.value;
             }
           });
           if (globalLocks.size === 0) fieldLocks.current.delete('SYSTEM_GLOBAL');
        }

        return finalState;
      });
      dataBuffer.current.state = null;
    }
    rafRef.current = null;
  }, [setAgents, setState]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    const connect = () => {
      if (eventSource) eventSource.close();
      eventSource = new EventSource(STREAM_URL);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.agents) dataBuffer.current.agents = data.agents;
          if (data.state) dataBuffer.current.state = data.state;
          if (!rafRef.current) rafRef.current = requestAnimationFrame(flushBuffer);
        } catch (err) { console.error("Stream Parsing Error:", err); }
      };
      eventSource.onerror = () => {
        eventSource?.close();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      eventSource?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flushBuffer]);

  const markAction = useCallback((agentId: string, field: string, value: any, isDelete: boolean = false) => {
    const targetId = agentId ? String(agentId) : 'SYSTEM_GLOBAL';
    if (isDelete) {
        deletedIds.current.add(targetId);
    } else if (field) {
        if (!fieldLocks.current.has(targetId)) fieldLocks.current.set(targetId, new Map());
        fieldLocks.current.get(targetId)?.set(field, { value, expiry: Date.now() + 3000 });
    }
  }, []);

  return { markAction };
};