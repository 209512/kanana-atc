import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutonomy } from './useAutonomy';
import { ATC_CONFIG } from '@/constants/atcConfig';
import { ATCState, Agent } from '@/contexts/atcTypes';

describe('useAutonomy', () => {
  const mockAddLog = vi.fn();
  const defaultState = { collisionCount: 0 } as ATCState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return risk score 0 and autonomy level NORMAL in initial state', () => {
    const { result } = renderHook(() => useAutonomy(defaultState, [], mockAddLog));
    expect(result.current.riskScore).toBe(0);
    expect(result.current.autonomyLevel).toBe(ATC_CONFIG.LEVELS.NORMAL);
  });

  it('should calculate correct risk score for agents with high load and latency spikes', () => {
    
    const agents = [
      { metrics: { load: '80%', lat: '50ms' } },  
      { metrics: { load: '40%', lat: '150ms' } }, 
      { metrics: { load: '90%', lat: '200ms' } }, 
    ] as any;

    const { result } = renderHook(() => useAutonomy(defaultState, agents, mockAddLog));
    expect(result.current.riskScore).toBe(50); 
  });

  it('should trigger EARLY_EXIT if risk score exceeds 60 continuously after intervention', () => {
    let currentAgents = [] as any;
    const { result, rerender } = renderHook(() => 
      useAutonomy(defaultState, currentAgents, mockAddLog)
    );

    
    act(() => { result.current.recordAction(); });

    
    vi.advanceTimersByTime(3000);

    
    currentAgents = [{ metrics: { load: '90%', lat: '150ms' } }] as any;
    rerender();
    act(() => { result.current.checkDeltaSafety(); });

    
    currentAgents = [
      { metrics: { load: '90%', lat: '150ms' } },
      { metrics: { load: '90%', lat: '150ms' } },
      { metrics: { load: '90%', lat: '150ms' } }
    ] as any; 
    rerender();
    
    let isUnsafe = false;
    act(() => { 
      isUnsafe = result.current.checkDeltaSafety(); 
    });

    
    expect(isUnsafe).toBe(true);
    expect(mockAddLog).toHaveBeenCalledWith(
      ATC_CONFIG.LOG_MSG.EARLY_EXIT, 
      'critical', 
      'KANANA-O'
    );
  });
});