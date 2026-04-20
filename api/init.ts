// api/init.ts
import { SignJWT } from 'jose';
import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  return withApiMiddleware(req, {
    allowedMethods: ['GET'],
    requireAuth: false,
    rateLimitMaxRequests: 5,
    rateLimitKeyPrefix: 'init'
  }, async (req, _context) => {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      logger.error("[INIT_API_ERROR] JWT_SECRET is missing!");
      return new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR", message: "Server configuration error." }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    try {
      const secret = new TextEncoder().encode(secretKey);
      const alg = 'HS256';
      
      // 게스트용 익명 토큰 발급 (24시간 유효, 고유 JTI 부여)
      const jti = crypto.randomUUID();
      const clientIp = req.headers.get("x-vercel-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(',')[0].trim() || "unknown";
      
      const token = await new SignJWT({ role: 'guest', boundIp: clientIp })
        .setProtectedHeader({ alg })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      return new Response(JSON.stringify({ token }), { 
        status: 200, 
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        } 
      });
    } catch (err) {
      logger.error("[INIT_API_ERROR]", err);
      return new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  });
}
