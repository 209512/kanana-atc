import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, isIpBanned, localRateLimitCache } from './_utils';

// Mock process.env
const originalEnv = process.env;

// Mock the logger to avoid polluting console during tests
vi.mock('./_logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Rate Limiter & IP Ban (Edge Cases)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear global mocks
    global.fetch = vi.fn();
    // Clear local cache
    localRateLimitCache.clear();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should fallback to in-memory if Redis responds with undefined currentCount', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'http://fake-redis.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

      // First two requests fallback to memory and increment
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ result: undefined }], // Redis error / unexpected payload
      });
      global.fetch = mockFetch;

      // In-memory rate limiter logic correctly falls back
      const result1 = await checkRateLimit('user-fallback', 2, '127.0.0.1');
      expect(result1).toBe(true);

      const result2 = await checkRateLimit('user-fallback', 2, '127.0.0.1');
      expect(result2).toBe(true);

      // In-memory rate limiter now blocks on the 3rd request since max is 2
      const result3 = await checkRateLimit('user-fallback', 2, '127.0.0.1');
      expect(result3).toBe(false);
    });

    it('should use Redis correctly when valid data is returned', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'http://fake-redis.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

      // First call returns 3 (which is > maxRequests)
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: "3" }), // currentCount = 3
        });
      global.fetch = mockFetch;

      const result = await checkRateLimit('user_redis', 2, '192.168.0.1');
      
      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // 1 incr call
    });
  });

  describe('isIpBanned', () => {
    it('should handle Redis failure gracefully', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'http://fake-redis.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

      // Redis fetch throws an error
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const result = await isIpBanned('10.0.0.1');
      expect(result).toBe(false); // Should not crash, just returns false
    });
  });
});