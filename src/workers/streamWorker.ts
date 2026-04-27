import { mergeAgentsWorker, mergeStateWorker, BufferedAgent, BufferedState } from './streamMerger.logic';
import { Agent, ATCState } from '../contexts/atcTypes';


let prevAgents: Agent[] = [];
let prevState: ATCState = {
  logs: [],
  pendingProposals: new Map(),
  overrideSignal: false,
} as unknown as ATCState;

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'INIT_STATE') {
    prevAgents = payload.agents || [];
    if (payload.state) {
      prevState = payload.state;
    }
  } else if (type === 'PROCESS_STREAM') {
    try {
      const { agents: bufferedAgents, state: bufferedState, now, deletedIds, fieldLocks } = payload as {
        agents: BufferedAgent[];
        state: BufferedState;
        now: number;
        deletedIds: string[];
        fieldLocks: [string, [string, { value: string | boolean; expiry: number }][]][];
      };
      
      let isAgentsUpdated = false;
      let isStateUpdated = false;
      const allLocksToDelete: { uuid: string; field: string }[] = [];

      if (bufferedAgents) {
        const { newAgents, locksToDelete } = mergeAgentsWorker(prevAgents, bufferedAgents, deletedIds, fieldLocks, now);
        prevAgents = newAgents;
        isAgentsUpdated = true;
        allLocksToDelete.push(...locksToDelete);
      }

      if (bufferedState) {
        const { newState, locksToDelete } = mergeStateWorker(prevState, bufferedState, fieldLocks, now);
        prevState = newState;
        isStateUpdated = true;
        allLocksToDelete.push(...locksToDelete);
      }

      self.postMessage({
        type: 'STREAM_PROCESSED',
        payload: {
          agents: isAgentsUpdated ? prevAgents : null,
          state: isStateUpdated ? prevState : null,
          locksToDelete: allLocksToDelete,
        }
      });
    } catch (err) {
      self.postMessage({ type: 'ERROR', payload: err instanceof Error ? err.message : 'Worker error' });
    }
  } else if (type === 'CLEAR_CACHE') {
    prevAgents = [];
    prevState = { logs: [], pendingProposals: new Map(), overrideSignal: false } as unknown as ATCState;
  }
};
