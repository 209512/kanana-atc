// api/gemini.ts
import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { z } from 'zod';

export const config = {
  runtime: 'edge',
};

const GeminiPayloadSchema = z.object({
  systemPrompt: z.string().max(2000).optional(),
  persona: z.string().max(2000).optional(),
  agentId: z.string().max(100).optional(),
  agentName: z.string().max(100).optional(),
  state: z.any().optional(),
  externalData: z.record(z.string(), z.any()).optional(),
  image: z.string().optional() // Base64 이미지 데이터 (선택사항)
});

export default async function handler(req: Request) {
  return withApiMiddleware(req, {
    allowedMethods: ['POST'],
    requireAuth: true,
    rateLimitMaxRequests: 20
  }, async (req, _context) => {
    const agentKeysHeader = req.headers.get('x-agent-keys');
    let customGeminiKey = "";
    if (agentKeysHeader) {
      try {
        const keysMap = JSON.parse(agentKeysHeader);
      } catch (e) {}
    }

    let body;
    try {
      const rawBody = await req.json();
      body = GeminiPayloadSchema.parse(rawBody);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({ error: "INVALID_INPUT", message: (error as any).errors || (error as any).issues }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { systemPrompt, persona, agentId, agentName, state, externalData, image } = body;

    const agentIdentifier = agentId || agentName;
    if (agentKeysHeader && agentIdentifier) {
      try {
        const keysMap = JSON.parse(agentKeysHeader);
        const agentKeyObj = keysMap[agentIdentifier];
        if (agentKeyObj && (agentKeyObj as any).gemini) {
          customGeminiKey = (agentKeyObj as any).gemini;
        }
      } catch (e) {}
    }

    const apiKey = (customGeminiKey || process.env.GEMINI_API_KEY || "").trim();
    const model = (process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();
    const apiEndpoint = (process.env.GEMINI_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models").trim();

    // 환경변수에 GEMINI_API_KEY가 없으면 백엔드에서 자체적으로 Mock(상태 변화 시뮬레이션)을 반환합니다.
    if (!apiKey) {
      logger.info(`[GEMINI_MOCK] No API Key found. Returning simulated response for ${agentName}`);
      const riskLevel = externalData?.risk_level ? Number(externalData.risk_level) : 5;
      const mockResponse = {
        log: JSON.stringify({
          message: `Mocked Gemini Response for ${agentName} (Risk: ${riskLevel})`,
          risk_level: riskLevel,
          condition: riskLevel >= 8 ? "CRITICAL" : "NORMAL",
          temp: 25,
          humidity: 60,
          strategy: riskLevel >= 8 ? "Evacuate immediately" : null
        })
      };
      return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 간단한 스키마 검증 및 길이 제한 (보안/안정성)
    if (state && JSON.stringify(state).length > 20000) {
      return new Response(JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: "state 페이로드가 너무 큽니다." }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    
    // 환경 데이터에 따른 지역 설정 (기본값 서울)
    const region = externalData?.location ? String(externalData.location) : "Seoul";
    // 외부 데이터가 프론트에서 주입되었다면 우선 사용
    let weather = externalData?.weather;
    let tempData = externalData?.temp ? String(externalData.temp) : "20";
    let humidityData = externalData?.humidity ? String(externalData.humidity) : "50";
    const economyStatus = externalData?.economy;
    const newsStatus = externalData?.news;

    // 외부 날씨 데이터가 없고, 기본값인 경우 wttr.in 호출 시도
    const isMock = process.env.VITE_USE_MOCK === 'true' || process.env.NODE_ENV !== 'production';
    if (!externalData?.weather && !isMock) {
        const WTTR_URL = process.env.WTTR_URL;
      if (WTTR_URL) {
        try {
          const weatherRes = await fetch(WTTR_URL.replace('{region}', encodeURIComponent(region)), {
            signal: AbortSignal.timeout(3000)
          });
          
          if (weatherRes && weatherRes.ok) {
            const wData = await weatherRes.json();
            const currentCond = wData.current_condition?.[0];
            if (currentCond) {
              weather = `${region} Weather: ${currentCond.weatherDesc?.[0]?.value || 'Unknown'}, Temp: ${currentCond.temp_C}°C, Humidity: ${currentCond.humidity}%, Wind: ${currentCond.windspeedKmph}km/h`;
              tempData = currentCond.temp_C;
              humidityData = currentCond.humidity;
            }
          }
        } catch (error) {
          logger.warn(`[GEMINI_WEATHER_FETCH_ERR] Failed to fetch weather for ${region}`, error);
        }
      }
    }

    const safeAgentName = JSON.stringify(agentName || "Unknown");
    const safeSystemPrompt = JSON.stringify(systemPrompt || 'DEFAULT_AGENT');
    const safePersona = JSON.stringify(persona || 'GENERAL_RECON_DRONE');

    const weatherText = weather || "WEATHER_NORMAL";
    const economyText = economyStatus || "ECONOMY_STABLE";
    const newsText = newsStatus || "NEWS_NONE";

    // 3. 모드 스위칭 동적 할당 로직
    // 외부 데이터(externalData)를 통해 risk_level을 받으면 그에 따라 역할(Mode)을 능동/수동으로 전환합니다.
    const currentRisk = externalData?.risk_level ? parseInt(String(externalData.risk_level), 10) : 0;
    const isTacticalMode = currentRisk >= 8;
    const modeDescription = isTacticalMode 
      ? `🚨 [TACTICAL MODE ACTIVE] You are no longer just a sensor. You are a Tactical Field Commander. The risk level is critical (${currentRisk}/10). Analyze the environment and provide an actionable solution or warning in the 'strategy' field. Make sure to consider the visual input if provided.`
      : `🟢 [SENSOR MODE] You are a recon drone. The risk level is low/moderate (${currentRisk}/10). Focus on observing and reporting the current environment accurately. Do not suggest any strategies.`;

    const prompt = `
<system_role>
You are an advanced digital twin agent drone representing "${agentName || 'Agent'}".
Your task is to analyze your current state, external data, and visual input (if provided) to report back to Kanana-o (The ATC Commander).
${modeDescription}
</system_role>

<agent_info>
Name: ${agentName || 'Unknown'}
State: ${state ? JSON.stringify(state) : 'No state provided'}
</agent_info>

<external_environment>
Weather: ${weather}
Temp: ${tempData}
Humidity: ${humidityData}
News/Economy/Events: ${externalData ? JSON.stringify(externalData) : 'None'}
</external_environment>

<instructions>
1. Synthesize the <agent_info>, <external_environment>, and any provided image.
2. Based on the data, determine your current condition and risk level (0-10).
3. Create a short, 1-2 sentence report message in Korean.
4. If in TACTICAL MODE, suggest a specific action or warning in the 'strategy' field.
5. Return ONLY a valid JSON object in the exact format below. Do not add extra explanations or markdown blocks.

{
  "status": "active" | "emergency" | "warning",
  "code": "A unique 4-letter code like WTHR, ECON, NORM",
  "message": "Your short korean report here",
  "condition": "FIRE_DETECTED" | "WIND_WARNING" | "ECONOMY_CRITICAL" | "NORMAL",
  "risk_level": number (0-10),
  "temp": number,
  "humidity": number,
  "strategy": "Your tactical suggestion here (if any, otherwise null)"
}
</instructions>
    `;

    // 4. 멀티모달 파트 구성 (이미지가 있으면 추가)
    const parts: any[] = [{ text: prompt }];
    if (image && image.startsWith("data:image/")) {
      try {
        const mimeType = image.split(';')[0].split(':')[1];
        const base64Data = image.split(',')[1];
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      } catch (err) {
        logger.error("[GEMINI_IMAGE_PARSE_ERR]", err);
      }
    }

    const payload = {
      contents: [{
        role: "user",
        parts: parts
      }],
      generationConfig: {
        temperature: 0.2, // 결정론적 JSON 출력을 위해 낮춤
        maxOutputTokens: 200, // 확장된 필드 수용을 위해 토큰 상향
        responseMimeType: "application/json" // Gemini가 무조건 JSON 포맷으로만 응답하도록 강제 (Structured Output)
      }
    };

    const finalUrl = `${apiEndpoint}/${model}:generateContent?key=${apiKey}`;

    // 5. Exponential Backoff 재시도 로직 적용 (Gemini 1.5 Flash Rate Limit 방어)
    const MAX_RETRIES = 3;
    let response: Response | null = null;
    let attempt = 0;
    
    while (attempt <= MAX_RETRIES) {
      try {
        response = await fetch(finalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          // Vercel Edge 환경 504 타임아웃 방어용 (Gemini 응답 대기 시간 제한)
          signal: AbortSignal.timeout(25000)
        });

        // 429 에러(Rate Limit)일 경우에만 백오프 재시도
        if (response.status === 429 && attempt < MAX_RETRIES) {
          const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 500; // 지수 백오프 + Jitter
          logger.warn(`[GEMINI_API_429] Rate limited. Retrying ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoffDelay)}ms`);
          await new Promise(res => setTimeout(res, backoffDelay));
          attempt++;
          continue;
        }

        break; // 429가 아니거나 최대 재시도 도달 시 루프 탈출
      } catch (err: any) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          logger.error(`[GEMINI_API_TIMEOUT] Attempt ${attempt + 1} timed out.`);
          if (attempt < MAX_RETRIES) {
            const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            await new Promise(res => setTimeout(res, backoffDelay));
            attempt++;
            continue;
          }
        }
        throw err; // 네트워크 에러 등은 그대로 throw
      }
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 504;
      let rawError = "Unknown error";
      if (response) {
        try {
          const data = await response.json();
          rawError = JSON.stringify(data);
        } catch (_e) {
          // ignore
        }
      }

      logger.error(`[GEMINI_API_ERR] status: ${status}, raw: ${rawError}`);

      let errorKey = `HTTP_${status}`;
      if (status === 401) errorKey = "INVALID_API_KEY";
      if (status === 429) errorKey = "QUOTA_EXCEEDED";
      if (status === 500) errorKey = "INTERNAL_SERVER_ERROR";
      if (status === 504) errorKey = "GATEWAY_TIMEOUT";
      return new Response(JSON.stringify({ error: errorKey }), { status, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const logText = data.candidates?.[0]?.content?.parts?.[0]?.text || "상태 이상 없음";

    return new Response(JSON.stringify({ log: logText }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}
