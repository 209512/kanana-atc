// src/contexts/atcApi.ts
import { audioService } from '@/utils/audioService';
import { ATC_CONFIG } from '@/constants/atcConfig';

const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoff?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiPayload {
  text?: string;
  messages?: AIMessage[];
}

let _isAiMode = false;
export const setApiMode = (isAi: boolean) => { _isAiMode = isAi; };

type QuotaListener = (quota: number) => void;
let _aiQuota: number = ATC_CONFIG.AI.DEFAULT_QUOTA;
let _listeners: ((quota: number) => void)[] = [];

export const getRemainingQuota = () => _aiQuota;
export const setAiQuota = (val: number) => { _aiQuota = val; };

const request = async (url: string, options: RequestOptions = {}) => {
  const { 
    timeout = 60000,
    retries = 0, 
    backoff = 300, 
    ...fetchOptions 
  } = options;

  const finalUrl = (url.startsWith('/proxy') || url.startsWith(BASE_URL))
    ? url 
    : `/api/${url.startsWith('/') ? url.slice(1) : url}`;

  if (url.includes('/kanana')) {
    console.log(`%c[AI_CALL] 🧠 ${finalUrl}`, 'color: #268bd2; font-weight: bold;');
  } else {
    // console.log(`[ATC_API] Target: ${finalUrl}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[TIMEOUT] ⏳ ${finalUrl}`)
    controller.abort();
  }, timeout);

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

        const data = await response.json();
        // const data = await response.json().catch(() => ({}));;
        console.log("DEBUG: 카나나 응답 원본 ->", data);

        if (!response.ok) {
          throw new Error(data.error || data.message || `HTTP_${response.status}`);
        }

        clearTimeout(timeoutId);
        return data;
      } catch (err: any) {
        console.error("DEBUG: 통신 실패 원인 ->", err);
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
  subscribeQuota: (listener: (quota: number) => void) => {
    _listeners.push(listener);
    listener(_aiQuota);
    return () => { _listeners = _listeners.filter(l => l !== listener); };
  },
  askKanana: async (payload: AiPayload) => {
    if (_aiQuota <= 0) throw new Error("QUOTA_EXCEEDED");

    const finalMessages = payload.messages 
      ? payload.messages 
      : [{ role: "user" as const, content: payload.text || "" }];

    const result = await request('/kanana', {
      method: 'POST', 
      body: JSON.stringify({ messages: finalMessages })
    });

    _aiQuota -= 1;
    _listeners.forEach(l => l(_aiQuota));
    
    return result;
  },
  
  setAiQuota: (val: number) => {
    _aiQuota = val;
    _listeners.forEach(l => l(_aiQuota));
  },

  executeProposals: async (proposals: any[]) => {
    return request('/actions/bulk', {
      method: 'POST',
      body: JSON.stringify({ actions: proposals })
    });
  },
  
  togglePause: (uuid: string, pause: boolean) => request(`/agents/${uuid}/pause`, { method: 'POST', body: JSON.stringify({ pause }) }),
  togglePriority: (uuid: string, enable: boolean) => request(`/agents/${uuid}/priority`, { method: 'POST', body: JSON.stringify({ enable }) }),
  transferLock: (uuid: string) => request(`/agents/${uuid}/transfer-lock`, { method: 'POST' }),
  terminateAgent: (uuid: string) => request(`/agents/${uuid}`, { method: 'DELETE' }),
  toggleGlobalStop: (enable: boolean) => request('/stop', { method: 'POST', body: JSON.stringify({ enable }) }),
  updatePriorityOrder: (order: string[]) => request('/agents/priority-order', { method: 'POST', body: JSON.stringify({ order }) }),
  triggerOverride: () => request('/override', { method: 'POST' }),
  releaseLock: () => request('/release', { method: 'POST' }),
  scaleAgents: (count: number) => request('/agents/scale', { method: 'POST', body: JSON.stringify({ count }) }),
  renameAgent: async (uuid: string, newName: string) => { 
    return await request(`/agents/${uuid}/rename`, {
      method: 'POST',
      body: JSON.stringify({ newName }) 
    });
  },
  updateConfig: (uuid: string, config: any) => request(`/agents/${uuid}/config`, { method: 'POST', body: JSON.stringify({ config }) }),
};