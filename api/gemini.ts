import { withApiMiddleware } from './_middleware';
import { logger } from './_logger';
import { z } from 'zod';
import { AI_PROVIDERS } from './_aiProviders';

export const config = {
  runtime: 'edge',
};

const GeminiPayloadSchema = z.object({
  systemPrompt: z.string().max(2000).optional(),
  persona: z.string().max(2000).optional(),
  agentId: z.string().max(100).optional(),
  agentName: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  state: z.any().optional(),
  externalData: z.record(z.string(), z.any()).optional(),
  image: z.string().optional()
});

const FieldReportSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  risk_level: z.number().min(0).max(10),
  condition: z.enum(["NORMAL", "CAUTION", "CRITICAL"]),
  strategy: z.string().nullable(),
  message: z.string(),
  ts: z.number()
});

const parseReport = (agentId: string, agentName: string, externalData: any, logText: string) => {
  const fallbackRisk = externalData?.risk_level ? Number(externalData.risk_level) : 5;
  const base = {
    agentId: agentId || "AGENT",
    agentName: agentName || agentId || "AGENT",
    risk_level: Math.max(0, Math.min(10, fallbackRisk)),
    condition: fallbackRisk >= 8 ? "CRITICAL" : fallbackRisk >= 5 ? "CAUTION" : "NORMAL",
    strategy: null,
    message: String(logText || ""),
    ts: Date.now()
  };

  try {
    const raw = JSON.parse(String(logText));
    const merged = { ...base, ...raw };
    return FieldReportSchema.parse({
      ...merged,
      risk_level: Number(merged.risk_level),
      condition: String(merged.condition || base.condition).toUpperCase()
    });
  } catch {
    return FieldReportSchema.parse(base);
  }
};

