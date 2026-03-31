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

  const flushBuffer = () => {
    const { agents: bufferedAgents, state: bufferedState } = dataBuffer.current;
    const now = Date.now();

    if (bufferedAgents) {
      setAgents((prevAgents) => {
        const newAgents = bufferedAgents.map((agent: any, i: number) => {
          const originalId = String(agent.uuid || agent.id);
          if (deletedIds.current.has(originalId)) return null;

          const agentLocks = fieldLocks.current.get(originalId);
          let finalIsPaused = agent.isPaused;
          let finalPriority = agent.priority;
          let finalDisplayName = agent.displayName || agent.name || originalId;

          if (agentLocks) {
            ['isPaused', 'priority', 'displayName'].forEach(field => {
              if (agentLocks.has(field)) {
                const lock = agentLocks.get(field)!;
                const serverValue = String((agent as any)[field]);
                const myValue = String(lock.value);
                if (serverValue === myValue || lock.expiry <= now) {
                  agentLocks.delete(field);
                } else {
                  if (field === 'isPaused') agent.isPaused = lock.value;
                  if (field === 'priority') agent.priority = lock.value;
                  if (field === 'displayName') agent.displayName = lock.value;
                }
              }
            });
            if (agentLocks.size === 0) fieldLocks.current.delete(originalId);
          }

          const rawPos = agent.position;
          return {
            ...agent,
            id: originalId,
            uuid: originalId,
            displayName: finalDisplayName,
            displayId: agent.displayId || finalDisplayName,
            isPaused: !!finalIsPaused,
            priority: !!finalPriority,
            status: String(agent.status || 'idle').toLowerCase() as any,
            position: (Array.isArray(rawPos) && rawPos.length === 3) 
              ? [Number(rawPos[0]), Number(rawPos[1]), Number(rawPos[2])] 
              : getSpiralPos(i)
          } as Agent;
        }).filter(Boolean) as Agent[];
        
        return newAgents;
      });
      dataBuffer.current.agents = null;
    }

    if (bufferedState) {
      setState((prev) => {
        const serverLogs = bufferedState.logs || [];
        const uniqueMap = new Map();
        
        (prev.logs || []).forEach(l => {
          if (String(l.id).startsWith('ui-')) uniqueMap.set(l.id, l);
        });
        
        serverLogs.forEach((l: any) => { 
          if (l && l.id) uniqueMap.set(l.id, l); 
        });

        const sortedLogs = Array.from(uniqueMap.values())
          .sort((a: any, b: any) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
          .slice(-200);

        const { 
            pendingProposals: serverProposals, 
            logs: _, 
            ...restServerState 
        } = bufferedState;
        
        const finalProposals = prev.pendingProposals && prev.pendingProposals.length > 0 
            ? prev.pendingProposals 
            : (serverProposals || []);

        let finalState = { 
            ...prev, 
            ...restServerState, 
            logs: sortedLogs,
            pendingProposals: finalProposals
        };
        
        const globalLocks = fieldLocks.current.get('SYSTEM_GLOBAL');
        if (globalLocks) {
           globalLocks.forEach((lock, field) => {
             if (String(lock.value) === String((bufferedState as any)[field]) || lock.expiry <= now) {
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
  }, []);

  const markAction = useCallback((agentId: string, field: string, value: any, isDelete: boolean = false) => {
    const targetId = agentId ? String(agentId) : 'SYSTEM_GLOBAL';
    if (isDelete) {
        deletedIds.current.add(targetId);
    } else if (field) {
        if (!fieldLocks.current.has(targetId)) fieldLocks.current.set(targetId, new Map());
        fieldLocks.current.get(targetId)?.set(field, { value, expiry: Date.now() + 5000 });
    }
  }, []);

  return { markAction };
};