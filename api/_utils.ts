// api/_utils.ts
import { jwtVerify } from 'jose';
import { logger } from './_logger';
import { applyPrivacyMasking as corePrivacyMasking } from '../src/utils/privacyFilter';

export const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : [];

  const origins = [
    ...envOrigins
  ].filter(Boolean) as string[];

  if (process.env.NODE_ENV !== 'production') {
    origins.push("http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173");
  }
  return origins;
};

// --- IP Ban & Blacklist Logic ---
// 환경 변수로부터 영구 차단 IP 목록 로드
const getBlacklistedIps = () => {
  return new Set(
    (process.env.BLACKLISTED_IPS || "")
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
  );
};

// --- Redis Helper ---
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
  // 1. 영구 차단 IP 검사
  const blacklistedIps = getBlacklistedIps();
  if (blacklistedIps.has(ip)) {
    return true;
  }

  // 2. Redis 검사 (if available) - Edge 환경에서 In-Memory 캐시 제거 (서버리스 분산 노드 간 동기화 불가능)
  const data = await redisFetch(`/get/banned_ip:${ip}`);
  if (data && (data.result === "true" || data.result === true)) {
    return true;
  }

  return false;
}

export async function banIp(ip: string, durationMinutes: number = 60) {
  // Redis Sync (if available) - Edge 환경에서 In-Memory 캐시 제거
  const seconds = durationMinutes * 60;
  await redisFetch(`/set/banned_ip:${ip}/true/ex/${seconds}`);
}

// --- Rate Limiting Logic ---
const MAX_REQUESTS = 20; // 분당 최대 20회 요청 허용
const MAX_VIOLATIONS = 5; // 제한 초과 5회 누적 시 IP 차단

// In-Memory Cache for Single Isolate Burst Protection
// 주의: Vercel Edge 환경에서는 이 캐시가 전역으로 공유되지 않으며(Isolate 단위로 초기화됨), 
// Redis 장애 시 최소한의 무차별 대입(DDoS)을 막기 위한 1차 방어선(Burst Limiter) 역할만 수행합니다.
const isolateBurstCache = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(identifier: string, maxRequests: number = MAX_REQUESTS, ip?: string): Promise<boolean> {
  if (identifier === 'unknown_ip') return false;
  const localKey = `rl:${identifier}`;
  const now = Date.now();
  const windowMs = 60 * 1000;

  // 1차 방어선: Isolate Burst Cache (Redis를 타기 전 극단적인 폭주 방지)
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

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  // Redis 미설정 시 로컬 메모리 캐시 결과에 의존 (Fallback)
  if (!upstashUrl || !upstashToken) return true;

  try {
    const key = `ratelimit:${identifier}`;
    // pipeline 대신 개별 fetch 사용 (Edge 호환성 및 단순화)
    const incrRes = await fetch(`${upstashUrl}/incr/${key}`, {
      headers: { Authorization: `Bearer ${upstashToken}` }
    });
    
    if (!incrRes.ok) return true; // Redis 오류 시 통과 (로컬 캐시가 이미 방어 중)

    const data = await incrRes.json();
    const count = parseInt(data.result, 10);
    
    if (Number.isNaN(count)) return true; // Redis 비정상 응답 시 로컬 캐시 결과에 의존

    if (count === 1) {
      await fetch(`${upstashUrl}/expire/${key}/60`, {
        headers: { Authorization: `Bearer ${upstashToken}` }
      });
    }

    return count <= maxRequests;
  } catch (error) {
    logger.warn('[RATE_LIMIT_ERROR] Failed to check limit', error);
    return true; // 에러 발생 시 로컬 캐시에 의존하여 통과
  }
}

export function getClientIp(req: Request): string {
  // 1. Vercel 환경: x-vercel-forwarded-for는 조작 불가능한 신뢰할 수 있는 헤더입니다.
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const ip = vercelIp.split(',')[0].trim();
    if (isValidIp(ip)) return ip;
  }

  // 2. 비 Vercel 환경 (로컬, 커스텀 프록시): x-forwarded-for 파싱
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // 보안: IP 스푸핑을 방지하기 위해 클라이언트가 제공한 첫 번째 IP가 아닌, 
    // 가장 신뢰할 수 있는 (가장 마지막으로 거쳐온) 프록시 IP를 사용합니다.
    const ips = forwarded.split(',').map(ip => ip.trim());
    const ip = ips[ips.length - 1];
    if (isValidIp(ip)) return ip;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp.trim())) return realIp.trim();

  return "unknown_ip";
}

function isValidIp(ip: string): boolean {
  // 간단한 IPv4/IPv6 유효성 검사로 악의적인 NoSQL Injection이나 Key 변조 방지
  return /^([a-fA-F0-9:.]+)$/.test(ip);
}

// --- Token Revocation (Blacklist) Logic ---

export async function revokeToken(jti: string) {
  // Redis Blacklist (if available) - Edge 환경에서 In-Memory 캐시 제거
  // Blacklist for 24h (86400s) to match token expiration
  await redisFetch(`/set/blacklist:${jti}/true/ex/86400`);
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  // Check Redis Blacklist (if available) - Edge 환경에서 In-Memory 캐시 제거
  const data = await redisFetch(`/get/blacklist:${jti}`);
  if (data && (data.result === "true" || data.result === true)) {
    return true;
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
        const MAX_DAILY_QUOTA = process.env.MAX_DAILY_QUOTA ? parseInt(process.env.MAX_DAILY_QUOTA, 10) : 20;
        
        if (!Number.isNaN(currentDailyRequests) && currentDailyRequests > MAX_DAILY_QUOTA) {
          logger.warn(`[DAILY_QUOTA_EXCEEDED] Identifier: ${identifier}`);
          return true;
        }
      }
    }
  } catch (err) {
    logger.error("[DAILY_QUOTA_REDIS_ERR]", err);
    // Fallback to allow request if Redis fails, to prevent total service outage
  }
  return false;
}



export const applyPrivacyMasking = (text: string) => {
  return corePrivacyMasking(text);
};

// JWT 검증 로직
export async function verifyAuthToken(req: Request): Promise<{ valid: boolean; payload?: { jti?: string, boundIp?: string, [key: string]: unknown } }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false };
  }

  const token = authHeader.split(" ")[1];
  const secretKey = process.env.JWT_SECRET;
  
  if (!secretKey) {
    logger.error("[AUTH_ERROR] JWT_SECRET is not defined! Rejecting request.");
    return { valid: false };
  }

  try {
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    
    const typedPayload = payload as { jti?: string, boundIp?: string, [key: string]: unknown };
    
    // IP 검증 (boundIp와 현재 IP 비교)
    // 모바일 기기 네트워크 전환 등 정상적인 환경 변화에서 로그아웃되는 문제를 방지하기 위해,
    // 엄격한 일치 검사 대신 경고 로깅만 남기고 토큰 자체의 유효성(서명 및 만료 시간) 신뢰.
    const isVercel = !!process.env.VERCEL;
    const currentIp = getClientIp(req);
    if (isVercel && typedPayload.boundIp && typedPayload.boundIp !== 'unknown' && currentIp !== 'unknown' && typedPayload.boundIp !== currentIp) {
      logger.warn(`[AUTH_WARN] Token IP mismatch. Token bound to ${typedPayload.boundIp}, but used by ${currentIp}`);
      // return { valid: false }; 대신 경고만 남기고 통과시킵니다.
    }

    // 탈취된 토큰(JTI) 차단 검사
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
