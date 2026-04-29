import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../../api/kanana';
import * as utils from '../../../api/_utils';

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
    vi.spyOn(utils, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(utils, 'checkRateLimit').mockResolvedValue(true);
  });

  it('should return 504 GATEWAY_TIMEOUT on TimeoutError during API request', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError'; 
    
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

  it('should return 500 INTERNAL_SERVER_ERROR on unknown exception', async () => {
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