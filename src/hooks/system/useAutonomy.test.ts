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

  it('초기 상태에서 리스크 점수 0, 자율성 레벨 NORMAL을 반환한다', () => {
    const { result } = renderHook(() => useAutonomy(defaultState, [], mockAddLog));
    expect(result.current.riskScore).toBe(0);
    expect(result.current.autonomyLevel).toBe(ATC_CONFIG.LEVELS.NORMAL);
  });

  it('고부하 및 지연시간 스파이크가 있는 에이전트에 대해 정확한 리스크 점수를 계산한다', () => {
    // RISK.LOAD_THRESHOLD (70%) 및 RISK.LATENCY_THRESHOLD (100ms) 초과
    const agents = [
      { metrics: { load: '80%', lat: '50ms' } },  // Load 초과 (15점)
      { metrics: { load: '40%', lat: '150ms' } }, // Latency 초과 (10점)
      { metrics: { load: '90%', lat: '200ms' } }, // 둘 다 초과 (25점)
    ] as any;

    const { result } = renderHook(() => useAutonomy(defaultState, agents, mockAddLog));
    expect(result.current.riskScore).toBe(50); // 총합 50점
  });

  it('조치 후에도 리스크 점수가 계속 상승하고 60을 초과하면 EARLY_EXIT를 트리거한다', () => {
    let currentAgents = [] as any;
    const { result, rerender } = renderHook(() => 
      useAutonomy(defaultState, currentAgents, mockAddLog)
    );

    // 1. 초기 액션 기록
    act(() => { result.current.recordAction(); });

    // 2. 쿨다운 시간 패스
    vi.advanceTimersByTime(3000);

    // 3. 리스크 1단계 상승
    currentAgents = [{ metrics: { load: '90%', lat: '150ms' } }] as any;
    rerender();
    act(() => { result.current.checkDeltaSafety(); });

    // 4. 리스크 2단계 연속 상승 (60점 이상 도달 조건 생성)
    currentAgents = [
      { metrics: { load: '90%', lat: '150ms' } },
      { metrics: { load: '90%', lat: '150ms' } },
      { metrics: { load: '90%', lat: '150ms' } }
    ] as any; // Risk 75 예상
    rerender();
    
    let isUnsafe = false;
    act(() => { 
      isUnsafe = result.current.checkDeltaSafety(); 
    });

    // 검증: 상태 악화 감지 후 true 반환 및 EARLY_EXIT 로그 출력
    expect(isUnsafe).toBe(true);
    expect(mockAddLog).toHaveBeenCalledWith(
      ATC_CONFIG.LOG_MSG.EARLY_EXIT, 
      'critical', 
      'KANANA-O'
    );
  });
});