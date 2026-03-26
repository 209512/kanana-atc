// src/contexts/atcApi.ts
import { audioService } from '@/utils/audioService';

const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoff?: number;
}

let _isAiMode = false;
export const setApiMode = (isAi: boolean) => { _isAiMode = isAi; };

let _aiQuota = 20;
export const getRemainingQuota = () => _aiQuota;

const request = async (url: string, options: RequestOptions = {}) => {
  const { 
    timeout = 15000,
    retries = 0, 
    backoff = 300, 
    ...fetchOptions 
  } = options;

  const finalUrl = url.startsWith('/proxy') 
    ? url 
    : `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`; 
  
  console.log(`[ATC_API] Target: ${finalUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    let lastError: Error | null = null;

    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(finalUrl, {
          ...fetchOptions,
          headers: { 
            'Content-Type': 'application/json', 
            'Accept': 'application/json', 
            ...fetchOptions.headers 
          },
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errorMsg = data.error || data.message || `HTTP_${response.status}`;
          throw new Error(errorMsg);
        }

        return data;
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError' || i === retries) break;
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const atcApi = {
  askKananaSmart: async (
    payload: { text: string },
    addLog: (msg: string, type: any, agentId?: string) => void
  ) => {
    if (_aiQuota <= 0) {
      addLog("⚠️ AI_ERR: DAILY_QUOTA_EXCEEDED", "warn", "SYSTEM");
      throw new Error("QUOTA_EXCEEDED");
    }

    try {
      const result = await atcApi.askKanana(payload);

      _aiQuota -= 1;
      addLog(`📡 AI_SYNC: SUCCESS [${_aiQuota}/20]`, "success", "SYSTEM");

      if (result.message) {
        addLog(`🧠 AI_INSIGHT: ${result.message}`, "insight", "KANANA-O");
        const actionMatch = result.message.match(/\[ACTION:(PAUSE|PRIORITY|STOP):(.+?)\]/);
        if (actionMatch) {
          const [_, action, targetId] = actionMatch;
          const uuid = targetId.trim(); 
          if (action === 'PAUSE') await atcApi.togglePause(uuid, true);
          if (action === 'PRIORITY') await atcApi.togglePriority(uuid, true);
          if (action === 'STOP') await atcApi.toggleGlobalStop(true);
          addLog(`🤖 AI_EXEC: EXECUTED ${action}`, "critical", uuid);
        }
      }

      if (result.audio) {
        audioService.playPCM(result.audio, 24000);
      }

      return result;
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.includes("QUOTA_EXCEEDED") || errMsg.includes("429")) {
        addLog("🚫 AI_LIMIT: QUOTA_EXCEEDED (1일 20회)", "warn", "NETWORK");
      } else if (errMsg.includes("GPU_SERVER_OVERLOAD") || errMsg.includes("500")) {
        addLog("🔥 AI_BUSY: KAKAO_SERVER_OVERLOAD", "critical", "NETWORK");
      } else if (errMsg.includes("GATEWAY_TIMEOUT") || errMsg.includes("504")) {
        addLog("⏳ AI_TIMEOUT: RESPONSE_DELAYED", "warn", "NETWORK");
      } else {
        addLog(`❌ AI_ERR: ${errMsg.substring(0, 20)}`, "critical", "NETWORK");
      }
      console.error("AI_MODE_ERROR:", err);
      throw err;
    }
  },

  askKanana: async (payload: { text: string }) => {
    return request('/kanana', {
      method: 'POST', 
      body: JSON.stringify({
        messages: [{ role: "user", content: payload.text }]
      })
    });
  },
  
  toggleGlobalStop: (enable: boolean) => request('/stop', { method: 'POST', body: JSON.stringify({ enable }) }),
  togglePause: (uuid: string, pause: boolean) => request(`/agents/${encodeURIComponent(uuid)}/pause`, { method: 'POST', body: JSON.stringify({ pause }) }),
  togglePriority: (uuid: string, enable: boolean) => request(`/agents/${encodeURIComponent(uuid)}/priority`, { method: 'POST', body: JSON.stringify({ enable }) }),
  updatePriorityOrder: (order: string[]) => request('/agents/priority-order', { method: 'POST', body: JSON.stringify({ order }) }),
  transferLock: (uuid: string) => request(`/agents/${encodeURIComponent(uuid)}/transfer-lock`, { method: 'POST' }),
  triggerOverride: () => request('/override', { method: 'POST' }),
  releaseLock: () => request('/release', { method: 'POST' }),
  terminateAgent: (uuid: string) => request(`/agents/${encodeURIComponent(uuid)}`, { method: 'DELETE' }),
  scaleAgents: (count: number) => request('/agents/scale', { method: 'POST', body: JSON.stringify({ count }) }),
  renameAgent: (uuid: string, newName: string) => request(`/agents/${encodeURIComponent(uuid)}/rename`, { method: 'POST', body: JSON.stringify({ newName }) }),
  updateConfig: (uuid: string, config: any) => request(`/agents/${encodeURIComponent(uuid)}/config`, { method: 'POST', body: JSON.stringify({ config }) }),
};