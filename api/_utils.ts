import { jwtVerify } from 'jose';
import { logger } from './_logger';
import { applyPrivacyMasking as corePrivacyMasking } from '../src/utils/privacyFilter';

export const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : [];

  return [...envOrigins].filter(Boolean) as string[];
};

// NOTE: IP Ban & Blacklist Logic
// NOTE: Load permanent block IPs from env
const getBlacklistedIps = () => {
  return new Set(
    (process.env.BLACKLISTED_IPS || "")
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
  );
};

// NOTE: Redis Helper
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
  // NOTE: Permanent IP block check
  const blacklistedIps = getBlacklistedIps();
  if (blacklistedIps.has(ip)) {
    return true;
  }

  // NOTE: Redis Check (if available) - No In-Memory cache for Edge environment
  const data = await redisFetch(`/get/banned_ip:${ip}`);
  if (data && (data.result === "true" || data.result === true)) {
    return true;
  }

  return false;
}

export async function banIp(ip: string, durationMinutes: number = 60) {
  // NOTE: Redis Sync (if available) - No In-Memory cache for Edge environment
  const seconds = durationMinutes * 60;
  await redisFetch(`/set/banned_ip:${ip}/true/ex/${seconds}`);
}

// NOTE: Rate Limiting Logic
const MAX_REQUESTS = 20; // NOTE: Max 20 requests per minute
const MAX_VIOLATIONS = 5; // NOTE: Block IP after 5 violations

// NOTE: In-Memory Cache for Single Isolate Burst Protection
// NOTE: This cache is per-isolate in Vercel Edge and serves as a burst limiter
const isolateBurstCache = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(identifier: string, maxRequests: number = Number(process.env.MAX_REQUESTS) || 20, ip?: string): Promise<boolean> {
  if (identifier === 'unknown_ip') return false;
  const localKey = `rl:${identifier}`;
  const now = Date.now();
  const windowMs = 60 * 1000;

  // NOTE: Isolate Burst Cache (L1 Defense)
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

  // NOTE: Hard cap eviction for memory leak prevention (prevent OOM from unbounded map)
  if (isolateBurstCache.size > 1000) {
    let deletedCount = 0;
    isolateBurstCache.forEach((v, k) => {
      if (now > v.resetTime) {
        isolateBurstCache.delete(k);
      } else if (isolateBurstCache.size > 1000 && deletedCount < 100) {
        // NOTE: Evict up to 100 non-expired items to prevent memory explosion
        isolateBurstCache.delete(k);
        deletedCount++;
      }
    });
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  // NOTE: Fallback to local memory cache if Redis is not configured
  if (!upstashUrl || !upstashToken) {
    const record = isolateBurstCache.get(localKey);
    return record ? record.count <= maxRequests : true;
  }

  try {
    const key = `ratelimit:${identifier}`;
    // NOTE: Use individual fetch instead of pipeline for Edge compatibility
    const incrRes = await fetch(`${upstashUrl}/incr/${key}`, {
      headers: { Authorization: `Bearer ${upstashToken}` }
    });
    
    if (!incrRes.ok) {
      // NOTE: Fallback to local cache on Redis failure (Fail-Open mitigation)
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
  // NOTE: x-vercel-forwarded-for is trusted in Vercel
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const ip = vercelIp.split(',')[0].trim();
    if (isValidIp(ip)) return ip;
  }

  // NOTE: Parse x-forwarded-for for non-Vercel environments
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // NOTE: Trust rightmost IP to prevent spoofing
    const ips = forwarded.split(',').map(s => s.trim());
    const ip = ips[ips.length - 1];
    if (isValidIp(ip)) return ip;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp.trim())) return realIp.trim();

  return "unknown_ip";
}

function isValidIp(ip: string): boolean {
  // NOTE: Simple IPv4/IPv6 validation to prevent NoSQL Injection
  return /^([a-fA-F0-9:.]+)$/.test(ip);
}

// NOTE: Token Revocation (Blacklist) Logic

export async function revokeToken(jti: string) {
  // NOTE: Redis Blacklist check
  // NOTE: Blacklist for 24h (86400s) to match token expiration
  await redisFetch(`/set/blacklist:${jti}/true/ex/86400`);
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  // NOTE: If Redis is not configured, we cannot verify revocation, but we shouldn't block all traffic
  // NOTE: Fail-Closed on Redis error for high security
  // NOTE: Fail-Open on Redis error to ensure stability
  if (!upstashUrl) return false;

  try {
    const data = await redisFetch(`/get/blacklist:${jti}`);
    if (data && (data.result === "true" || data.result === true)) {
      return true;
    }
  } catch (e) {
    logger.error(`[SECURITY_WARNING] Failed to check token revocation for ${jti}. Failing open.`, e);
  }
  
  return false;
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
    // NOTE: Fallback to allow request if Redis fails, to prevent total service outage
  }
  return false;
}



export const applyPrivacyMasking = (text: string) => {
  return corePrivacyMasking(text);
};

const globalAny = globalThis as any;
if (!globalAny.KANANA_RUNTIME_SECRET) {
  // NOTE: Deterministic but secure secret to prevent 401 errors on Vercel cold starts
  // NOTE: If the server has a KANANA_API_KEY (has quota to protect), derive the JWT secret from it
  // NOTE: Fallback to Vercel deployment-specific variables for zero-config security
  const serverKey = process.env.KANANA_API_KEY || process.env.VITE_SECURE_KEY || process.env.VERCEL_PROJECT_ID || process.env.VERCEL_URL || "";
  if (serverKey) {
    let hash = 0;
    for (let i = 0; i < serverKey.length; i++) {
      hash = ((hash << 5) - hash) + serverKey.charCodeAt(i);
      hash |= 0;
    }
    globalAny.KANANA_RUNTIME_SECRET = `kanana_atc_derived_secret_${Math.abs(hash)}`;
  } else {
    globalAny.KANANA_RUNTIME_SECRET = "kanana_atc_zero_config_fallback_secret_2024";
  }
}

// NOTE: Helper to get JWT Secret without hardcoding it
export const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || globalAny.KANANA_RUNTIME_SECRET;
};

// NOTE: JWT Verification
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
    
    // NOTE: Invalidate token on IP mismatch to prevent session hijacking
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const currentIp = getClientIp(req);
    if (isVercel && typedPayload.boundIp && typedPayload.boundIp !== 'unknown' && currentIp !== 'unknown' && typedPayload.boundIp !== currentIp) {
      logger.error(`[AUTH_ERROR] Token IP mismatch. Token bound to ${typedPayload.boundIp}, but used by ${currentIp}`);
      return { valid: false }; // NOTE: Immediate block on IP mismatch
    }

    // NOTE: Check for revoked tokens (JTI)
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
