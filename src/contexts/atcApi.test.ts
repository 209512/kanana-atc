import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { atcApi } from './atcApi';


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

  it('should include model and extra_body(latency_first) in request payload', async () => {
    

    await atcApi.askKanana({ text: 'test optimization' });

    
    const fetchCalls = (global.fetch as any).mock.calls;
    const kananaCall = fetchCalls.find((call: unknown[]) => String(call[0]).includes('/api/kanana')) || fetchCalls[0];
    
    
    const requestBody = JSON.parse(kananaCall[1].body);
    expect(requestBody.model).toBe('kanana-o');
    expect(requestBody.extra_body).toBeDefined();
    expect(requestBody.extra_body.latency_first).toBe(true);
  });

  it('should call clearTimeout on successful request to prevent memory leak', async () => {
    

    const spyClearTimeout = vi.spyOn(global, 'clearTimeout');

    
    const promise = atcApi.askKanana({ text: 'test' });
    await promise;

    
    expect(spyClearTimeout).toHaveBeenCalled();
  });

  it('should break retry loop and call clearTimeout on AbortError', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';

    
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

    
    
    await new Promise(resolve => process.nextTick(resolve));

    
    vi.advanceTimersByTime(60000);

    
    await expect(promise).rejects.toThrow('AbortError');

    
    expect(spyClearTimeout).toHaveBeenCalled();
  });
});