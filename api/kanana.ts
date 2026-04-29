import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { handleDailyQuota } from './_utils';
import { processKananaMessages } from './_kananaUtils';
import { AI_PROVIDERS } from './_aiProviders';
import { createVercelKeepAliveStream } from './_streamUtils';
import { 
  parseKananaPayload, 
  initializeAsyncJob, 
  executeAsyncJob, 
  executeSyncJob 
} from './_kananaService';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request, executionCtx?: any) {
  return withApiMiddleware(req, {
    allowedMethods: ['POST'],
    requireAuth: false,
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
    
    // fix: Prevent timeouts on Vercel Free Tier by disabling heavy audio payloads
    const isVercelEnv = process.env.VERCEL === '1';
    const useAudio = !isVercelEnv && (extra_body?.audio?.voice ? true : false);
    
    const processedResult = processKananaMessages(messages, context.rateLimitIdentifier);
    if ('error' in processedResult && processedResult.error) {
      return new Response(JSON.stringify({ 
        error: processedResult.error, 
        message: processedResult.message 
      }), { status: processedResult.status, headers: { 'Content-Type': 'application/json' } });
    }
    
    const maskedMessages = ('processedMessages' in processedResult) ? processedResult.processedMessages : messages;

    let baseUrl = apiEndpoint.replace(/\/+$/, "");
    if (!baseUrl.endsWith("/chat/completions")) {
      if (baseUrl.endsWith("/inference/kanana")) {
        // Kakao Kanana endpoint
      } else if (baseUrl.endsWith("/v1")) {
        baseUrl = `${baseUrl}/chat/completions`;
      } else {
        baseUrl = `${baseUrl}/v1/chat/completions`;
      }
    }
    const finalUrl = baseUrl;

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
    
    if (extra_body) {
      requestBody.extra_body = {
        latency_first: extra_body.latency_first !== undefined ? extra_body.latency_first : true
      };
    } else {
      requestBody.extra_body = { latency_first: true };
    }
    
    if (useAudio) {
      if (!requestBody.extra_body) requestBody.extra_body = {};
      requestBody.extra_body.audio = { 
        voice: extra_body?.audio?.voice || AI_PROVIDERS.KANANA.VOICE_PRESET
      };
      if (extra_body?.audio?.format) {
        requestBody.extra_body.audio.format = extra_body.audio.format;
      }
    }

    if (useAsyncQueue) {
      const secureRandomBuffer = new Uint8Array(32);
      crypto.getRandomValues(secureRandomBuffer);
      const jobId = Array.from(secureRandomBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const isInitSuccess = await initializeAsyncJob(jobId);
      if (!isInitSuccess) {
        return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: "Failed to initialize async job." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      if (context && context.waitUntil) {
        context.waitUntil(executeAsyncJob(jobId, finalUrl, apiKey, requestBody, KANANA_TIMEOUT_MS));
        return new Response(JSON.stringify({ job_id: jobId }), {
          status: 202,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        logger.warn("[Vercel_Edge] context.waitUntil missing. Falling back to stream mode to prevent job evaporation.");
      }
    }

    if (stream && (!useAsyncQueue)) {
      const customStream = createVercelKeepAliveStream(finalUrl, apiKey, requestBody, KANANA_TIMEOUT_MS);
      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    return await executeSyncJob(finalUrl, apiKey, requestBody, KANANA_TIMEOUT_MS);

  }, executionCtx);
}
