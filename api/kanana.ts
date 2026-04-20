// api/kanana.ts
import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { z } from 'zod';
import { handleDailyQuota, redisFetch } from './_utils';
import { processKananaMessages } from './_kananaUtils';

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
    const apiEndpoint = (process.env.KANANA_ENDPOINT || "").trim();
    const model = (process.env.KANANA_MODEL || "kanana-o").trim();

    if (!apiKey || !apiEndpoint) {
      return new Response(JSON.stringify({ 
        error: "MISSING_API_KEY", 
        message: "Missing API Key. Please provide a valid Kanana API Key." 
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    let body;
    try {
      const rawBody = await req.json();
      body = KananaPayloadSchema.parse(rawBody);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({ error: "INVALID_INPUT", message: (error as any).errors || (error as any).issues }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const { messages, stream, async: isAsyncJob, extra_body, modalities } = body;
    const useAudio = extra_body?.audio?.voice ? true : false;
    
    // 메시지 전처리 (프롬프트 인젝션 방어, 병합, PII 마스킹)
    const processedResult = processKananaMessages(messages, context.rateLimitIdentifier);
    if (processedResult.error) {
      return new Response(JSON.stringify({ 
        error: processedResult.error, 
        message: processedResult.message 
      }), { status: processedResult.status, headers: { 'Content-Type': 'application/json' } });
    }
    
    const maskedMessages = processedResult.processedMessages;

    let baseUrl = apiEndpoint.replace(/\/$/, "");
    if (!baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.endsWith("/v1/chat/completions") 
        ? baseUrl.replace("/chat/completions", "") 
        : `${baseUrl}/v1`;
    }
    const finalUrl = `${baseUrl}/chat/completions`;

    // 추가 파라미터 검증 (보안: 필요한 필드만 화이트리스트 방식으로 허용)
    // latency_first는 Kanana API 스펙에 맞춰 Root(최상단) 파라미터로 병합되도록 아래 requestBody에서 처리합니다.

    // Kanana-O API 호출
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    const hasRedis = !!(upstashUrl && upstashToken);

    // [중요 수정] Kanana-o API FAQ 및 개발 가이드라인에 맞춘 파라미터 구조
    // latency_first는 extra_body 하위에 위치해야 함.
    // streaming 옵션은 latency_first와 결합하여 첫 청크 반환속도를 높이기 위해 필요함
    const requestBody: any = {
      model: model,
      messages: maskedMessages,
      modalities: modalities || (useAudio ? ["text", "audio"] : ["text"]),
      stream: !!stream && (!isAsyncJob || !hasRedis),
      extra_body: {
        ...(extra_body || {}),
        latency_first: extra_body?.latency_first !== undefined ? extra_body.latency_first : true
      }
    };
    if (useAudio) {
      requestBody.audio = { 
        voice: extra_body?.audio?.voice || "preset_spk_1"
      };
      if (extra_body?.audio?.format) {
        requestBody.audio.format = extra_body.audio.format;
      }
    }

    if (isAsyncJob && hasRedis) {
      const jobId = crypto.randomUUID();
      
      const runJob = async () => {
        try {
          await redisFetch(`/pipeline`, {
            method: 'POST',
            body: JSON.stringify([
              ["SET", `job:${jobId}`, JSON.stringify({ status: "pending" })],
              ["EXPIRE", `job:${jobId}`, 3600]
            ])
          });

          const kakaoResponse = await fetch(finalUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            // Vercel Edge 무료 티어 최대 실행 시간(10초)을 고려하여
            // 컨테이너가 504 에러로 뻗기 전에 안전하게 실패 처리(Fail-fast)를 하도록 수정
            signal: AbortSignal.timeout(9500) 
          });

          if (!kakaoResponse.ok) {
            const status = kakaoResponse.status;
            let rawError = "Unknown error";
            try { rawError = await kakaoResponse.text(); } catch (_) { /* ignore */ }
            logger.error(`[KANANA_ASYNC_ERR] job: ${jobId}, status: ${status}, raw: ${rawError}`);
            
            await redisFetch(`/pipeline`, {
              method: 'POST',
              body: JSON.stringify([
                ["SET", `job:${jobId}`, JSON.stringify({ status: "failed", error: `HTTP_${status}` })],
                ["EXPIRE", `job:${jobId}`, 3600]
              ])
            });
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
          });

        } catch (err) {
          logger.error(`[KANANA_ASYNC_ERR] job: ${jobId}`, err);
          await redisFetch(`/pipeline`, {
            method: 'POST',
            body: JSON.stringify([
              ["SET", `job:${jobId}`, JSON.stringify({ status: "failed", error: "INTERNAL_ERROR" })],
              ["EXPIRE", `job:${jobId}`, 3600]
            ])
          });
        }
      };

      if (context.waitUntil) {
        context.waitUntil(runJob());
      } else {
        // Fallback if waitUntil is not available (e.g. dev mode without edge runtime simulation)
        // 서버리스 컨테이너 파괴로 인한 비동기 작업(runJob) 강제 종료를 막기 위해 await 추가 (Silent Death 해결)
        await runJob();
      }

      return new Response(JSON.stringify({ job_id: jobId }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    }

    const kakaoResponse = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      // Vercel Edge 무료 티어(10초)에서 Vercel Timeout(504) 발생 전에 자체 타임아웃
      signal: AbortSignal.timeout(9500)
    });

    if (!kakaoResponse.ok) {
      const status = kakaoResponse.status;
      let rawError = "Unknown error";
      try {
        const data = await kakaoResponse.json();
        rawError = JSON.stringify(data);
      } catch (_e) {
        // ignore
      }

      logger.error(`[KANANA_API_ERR] status: ${status}, raw: ${rawError}`);

      let errorKey = `HTTP_${status}`;
      if (status === 401) errorKey = "INVALID_API_KEY";
      if (status === 429) errorKey = "QUOTA_EXCEEDED";
      if (status === 500) errorKey = "SERVICE_TEMPORARILY_UNAVAILABLE"; // FAQ 에러 코드 반영

      return new Response(JSON.stringify({ error: errorKey, message: "Upstream service error" }), { 
        status,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (stream && (!isAsyncJob || !hasRedis)) {
      return new Response(kakaoResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    } else {
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
    }
  }, executionCtx);
}
