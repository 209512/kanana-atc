import { getAllowedOrigins, getClientIp, isIpBanned, verifyAuthToken, checkRateLimit } from './_utils';
import { logger } from './_logger';

export interface MiddlewareContext {
  origin: string;
  isAllowed: boolean;
  clientIp: string;
  authPayload?: { jti?: string, [key: string]: unknown };
  rateLimitIdentifier: string;
  waitUntil?: (promise: Promise<any>) => void;
}

export interface MiddlewareOptions {
  allowedMethods: string[];
  requireAuth: boolean;
  rateLimitMaxRequests: number;
  rateLimitKeyPrefix?: string;
}

export async function withApiMiddleware(
  req: Request,
  options: MiddlewareOptions,
  handler: (req: Request, context: MiddlewareContext) => Promise<Response>,
  executionCtx?: any
): Promise<Response> {
  const origin = req.headers.get('origin') || "";
  const allowedOrigins = getAllowedOrigins();
  
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalhost = origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
  
  // NOTE: Allow empty origin for S2S/mobile
  const isAllowed = !origin || allowedOrigins.includes(origin) || isDev || isLocalhost;

  const corsHeaders = new Headers({
    "Content-Type": "application/json"
  });
  if (isAllowed && origin) {
    corsHeaders.set("Access-Control-Allow-Origin", origin);
  }

  // NOTE: CORS Preflight
  if (req.method === "OPTIONS") {
    const responseHeaders = new Headers({
      "Access-Control-Allow-Methods": `${options.allowedMethods.join(', ')}, OPTIONS`,
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-kanana-key, x-agent-keys"
    });
    if (isAllowed && origin) {
      responseHeaders.set("Access-Control-Allow-Origin", origin);
    }
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  // NOTE: CORS Validation
  if (!isAllowed) {
    return new Response(JSON.stringify({ error: "FORBIDDEN_ORIGIN" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  // NOTE: HTTP Method Validation
  if (!options.allowedMethods.includes(req.method)) {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: corsHeaders });
  }

  const clientIp = getClientIp(req);

  // NOTE: IP Ban Check
  if (await isIpBanned(clientIp)) {
    return new Response(JSON.stringify({ 
      error: "FORBIDDEN_IP", 
      message: "차단된 IP에서 접근했습니다." 
    }), { status: 403, headers: corsHeaders });
  }

  let rateLimitIdentifier = options.rateLimitKeyPrefix ? `${options.rateLimitKeyPrefix}:${clientIp}` : clientIp;
  let authPayload: { jti?: string, [key: string]: unknown } | undefined;

  // NOTE: Authentication Check
  if (options.requireAuth) {
    if (!process.env.JWT_SECRET) {
      logger.error("[MIDDLEWARE_ERR] Server configuration error: JWT_SECRET missing");
      return new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }), { status: 500 });
    }

    const authResult = await verifyAuthToken(req);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ 
        error: "UNAUTHORIZED", 
        message: "인증되지 않은 요청입니다. 유효한 토큰이 필요합니다." 
      }), { status: 401, headers: corsHeaders });
    }
    
    authPayload = authResult.payload as { jti?: string, [key: string]: unknown };
    rateLimitIdentifier = `ip:${clientIp}`;
  }

  // NOTE: Rate Limiting Check
  if (!(await checkRateLimit(rateLimitIdentifier, options.rateLimitMaxRequests, clientIp))) {
    return new Response(JSON.stringify({ 
      error: "TOO_MANY_REQUESTS", 
      message: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요." 
    }), { status: 429, headers: corsHeaders });
  }

  // NOTE: Execute Handler
  try {
    const context: MiddlewareContext = {
      origin,
      isAllowed,
      clientIp,
      authPayload,
      rateLimitIdentifier,
      waitUntil: executionCtx?.waitUntil ? executionCtx.waitUntil.bind(executionCtx) : undefined
    };
    const response = await handler(req, context);
    
    // NOTE: Append CORS headers to response
    if (isAllowed && origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    return response;
  } catch (err: unknown) {
    logger.error("[API_MIDDLEWARE_ERR]", err);
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return new Response(JSON.stringify({ 
      error: isTimeout ? "GATEWAY_TIMEOUT" : "INTERNAL_SERVER_ERROR",
      message: "서버 내부 처리 중 오류가 발생했습니다." 
    }), {
      status: isTimeout ? 504 : 500,
      headers: corsHeaders
    });
  }
}
