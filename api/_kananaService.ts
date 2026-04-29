import { z } from 'zod';
import { logger } from './_logger';
import { redisFetch } from './_utils';
import { AI_PROVIDERS } from './_aiProviders';

export const KananaPayloadSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.any()
  })).max(50),
  stream: z.boolean().optional(),
  async: z.boolean().optional(),
  extra_body: z.any().optional(),
  modalities: z.array(z.string()).optional()
});

export const parseKananaPayload = async (req: Request) => {
  try {
    const rawBody = await req.json();
    return { body: KananaPayloadSchema.parse(rawBody), error: null };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { 
        body: null, 
        error: new Response(JSON.stringify({ error: "INVALID_INPUT", message: error.issues }), { status: 400, headers: { 'Content-Type': 'application/json' } }) 
      };
    }
    return { 
      body: null, 
      error: new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: { 'Content-Type': 'application/json' } }) 
    };
  }
};

export const initializeAsyncJob = async (jobId: string) => {
  try {
    await redisFetch(`/pipeline`, {
      method: 'POST',
      body: JSON.stringify([
        ["SET", `job:${jobId}`, JSON.stringify({ status: "pending" })],
        ["EXPIRE", `job:${jobId}`, 3600]
      ])
    });
    return true;
  } catch (err) {
    logger.error("[REDIS_INIT_ERR] Failed to initialize job in Redis", err);
    return false;
  }
};

export const updateAsyncJobStatus = async (jobId: string, status: string, resultOrError: any) => {
  const payload: any = { status };
  if (status === "failed") {
    payload.error = resultOrError;
  } else {
    payload.result = resultOrError;
  }
  
  await redisFetch(`/pipeline`, {
    method: 'POST',
    body: JSON.stringify([
      ["SET", `job:${jobId}`, JSON.stringify(payload)],
      ["EXPIRE", `job:${jobId}`, 3600]
    ])
  }).catch(e => logger.error("[REDIS_WRITE_ERR]", e));
};

export const executeAsyncJob = async (jobId: string, finalUrl: string, apiKey: string, requestBody: any, timeoutMs: number) => {
  try {
    const kakaoResponse = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs) 
    });

    if (!kakaoResponse.ok) {
      const status = kakaoResponse.status;
      let rawError = "Unknown error";
      try { rawError = await kakaoResponse.text(); } catch { logger.warn('Failed to parse error response text'); }
      logger.error(`[KANANA_ASYNC_ERR] job: ${jobId}, status: ${status}, raw: ${rawError}`);
      
      await updateAsyncJobStatus(jobId, "failed", `HTTP_${status}`);
      return;
    }

    const data = await kakaoResponse.json();
    const choice = data.choices?.[0]?.message;
    const audioData = choice?.audio?.data || choice?.audio || null;

    await updateAsyncJobStatus(jobId, "completed", {
      message: choice?.content || "",
      audio: audioData
    });

  } catch (err) {
    logger.error(`[KANANA_ASYNC_ERR] job: ${jobId}`, err);
    await updateAsyncJobStatus(jobId, "failed", "INTERNAL_ERROR");
  }
};

export const executeSyncJob = async (finalUrl: string, apiKey: string, requestBody: any, timeoutMs: number) => {
  const kakaoResponse = await fetch(finalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!kakaoResponse.ok) {
    const status = kakaoResponse.status;
    let rawError = "Unknown error";
    try {
      const data = await kakaoResponse.json();
      rawError = JSON.stringify(data);
    } catch {
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
};
