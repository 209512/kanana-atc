import { logger } from './_logger';

export function createVercelKeepAliveStream(finalUrl: string, apiKey: string, requestBody: any, timeoutMs: number): ReadableStream {
  const encoder = new TextEncoder();
  
  return new ReadableStream({
    async start(controller) {

      controller.enqueue(encoder.encode(": keep-alive\n\n"));

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 5000);

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

        clearInterval(keepAliveInterval);

        if (!kakaoResponse.ok) {
          const status = kakaoResponse.status;
          let rawError = "Unknown error";
          try { rawError = await kakaoResponse.text(); } catch {}
          logger.error(`[KANANA_API_ERR] status: ${status}, raw: ${rawError}`);
          controller.enqueue(encoder.encode(`data: {"error": "HTTP_${status}"}\n\n`));
          controller.close();
          return;
        }

        const contentType = kakaoResponse.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          const reader = kakaoResponse.body?.getReader();
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            reader.releaseLock();
          }
        } else {

          const data = await kakaoResponse.json();
          const choice = data.choices?.[0]?.message;
          const payload = {
            message: choice?.content || "",
            audio: choice?.audio?.data || choice?.audio || null
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
      } catch (err: any) {
        clearInterval(keepAliveInterval);
        logger.error("[KANANA_STREAM_ERR]", err);
        controller.enqueue(encoder.encode(`data: {"error": "INTERNAL_ERROR", "message": "${err.message}"}\n\n`));
      } finally {
        controller.close();
      }
    }
  });
}
