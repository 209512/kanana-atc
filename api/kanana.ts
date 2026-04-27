import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { z } from 'zod';
import { handleDailyQuota, redisFetch } from './_utils';
import { processKananaMessages } from './_kananaUtils';
import { AI_PROVIDERS } from './_aiProviders';

import { createVercelKeepAliveStream } from './_streamUtils';

export const config = {
  runtime: 'edge',
};

const KananaPayloadSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.any()
  })).max(50),
  stream: z.boolean().optional(),
  async: z.boolean().optional(),
  extra_body: z.any().optional(),
  modalities: z.array(z.string()).optional()
});

const parseKananaPayload = async (req: Request) => {
  try {
    const rawBody = await req.json();
    return { body: KananaPayloadSchema.parse(rawBody), error: null };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { body: null, error: new Response(JSON.stringify({ error: "INVALID_INPUT", message: (error as any).errors || (error as any).issues }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
    }
    return { body: null, error: new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
  }
};

export default async function handler(req: Request, executionCtx?: any) {
  return withApiMiddleware(req, {
    allowedMethods: ['POST'],
    requireAuth: true,
    rateLimitMaxRequests: 20
  }, async (req, context) => {
    const quotaExceeded = await handleDailyQuota(context.rateLimitIdentifier);
    if (quotaExceeded) {
      return new Response(JSON.stringify({ 
        error: "QUOTA_EXCEEDED", 
        message: "Daily quota exceeded. It will reset tomorrow at 00:00." 
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    
    const clientKananaKey = req.headers.get('x-kanana-key');
    const apiKey = (clientKananaKey || process.env.KANANA_API_KEY || "").trim(); 
    const apiEndpoint = (process.env.KANANA_ENDPOINT || AI_PROVIDERS.KANANA.API_URL).trim();
    const model = (process.env.KANANA_MODEL || AI_PROVIDERS.KANANA.DEFAULT_MODEL).trim();

    if (!apiKey || !apiEndpoint) {
      return new Response(JSON.stringify({ 
        error: "CONFIG_ERROR", 
        message: "서버 설정 또는 클라이언트 API_KEY가 누락되었습니다." 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const { body, error: parseError } = await parseKananaPayload(req);
    if (parseError) return parseError;
    const MAX_PAYLOAD_LENGTH = AI_PROVIDERS.KANANA.MAX_PAYLOAD;
    const KANANA_TIMEOUT_MS = AI_PROVIDERS.KANANA.TIMEOUT_MS; 
    
    if (body && JSON.stringify(body).length > MAX_PAYLOAD_LENGTH) {
      return new Response(JSON.stringify({ error: "PAYLOAD_TOO_LARGE" }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }
    const { messages, stream, async: isAsyncJob, extra_body, modalities } = body;
    const useAudio = extra_body?.audio?.voice ? true : false;
    
    // NOTE: Preprocess messages (Injection defense, PII masking)
    const processedResult = processKananaMessages(messages, context.rateLimitIdentifier);
    if ('error' in processedResult && processedResult.error) {
      return new Response(JSON.stringify({ 
        error: processedResult.error, 
        message: processedResult.message 
      }), { status: processedResult.status, headers: { 'Content-Type': 'application/json' } });
    }
    
    const maskedMessages = ('processedMessages' in processedResult) ? processedResult.processedMessages : messages;

    let baseUrl = apiEndpoint.replace(/\/+$/, "");
    // NOTE: Preserve specific API routes for Kakao endpoints
    if (!baseUrl.endsWith("/chat/completions")) {
      if (baseUrl.endsWith("/inference/kanana")) {
        // NOTE: Kakao Kanana endpoint
      } else if (baseUrl.endsWith("/v1")) {
        baseUrl = `${baseUrl}/chat/completions`;
      } else {
        baseUrl = `${baseUrl}/v1/chat/completions`;
      }
    }
    const finalUrl = baseUrl;

    // NOTE: Whitelist extra parameters
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    const hasRedis = !!(upstashUrl && upstashToken);
    const useAsyncQueue = !!(isAsyncJob && hasRedis);

    const requestBody: any = {
      model: model,
      messages: maskedMessages,
      modalities: modalities || (useAudio ? ["text", "audio"] : ["text"]),
      stream: !!stream && (!useAsyncQueue)
    };
    
    // NOTE: Whitelist specific extra_body parameters to prevent payload injection
    // TODO: [Kanana-o API] Add support for temperature, top-p, and video modality parameters when Kakao officially opens controllability (ref: FAQ)
    if (extra_body) {
      requestBody.extra_body = {
        latency_first: extra_body.latency_first !== undefined ? extra_body.latency_first : true
      };
    } else {
      requestBody.extra_body = { latency_first: true };
    }
    
    if (useAudio) {
      if (!requestBody.extra_body) requestBody.extra_body = {};
      // NOTE: Fallback to preset_spk_1
      requestBody.extra_body.audio = { 
        voice: extra_body?.audio?.voice || AI_PROVIDERS.KANANA.VOICE_PRESET
      };
      if (extra_body?.audio?.format) {
        requestBody.extra_body.audio.format = extra_body.audio.format;
      }
    }

    if (useAsyncQueue) {
      // NOTE: Check Redis health before returning 202 to prevent infinite polling on the client side
      const secureRandomBuffer = new Uint8Array(32);
      crypto.getRandomValues(secureRandomBuffer);
      const jobId = Array.from(secureRandomBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
      
      try {
        await redisFetch(`/pipeline`, {
          method: 'POST',
          body: JSON.stringify([
            ["SET", `job:${jobId}`, JSON.stringify({ status: "pending" })],
            ["EXPIRE", `job:${jobId}`, 3600]
          ])
        });
      } catch (err) {
        logger.error("[REDIS_INIT_ERR] Failed to initialize job in Redis", err);
        return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: "Failed to initialize async job." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      const runJob = async () => {
        try {
          const kakaoResponse = await fetch(finalUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(KANANA_TIMEOUT_MS) 
          });

          if (!kakaoResponse.ok) {
            const status = kakaoResponse.status;
            let rawError = "Unknown error";
            try { rawError = await kakaoResponse.text(); } catch (_) { logger.warn('Failed to parse error response text'); }
            logger.error(`[KANANA_ASYNC_ERR] job: ${jobId}, status: ${status}, raw: ${rawError}`);
            
            await redisFetch(`/pipeline`, {
              method: 'POST',
              body: JSON.stringify([
                ["SET", `job:${jobId}`, JSON.stringify({ status: "failed", error: `HTTP_${status}` })],
                ["EXPIRE", `job:${jobId}`, 3600]
              ])
            }).catch(e => logger.error("[REDIS_WRITE_ERR]", e));
            return;
          }

          const data = await kakaoResponse.json();
          const choice = data.choices?.[0]?.message;
          const audioData = choice?.audio?.data || choice?.audio || null;

          const resultPayload = {
            status: "completed",
            result: {
              message: choice?.content || "",
              audio: audioData
            }
          };

          await redisFetch(`/pipeline`, {
            method: 'POST',
            body: JSON.stringify([
              ["SET", `job:${jobId}`, JSON.stringify(resultPayload)],
              ["EXPIRE", `job:${jobId}`, 3600]
            ])
          }).catch(e => logger.error("[REDIS_WRITE_ERR]", e));

        } catch (err) {
          logger.error(`[KANANA_ASYNC_ERR] job: ${jobId}`, err);
          await redisFetch(`/pipeline`, {
            method: 'POST',
            body: JSON.stringify([
              ["SET", `job:${jobId}`, JSON.stringify({ status: "failed", error: "INTERNAL_ERROR" })],
              ["EXPIRE", `job:${jobId}`, 3600]
            ])
          }).catch(e => logger.error("[REDIS_WRITE_ERR]", e));
        }
      };

      if (context && context.waitUntil) {
        context.waitUntil(runJob());
        return new Response(JSON.stringify({ job_id: jobId }), {
          status: 202,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        // NOTE: Do not return 202 if context.waitUntil is missing on Vercel
        // NOTE: Fallback to sync stream to prevent Edge timeout
        logger.warn("[Vercel_Edge] context.waitUntil missing. Falling back to stream mode to prevent job evaporation.");
        // NOTE: Continue to stream mode logic below
      }
    }

    if (stream && (!useAsyncQueue)) {
      // NOTE: Use modular SSE Fake Keep-Alive logic
      const customStream = createVercelKeepAliveStream(finalUrl, apiKey, requestBody, KANANA_TIMEOUT_MS);
      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    // NOTE: WARN: Synchronous requests exceeding 10s will fail on Vercel Free Tier
    const kakaoResponse = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(KANANA_TIMEOUT_MS)
    });

    if (!kakaoResponse.ok) {
      const status = kakaoResponse.status;
      let rawError = "Unknown error";
      try {
        const data = await kakaoResponse.json();
        rawError = JSON.stringify(data);
      } catch (_e) {
        logger.warn('Failed to parse error response JSON');
      }

      logger.error(`[KANANA_API_ERR] status: ${status}, raw: ${rawError}`);

      let errorKey = `HTTP_${status}`;
      if (status === 400) errorKey = "BAD_REQUEST";
      if (status === 401) errorKey = "INVALID_API_KEY";
      if (status === 429) errorKey = "QUOTA_EXCEEDED";
      if (status === 500) errorKey = "SERVICE_TEMPORARILY_UNAVAILABLE";

      return new Response(JSON.stringify({ error: errorKey, message: "Upstream service error" }), { 
        status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await kakaoResponse.json();
    const choice = data.choices?.[0]?.message;
    const audioData = choice?.audio?.data || choice?.audio || null;

    return new Response(JSON.stringify({
      message: choice?.content || "",
      audio: audioData
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, executionCtx);
}
