import { SignJWT } from 'jose';
import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { getJwtSecret, getClientIp } from './_utils';

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
    try {
      const secret = new TextEncoder().encode(getJwtSecret());
      const alg = 'HS256';

      const jti = crypto.randomUUID();
      const clientIp = await getClientIp(req);
      if (clientIp === "unknown_ip") {
        return new Response(JSON.stringify({ error: "IP_IDENTIFICATION_FAILED" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      
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
