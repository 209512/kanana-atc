import { Agent, ATCState, LogEntry, AIProposal } from '../contexts/atcTypes';

export interface BufferedAgent {
  uuid: string;
  id: string;
  status?: "error" | "active" | "waiting" | "idle" | "paused" | "processing" | "emergency";
  [key: string]: unknown;
}

export interface BufferedState {
  logs?: unknown[];
  pendingProposals?: Map<string, unknown> | unknown[];
  [key: string]: unknown;
}

export const mergeAgentsWorker = (
  prevAgents: Agent[],
  bufferedAgents: BufferedAgent[],
  deletedIds: string[],
  fieldLocks: [string, [string, { value: string | boolean; expiry: number }][]][],
  now: number
) => {
  const deletedSet = new Set(deletedIds);
  const locksMap = new Map<string, Map<string, { value: string | boolean; expiry: number }>>();
  fieldLocks.forEach(([uuid, fields]) => {
    locksMap.set(uuid, new Map(fields));
  });

  const locksToDelete: { uuid: string; field: string }[] = [];

  const newAgents = bufferedAgents.map((agent: BufferedAgent) => {
    const originalId = String(agent.uuid || agent.id);
    if (deletedSet.has(originalId)) return null;

    const agentLocks = locksMap.get(originalId);
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
            locksToDelete.push({ uuid: originalId, field });
          } else {
            if (field === 'isPaused') finalIsPaused = Boolean(lock.value);
            if (field === 'priority') finalPriority = Boolean(lock.value);
            if (field === 'displayName') finalDisplayName = String(lock.value);
          }
        }
      });
    }

    const existingAgent = prevAgents.find(a => a.id === originalId);
    
    if (existingAgent) {
      // NOTE: Ensure dynamic fields are updated during merge
      return {
        ...existingAgent,
        ...agent,
        id: originalId,
        uuid: originalId,
        displayName: finalDisplayName,
        displayId: agent.displayId || finalDisplayName,
        isPaused: !!finalIsPaused,
        priority: !!finalPriority,
        status: String(agent.status || 'idle').toLowerCase() as Agent['status'],
        activeTime: agent.activeTime || existingAgent.activeTime || 0,
        index: agent.index !== undefined ? agent.index : existingAgent.index,
      } as Agent;
    }

    return {
      ...agent,
      id: originalId,
      uuid: originalId,
      displayName: finalDisplayName,
      displayId: agent.displayId || finalDisplayName,
      isPaused: !!finalIsPaused,
      priority: !!finalPriority,
      status: String(agent.status || 'idle').toLowerCase() as Agent['status'],
      activeTime: agent.activeTime || 0,
      index: agent.index || 0,
    } as Agent;
  }).filter(Boolean) as Agent[];

  return { newAgents, locksToDelete };
};

export const mergeStateWorker = (
  prevState: ATCState,
  bufferedState: BufferedState,
  fieldLocks: [string, [string, { value: string | boolean; expiry: number }][]][],
  now: number
) => {
  const locksMap = new Map<string, Map<string, { value: string | boolean; expiry: number }>>();
  fieldLocks.forEach(([uuid, fields]) => {
    locksMap.set(uuid, new Map(fields));
  });

  const locksToDelete: { uuid: string; field: string }[] = [];

  const serverLogs = bufferedState.logs || [];
  const uniqueMap = new Map<string, LogEntry>();
  
  (prevState.logs || []).forEach(l => {
    uniqueMap.set(l.id, l);
  });
  
  serverLogs.forEach((l: unknown) => {
    const log = l as LogEntry; 
    if (log && log.id) uniqueMap.set(log.id, log); 
    });

  // NOTE: Merge logs and maintain up to 1000 items (matching ATC_CONFIG.LOGS.MAX_DISPLAY)
  const sortedLogs = Array.from(uniqueMap.values())
    .sort((a: LogEntry, b: LogEntry) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
    .slice(-1000);

  const { 
      pendingProposals: serverProposals, 
      logs: _, 
      ...restServerState 
  } = bufferedState;
  
  const finalProposals = prevState.pendingProposals && prevState.pendingProposals.size > 0 
      ? prevState.pendingProposals 
      : new Map(
          Array.isArray(serverProposals) 
            ? serverProposals.map((p: unknown) => { const prop = p as AIProposal; return [prop.id, prop]; }) 
            : serverProposals instanceof Map 
              ? Array.from(serverProposals.entries()) 
              : Object.entries(serverProposals || {})
        );

  const finalState = { 
      ...prevState, 
      ...restServerState, 
      logs: sortedLogs,
      pendingProposals: finalProposals
  } as ATCState;
  
  const globalLocks = locksMap.get('SYSTEM_GLOBAL');
  if (globalLocks) {
     globalLocks.forEach((lock, field) => {
       if (String(lock.value) === String((bufferedState as Record<string, unknown>)[field]) || lock.expiry <= now) {
         locksToDelete.push({ uuid: 'SYSTEM_GLOBAL', field });
       } else {
         (finalState as unknown as Record<string, unknown>)[field] = lock.value;
       }
     });
  }
  
  return { newState: finalState, locksToDelete };
};
