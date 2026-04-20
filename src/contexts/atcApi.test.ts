import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { atcApi } from './atcApi';

// 브라우저 환경의 fetch를 Mocking
global.fetch = vi.fn() as any;

describe('ATC API Client - Error Handling & Timer Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/init')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "MOCK_TOKEN" })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "success" } }] }),
        headers: new Headers({ 'content-type': 'application/json' })
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('요청 바디에 model과 extra_body(latency_first)가 올바르게 포함되어야 한다', async () => {
    // beforeEach의 mockImplementation을 그대로 사용합니다.

    await atcApi.askKanana({ text: 'test optimization' });

    // fetch 호출 인자 확인 (두 번째 호출이 /api/kanana 일 것)
    const fetchCalls = (global.fetch as any).mock.calls;
    const kananaCall = fetchCalls.find((call: unknown[]) => String(call[0]).includes('/api/kanana')) || fetchCalls[0];
    
    // Request Body 검증
    const requestBody = JSON.parse(kananaCall[1].body);
    expect(requestBody.model).toBe('kanana-o');
    expect(requestBody.extra_body).toBeDefined();
    expect(requestBody.extra_body.latency_first).toBe(true);
  });

  it('요청이 성공적으로 완료되면 메모리 누수 방지를 위해 clearTimeout이 호출되어야 한다', async () => {
    // beforeEach의 mockImplementation을 그대로 사용합니다.

    const spyClearTimeout = vi.spyOn(global, 'clearTimeout');

    // API 호출
    const promise = atcApi.askKanana({ text: 'test' });
    await promise;

    // finally 블록 등에서 clearTimeout이 최소 1회 이상 정상 호출되었는지 검증
    expect(spyClearTimeout).toHaveBeenCalled();
  });

  it('타임아웃(AbortError) 발생 시 재시도 루프를 빠져나오고 clearTimeout이 호출되어야 한다', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';

    // fetch가 지연되도록 설정하고, AbortController에 의해 중단되는 상황 모사
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/init')) {
        return Promise.resolve({ ok: true, json: async () => ({ token: "MOCK_TOKEN" }) });
      }
      return new Promise((_, reject) => {
        setTimeout(() => reject(abortError), 60000);
      });
    });

    const spyClearTimeout = vi.spyOn(global, 'clearTimeout');
    const promise = atcApi.askKanana({ text: 'test timeout' });

    // 마이크로태스크 큐를 비워 initAuth()의 fetch가 완료되고 
    // 두 번째 fetch(실제 API 호출)가 시작될 수 있도록 대기
    await new Promise(resolve => process.nextTick(resolve));

    // 타임아웃 시간(60초)만큼 타이머 진행
    vi.advanceTimersByTime(60000);

    // 에러 발생 검증 (AbortError가 throw 되어야 함)
    await expect(promise).rejects.toThrow('AbortError');

    // 예외가 발생하더라도 finally 블록에서 clearTimeout이 호출되었는지 확인
    expect(spyClearTimeout).toHaveBeenCalled();
  });
});