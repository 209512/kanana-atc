import { jwtVerify } from 'jose';
import { logger } from './_logger';
import { applyPrivacyMasking as corePrivacyMasking } from '../src/utils/privacyFilter';

export const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : [];

  return [...envOrigins].filter(Boolean) as string[];
};

const getBlacklistedIps = () => {
  return new Set(
    (process.env.BLACKLISTED_IPS || "")
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
  );
};
export async function redisFetch(path: string, options: RequestInit = {}) {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!upstashUrl || !upstashToken) return null;

  try {
    const res = await fetch(`${upstashUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.error(`[REDIS_ERROR] path: ${path}`, err);
    return null;
  }
}

export async function isIpBanned(ip: string): Promise<boolean> {
  const blacklistedIps = getBlacklistedIps();
  if (blacklistedIps.has(ip)) {
    return true;
  }

  const data = await redisFetch(`/get/banned_ip:${ip}`);
  if (data && (data.result === "true" || data.result === true)) {
    return true;
  }

  return false;
}

export async function banIp(ip: string, durationMinutes: number = 60) {
  const seconds = durationMinutes * 60;
  await redisFetch(`/set/banned_ip:${ip}/true/ex/${seconds}`);
}

const isolateBurstCache = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(identifier: string, maxRequests: number = Number(process.env.MAX_REQUESTS) || 20, _ip?: string): Promise<boolean> {
  if (identifier === 'unknown_ip') return false;
  const localKey = `rl:${identifier}`;
  const now = Date.now();
  const windowMs = 60 * 1000;

  const burstRecord = isolateBurstCache.get(localKey);
  if (burstRecord) {
    if (now > burstRecord.resetTime) {
      isolateBurstCache.set(localKey, { count: 1, resetTime: now + windowMs });
    } else {
      burstRecord.count++;
      if (burstRecord.count > maxRequests) {
        logger.warn(`[RATE_LIMIT] Blocked by Isolate Burst Cache: ${identifier}`);
        return false;
      }
    }
  } else {
    isolateBurstCache.set(localKey, { count: 1, resetTime: now + windowMs });
  }

  if (isolateBurstCache.size > 1000) {
    let deletedCount = 0;
    isolateBurstCache.forEach((v, k) => {
      if (now > v.resetTime) {
        isolateBurstCache.delete(k);
      } else if (isolateBurstCache.size > 1000 && deletedCount < 100) {
        isolateBurstCache.delete(k);
        deletedCount++;
      }
    });
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!upstashUrl || !upstashToken) {
    const record = isolateBurstCache.get(localKey);
    return record ? record.count <= maxRequests : true;
  }

  try {
    const key = `ratelimit:${identifier}`;
    const incrRes = await fetch(`${upstashUrl}/incr/${key}`, {
      headers: { Authorization: `Bearer ${upstashToken}` }
    });
    
    if (!incrRes.ok) {
      const record = isolateBurstCache.get(localKey);
      return record ? record.count <= maxRequests : true;
    }

    const data = await incrRes.json();
    const count = parseInt(data.result, 10);
    
    if (Number.isNaN(count)) {
      const record = isolateBurstCache.get(localKey);
      return record ? record.count <= maxRequests : true;
    }

    if (count === 1) {
      await fetch(`${upstashUrl}/expire/${key}/60`, {
        headers: { Authorization: `Bearer ${upstashToken}` }
      });
    }

    return count <= maxRequests;
  } catch (error) {
    logger.warn('[RATE_LIMIT_ERROR] Failed to check limit', error);
    
    const record = isolateBurstCache.get(localKey);
    return record ? record.count <= maxRequests : true;
  }
}

export function getClientIp(req: Request): string {
  const isVercel = process.env.VERCEL === '1';

  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (isVercel && vercelIp) {
    const ip = vercelIp.split(',')[0].trim();
    if (isValidIp(ip)) return ip;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && isValidIp(realIp.trim())) return realIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded && (isVercel || process.env.NODE_ENV !== 'production')) {
    const ips = forwarded.split(',').map(s => s.trim());
    const candidate = ips[ips.length - 1];
    if (isValidIp(candidate)) return candidate;
  }

  return 'unknown_ip';
}

function isValidIp(ip: string): boolean {
  const v4 =
    /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (v4.test(ip)) return true;

  if (!/^[0-9a-fA-F:]+$/.test(ip)) return false;
  if (!ip.includes(':')) return false;
  if (ip.length > 45) return false;

  return true;
}

export async function revokeToken(jti: string) {
  await redisFetch(`/set/blacklist:${jti}/true/ex/86400`);
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  if (!upstashUrl) return false;

  try {
    const data = await redisFetch(`/get/blacklist:${jti}`);
    if (data === null) throw new Error("Redis fetch failed");
    if (data && (data.result === "true" || data.result === true)) {
      return true;
    }
    return false;
  } catch (err) {
    logger.error("Failed to check token blacklist. Failsafe: block", err);
    return true; // Fail-secure (블랙리스트 체크 실패 시 토큰 무효화)
  }
}

export async function handleDailyQuota(identifier: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dailyQuotaKey = `daily_quota:${identifier}:${today}`;
  
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  if (!upstashUrl) return false;

  try {
    const quotaRes = await fetch(`${upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ["INCR", dailyQuotaKey],
        ["EXPIRE", dailyQuotaKey, 86400, "NX"]
      ])
    });
    
    if (quotaRes.ok) {
      const quotaData = await quotaRes.json();
      if (quotaData && Array.isArray(quotaData) && quotaData.length > 0 && quotaData[0] && quotaData[0].result !== undefined) {
        const currentDailyRequests = parseInt(quotaData[0].result, 10);
        const MAX_DAILY_QUOTA = Number(process.env.MAX_DAILY_QUOTA) || 20;
        
        if (!Number.isNaN(currentDailyRequests) && currentDailyRequests > MAX_DAILY_QUOTA) {
          logger.warn(`[DAILY_QUOTA_EXCEEDED] Identifier: ${identifier}`);
          return true;
        }
      }
    }
  } catch (err) {
    logger.error("[DAILY_QUOTA_REDIS_ERR]", err);
  }
  return false;
}

