// api/kanana.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS 및 보안 검증
  const origin = (req.headers.origin as string) || "";
  const isAllowed = 
    !origin || 
    origin.includes("localhost") || 
    origin.includes("127.0.0.1") ||
    origin.endsWith(".vercel.app");
  
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : "null");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  const apiKey = (process.env.KANANA_API_KEY || "").trim();
  const apiEndpoint = (process.env.KANANA_ENDPOINT || "").trim();

  if (!isAllowed && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: "FORBIDDEN_ORIGIN" });
  }

  if (!apiKey || !apiEndpoint) {
    return res.status(500).json({ 
      error: "CONFIG_ERROR", 
      message: "Vercel 환경변수(API_KEY 또는 ENDPOINT) 설정이 누락되었습니다." 
    });
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }

    const { messages } = req.body;
    
    let baseUrl = apiEndpoint.replace(/\/$/, "");
    if (!baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.endsWith("/v1/chat/completions") 
        ? baseUrl.replace("/chat/completions", "") 
        : `${baseUrl}/v1`;
    }
    const finalUrl = `${baseUrl}/chat/completions`;

    const kakaoResponse = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "kanana-o",
        messages: [
          { 
            role: "system", 
            content: `You are a professional ATC AI Controller. 
            If an urgent action is needed, include one of these tags in your response:
            - [ACTION:PAUSE:uuid] to suspend a drone.
            - [ACTION:PRIORITY:uuid] to give priority.
            Keep insights brief and tactical.` 
          },
          ...(messages || [])
        ],
        modalities: ["text"], // 음성 활성 시 ["text", "audio"]로 변경
        stream: false 
      }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await kakaoResponse.json();

    if (!kakaoResponse.ok) {
      const status = kakaoResponse.status;
      let errorKey = data.error || `HTTP_${status}`;
      if (status === 429) errorKey = "QUOTA_EXCEEDED";
      if (status === 500) errorKey = "GPU_SERVER_OVERLOAD";

      res.setHeader("Access-Control-Allow-Origin", origin);
      return res.status(status).json({ error: errorKey, details: data });
    }

    const choice = data.choices?.[0]?.message;
    const audioData = choice?.audio?.data || choice?.audio || null;

    res.setHeader("Access-Control-Allow-Origin", origin);
    return res.status(200).json({
      message: choice?.content || "",
      audio: audioData
    });
  
  } catch (err: any) {
    console.error("[ATC_SERVER_ERR]", err);
    res.setHeader("Access-Control-Allow-Origin", origin);
    
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({ 
      error: isTimeout ? "GATEWAY_TIMEOUT" : "INTERNAL_SERVER_ERROR",
      message: err.message 
    });
  }
}