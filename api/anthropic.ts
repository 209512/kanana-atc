import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { z } from 'zod';
import { AI_PROVIDERS } from './_aiProviders';

export const config = {
  runtime: 'edge',
};

const AnthropicPayloadSchema = z.object({
  systemPrompt: z.string().max(2000).optional(),
  persona: z.string().max(2000).optional(),
  agentId: z.string().max(100).optional(),
  agentName: z.string().max(100).optional(),
  state: z.any().optional(),
  externalData: z.record(z.string(), z.any()).optional(),
  image: z.string().optional()
});

export default async function handler(req: Request) {
  return withApiMiddleware(req, {
    allowedMethods: ['POST'],
    requireAuth: true,
    rateLimitMaxRequests: 20
  }, async (req) => {
    const agentKeysHeader = req.headers.get('x-agent-keys');
    let customKey = "";

    let body;
    try {
      const rawBody = await req.json();
      body = AnthropicPayloadSchema.parse(rawBody);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({ error: "INVALID_INPUT", message: (error as any).errors || (error as any).issues }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { agentId, agentName, externalData } = body;
    const agentIdentifier = agentId || agentName;

    if (agentKeysHeader && agentIdentifier) {
      try {
        const keysMap = JSON.parse(agentKeysHeader);
        const agentKeyObj = keysMap[agentIdentifier];
        if (agentKeyObj && (agentKeyObj as any).anthropic) {
          customKey = (agentKeyObj as any).anthropic;
        }
      } catch {}
    }

    const apiKey = (customKey || process.env.ANTHROPIC_API_KEY || "").trim();
    const model = (process.env.ANTHROPIC_MODEL || AI_PROVIDERS.ANTHROPIC.DEFAULT_MODEL).trim();
    const endpoint = (process.env.ANTHROPIC_ENDPOINT || AI_PROVIDERS.ANTHROPIC.API_URL).trim();

    if (!apiKey) {
      const riskLevel = externalData?.risk_level ? Number(externalData.risk_level) : 5;
      const mockResponse = {
        log: JSON.stringify({
          message: `Mocked Anthropic Response for ${agentIdentifier || "Unknown"} (Risk: ${riskLevel})`,
          risk_level: riskLevel,
          condition: riskLevel >= 8 ? "CRITICAL" : "NORMAL",
          temp: 25,
          humidity: 60,
          strategy: riskLevel >= 8 ? "Evacuate immediately" : null
        })
      };
      return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const prompt = `Return ONLY a valid JSON object with fields: status, code, message(ko), condition, risk_level(0-10), temp, humidity, strategy(null or string). No markdown.`;

    const payload = {
      model,
      max_tokens: 300,
      temperature: 0.2,
      messages: [
        { role: "user", content: `${prompt}\n\nINPUT:\n${JSON.stringify(body).slice(0, 18000)}` }
      ]
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000)
      });

      if (!res.ok) {
        logger.error(`[ANTHROPIC_API_ERR] status: ${res.status}`);
        return new Response(JSON.stringify({ error: `HTTP_${res.status}` }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      return new Response(JSON.stringify({ log: text }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      logger.error("[ANTHROPIC_API_ERR]", e);
      return new Response(JSON.stringify({ error: "GATEWAY_TIMEOUT" }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
  });
}

