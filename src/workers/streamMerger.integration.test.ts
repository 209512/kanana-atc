import { describe, it, expect } from 'vitest';
import { mergeAgentsWorker, mergeStateWorker, BufferedAgent, BufferedState } from './streamMerger.logic';
import { Agent, ATCState } from '../contexts/atcTypes';

describe('Stream Merger Worker Integration Tests', () => {
  it('should correctly merge agents and apply field locks', () => {
    const prevAgents: Agent[] = [
      { id: 'agent-1', uuid: 'agent-1', displayName: 'Agent 1', status: 'idle', priority: false, isPaused: false, activeTime: 0, index: 1 } as Agent
    ];
    
    const bufferedAgents: BufferedAgent[] = [
      { id: 'agent-1', uuid: 'agent-1', displayName: 'Agent 1', status: 'active', priority: false, isPaused: false }
    ];
    const fieldLocks: [string, [string, { value: string | boolean; expiry: number }][]][] = [
      ['agent-1', [['isPaused', { value: true, expiry: Date.now() + 5000 }]]]
    ];

    const { newAgents, locksToDelete } = mergeAgentsWorker(prevAgents, bufferedAgents, [], fieldLocks, Date.now());
    expect(newAgents[0].isPaused).toBe(true);
    expect(newAgents[0].status).toBe('active');
    expect(locksToDelete.length).toBe(0); // Lock is not expired and server didn't match yet
  });

  it('should release expired locks automatically', () => {
    const prevAgents: Agent[] = [];
    const bufferedAgents: BufferedAgent[] = [
      { id: 'agent-1', uuid: 'agent-1', displayName: 'Agent 1', status: 'idle', priority: false, isPaused: false }
    ];
    const fieldLocks: [string, [string, { value: string | boolean; expiry: number }][]][] = [
      ['agent-1', [['isPaused', { value: true, expiry: Date.now() - 1000 }]]]
    ];

    const { newAgents, locksToDelete } = mergeAgentsWorker(prevAgents, bufferedAgents, [], fieldLocks, Date.now());
    expect(newAgents[0].isPaused).toBe(false);
    expect(locksToDelete).toEqual([{ uuid: 'agent-1', field: 'isPaused' }]);
  });

  it('should completely filter out deleted agents', () => {
    const bufferedAgents: BufferedAgent[] = [
      { id: 'agent-1', uuid: 'agent-1', status: 'idle' },
      { id: 'agent-2', uuid: 'agent-2', status: 'idle' }
    ];

    const deletedIds = ['agent-2'];

    const { newAgents } = mergeAgentsWorker([], bufferedAgents, deletedIds, [], Date.now());

    expect(newAgents.length).toBe(1);
    expect(newAgents[0].id).toBe('agent-1');
  });

  it('should merge states and preserve UI-generated logs', () => {
    const prevState = {
      logs: [
        { id: 'ui-1', message: 'User clicked something', timestamp: 1000, type: 'info', agentId: 'SYSTEM' }
      ]
    } as unknown as ATCState;

    const bufferedState: BufferedState = {
      logs: [
        { id: 'log-1', message: 'Server tick', timestamp: 2000, type: 'info', agentId: 'SYSTEM' }
      ]
    };

    const { newState } = mergeStateWorker(prevState, bufferedState, [], Date.now());
    expect(newState.logs.length).toBe(2);
    expect(newState.logs[0].id).toBe('ui-1');
    expect(newState.logs[1].id).toBe('log-1');
  });
});
