import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from './kanana';
import * as utils from './_utils';

// 전역 fetch Mocking
global.fetch = vi.fn() as any;

describe('Kanana Server API - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KANANA_API_KEY = 'test_key';
    process.env.KANANA_ENDPOINT = 'http://test.endpoint';
    process.env.JWT_SECRET = 'test_secret';
    process.env.NODE_ENV = 'production';

    vi.spyOn(utils, 'getAllowedOrigins').mockReturnValue(['https://kanana-atc.vercel.app']);
    vi.spyOn(utils, 'verifyAuthToken').mockResolvedValue({ valid: true, payload: { jti: 'test' } });
    // Mock isIpBanned to pass the middleware
    vi.spyOn(utils, 'isIpBanned').mockResolvedValue(false);
    // Mock checkRateLimit to pass the middleware
    vi.spyOn(utils, 'checkRateLimit').mockResolvedValue(true);
  });

  it('API 요청 중 TimeoutError 발생 시 504 GATEWAY_TIMEOUT 상태 코드를 반환해야 한다', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError'; // AbortSignal.timeout()에 의해 발생
    
    (global.fetch as any).mockRejectedValue(timeoutError);

    const request = new Request('https://api.example.com/api/kanana', {
      method: 'POST',
      headers: new Headers({ 
        'Content-Type': 'application/json',
        'x-vercel-forwarded-for': '127.0.0.1',
        'origin': 'https://kanana-atc.vercel.app'
      }),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error).toBe('GATEWAY_TIMEOUT');
  });

  it('알 수 없는 예외 발생 시 500 INTERNAL_SERVER_ERROR 상태 코드를 반환해야 한다', async () => {
    const generalError = new Error('Unexpected network failure');
    
    (global.fetch as any).mockRejectedValue(generalError);

    const request = new Request('https://api.example.com/api/kanana', {
      method: 'POST',
      headers: new Headers({ 
        'Content-Type': 'application/json',
        'x-vercel-forwarded-for': '127.0.0.1',
        'origin': 'https://kanana-atc.vercel.app'
      }),
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('INTERNAL_SERVER_ERROR');
  });
});