export const applyPrivacyMasking = (text: string) => {
  return corePrivacyMasking(text);
};

export const getJwtSecret = (): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) return jwtSecret;

  const globalAny = globalThis as unknown as { KANANA_RUNTIME_SECRET?: string };
  if (!globalAny.KANANA_RUNTIME_SECRET) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    globalAny.KANANA_RUNTIME_SECRET = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return globalAny.KANANA_RUNTIME_SECRET;
};
export async function verifyAuthToken(req: Request): Promise<{ valid: boolean; payload?: { jti?: string, boundIp?: string, [key: string]: unknown } }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false };
  }

  const token = authHeader.split(" ")[1];
  const secretKey = getJwtSecret();
  
  if (!secretKey) {
    logger.error("[AUTH_ERROR] Secret is not defined! Rejecting request.");
    return { valid: false };
  }

  try {
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    
    const typedPayload = payload as { jti?: string, boundIp?: string, [key: string]: unknown };
    
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const currentIp = getClientIp(req);
    if (isVercel && typedPayload.boundIp && typedPayload.boundIp !== 'unknown' && currentIp !== 'unknown' && typedPayload.boundIp !== currentIp) {
      logger.error(`[AUTH_ERROR] Token IP mismatch. Token bound to ${typedPayload.boundIp}, but used by ${currentIp}`);
      return { valid: false };
    }

    if (typedPayload.jti) {
      const revoked = await isTokenRevoked(typedPayload.jti);
      if (revoked) {
        logger.warn(`[AUTH_ERROR] Revoked token used: ${typedPayload.jti}`);
        return { valid: false };
      }
    }

    return { valid: true, payload: typedPayload };
  } catch (error) {
    logger.error("[AUTH_ERROR] JWT Validation failed:", error);
    return { valid: false };
  }
}
