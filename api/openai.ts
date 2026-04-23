import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { z } from 'zod';
import { AI_PROVIDERS } from './_aiProviders';

export const config = {
  runtime: 'edge',
};

const OpenAIPayloadSchema = z.object({
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
      body = OpenAIPayloadSchema.parse(rawBody);
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
        if (agentKeyObj && (agentKeyObj as any).openai) {
          customKey = (agentKeyObj as any).openai;
        }
      } catch {}
    }

    const apiKey = (customKey || process.env.OPENAI_API_KEY || "").trim();
    const model = (process.env.OPENAI_MODEL || AI_PROVIDERS.OPENAI.DEFAULT_MODEL).trim();
    const endpoint = (process.env.OPENAI_ENDPOINT || AI_PROVIDERS.OPENAI.API_URL).trim();

    if (!apiKey) {
      const riskLevel = externalData?.risk_level ? Number(externalData.risk_level) : 5;
      const mockResponse = {
        log: JSON.stringify({
          message: `Mocked OpenAI Response for ${agentIdentifier || "Unknown"} (Risk: ${riskLevel})`,
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
      messages: [
        { role: "system", content: "You are a drone digital twin reporting to an ATC manager." },
        { role: "user", content: `${prompt}\n\nINPUT:\n${JSON.stringify(body).slice(0, 18000)}` }
      ],
      temperature: 0.2,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000)
      });

      if (!res.ok) {
        logger.error(`[OPENAI_API_ERR] status: ${res.status}`);
        return new Response(JSON.stringify({ error: `HTTP_${res.status}` }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ log: text }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      logger.error("[OPENAI_API_ERR]", e);
      return new Response(JSON.stringify({ error: "GATEWAY_TIMEOUT" }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
  });
}