export default async function handler(req: Request) {
  return withApiMiddleware(req, {
    allowedMethods: ['POST'],
    requireAuth: false,
    rateLimitMaxRequests: 20
  }, async (req, _context) => {
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

    const { systemPrompt, persona, agentId, agentName, model: reqModel, state, externalData, image } = body;
    const agentIdentifier = agentId || agentName;

    const agentKeysHeader = req.headers.get('x-agent-keys');
    if (!agentKeysHeader) {
      return new Response(JSON.stringify({ error: "MISSING_AGENT_KEYS" }), { status: 401 });
    }

    let customGeminiKey = "";
    try {
      const keysMap = JSON.parse(agentKeysHeader);
      if (agentIdentifier) {
        const agentKeyObj = keysMap[agentIdentifier];
        if (agentKeyObj && (agentKeyObj as any).gemini) {
          customGeminiKey = (agentKeyObj as any).gemini;
        }
      }
    } catch {
      return new Response(JSON.stringify({ error: "INVALID_AGENT_KEYS" }), { status: 400 });
    }

    const apiKey = (customGeminiKey || process.env.GEMINI_API_KEY || "").trim();
    const model = (reqModel || process.env.GEMINI_MODEL || AI_PROVIDERS.GEMINI.DEFAULT_MODEL).trim();
    const apiEndpoint = (process.env.GEMINI_ENDPOINT || AI_PROVIDERS.GEMINI.API_URL).trim();

    if (!apiKey) {
      logger.debug(`[GEMINI_MOCK] No API Key found. Returning simulated response for ${agentName}`);
      const riskLevel = externalData?.risk_level ? Number(externalData.risk_level) : 5;
      const log = JSON.stringify({
        message: `Mocked Gemini Response for ${agentName || 'Unknown Agent'} (Risk: ${riskLevel})`,
        risk_level: riskLevel,
        condition: riskLevel >= 8 ? "CRITICAL" : riskLevel >= 5 ? "CAUTION" : "NORMAL",
        strategy: riskLevel >= 8 ? "ASSET_PROTECTION" : null
      });
      const mockResponse = { report: parseReport(agentId || "AGENT", agentName || agentId || "AGENT", externalData, log), log, mock: true };
      return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (state && JSON.stringify(state).length > 2000000) {
      return new Response(JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: "State payload exceeds 2MB limit." }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    const region = externalData?.location ? String(externalData.location) : "Seoul";

    let weather = externalData?.weather;
    let tempData = externalData?.temp ? String(externalData.temp) : "20";
    let humidityData = externalData?.humidity ? String(externalData.humidity) : "50";
    

    const isMock = process.env.VITE_USE_MOCK === 'true' || process.env.NODE_ENV !== 'production';
    if (!externalData?.weather && !isMock) {
      const WTTR_URL = process.env.WTTR_URL;
      if (WTTR_URL) {
        try {
          const weatherRes = await fetch(WTTR_URL.replace('{region}', encodeURIComponent(region)), {
            signal: AbortSignal.timeout(Number(process.env.WTTR_API_TIMEOUT) || 3000)
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
      } else {
        logger.warn('[GEMINI_CONFIG] WTTR_URL is not set. Weather data will default to fallback values.');
      }
    }

    const safeSystemPrompt = systemPrompt || 'DEFAULT_AGENT';
    const safePersona = persona || 'GENERAL_RECON_DRONE';

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

<agent_persona>
Role/Persona: ${safePersona}
System Prompt: ${safeSystemPrompt}
Please strictly act and respond according to this persona.
</agent_persona>

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
        temperature: 0.2, // Deterministic JSON output
        maxOutputTokens: 200, 
        responseMimeType: "application/json" 
      }
    };

    let safeApiEndpoint = apiEndpoint.replace(/\/+$/, '');
    if (safeApiEndpoint.endsWith('/models')) {
      safeApiEndpoint = safeApiEndpoint.replace(/\/models$/, '');
    }
    const safeModel = model.startsWith('models/') ? model.replace('models/', '') : model;
    
    let finalUrl = `${safeApiEndpoint}/models/${safeModel}:${AI_PROVIDERS.GEMINI.ACTION}`;
    if (apiEndpoint.includes(':generateContent')) {
      finalUrl = apiEndpoint;
    }

    const MAX_RETRIES = 3;
    let response: Response | null = null;
    let attempt = 0;
    
    while (attempt <= MAX_RETRIES) {
      try {
        response = await fetch(finalUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(payload),

          signal: AbortSignal.timeout(25000)
        });

        if (response.status === 429 && attempt < MAX_RETRIES) {
          const backoffDelay = Math.pow(2, attempt) * 1000 + Math.random() * 500; 
          logger.warn(`[GEMINI_API_429] Rate limited. Retrying ${attempt + 1}/${MAX_RETRIES} in ${Math.round(backoffDelay)}ms`);
          await new Promise(res => setTimeout(res, backoffDelay));
          attempt++;
          continue;
        } else if (response.status === 429) {

          logger.warn(`[GEMINI_API_429] Out of retries. Returning mocked fallback response to prevent UI spam.`);
          const riskLevel = externalData?.risk_level ? Number(externalData.risk_level) : 5;

          let fallbackMessage = "정상 비행 중. 특이사항 없습니다.";
          if (riskLevel >= 8) fallbackMessage = "경고: 전방에 짙은 연기와 고온이 감지되었습니다. 긴급 회피가 필요합니다.";
          else if (riskLevel >= 5) fallbackMessage = "주의: 기상 악화 조짐이 있습니다. 고도를 유지합니다.";
          
          const log = JSON.stringify({
            message: fallbackMessage,
            risk_level: riskLevel,
            condition: riskLevel >= 8 ? "CRITICAL" : riskLevel >= 5 ? "CAUTION" : "NORMAL",
            strategy: riskLevel >= 8 ? "ASSET_PROTECTION" : null
          });
          return new Response(JSON.stringify({ report: parseReport(agentId || "AGENT", agentName || agentId || "AGENT", externalData, log), log, mock: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        break;
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
        throw err;
      }
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 504;
      let rawError = "Unknown error";
      if (response) {
        try {
          const data = await response.json();
          rawError = JSON.stringify(data);
        } catch {
        }
      }

      logger.error(`[GEMINI_API_ERR] status: ${status}, raw: ${rawError}`);

      let errorKey = `HTTP_${status}`;
      if (status === 401) errorKey = "INVALID_API_KEY";
      if (status === 404) errorKey = "HTTP_404";
      if (status === 429) errorKey = "QUOTA_EXCEEDED";
      if (status === 500) errorKey = "INTERNAL_SERVER_ERROR";
      if (status === 504) errorKey = "GATEWAY_TIMEOUT";
      return new Response(JSON.stringify({ error: errorKey }), { status, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const logText = data.candidates?.[0]?.content?.parts?.[0]?.text || "상태 이상 없음";

    const report = parseReport(agentId || "AGENT", agentName || agentId || "AGENT", externalData, logText);
    return new Response(JSON.stringify({ report, log: String(logText || ""), mock: false }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}
