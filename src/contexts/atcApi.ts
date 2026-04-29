import { parseStreamChunk } from '@/utils/streamParser';
import { logger } from '../utils/logger';
import { request } from '@/utils/apiClient';
import { ATC_CONFIG } from '@/constants/atcConfig';
import type { FieldReport } from '@/contexts/atcTypes';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface AiPayload {
  text?: string;
  messages?: AIMessage[];
  signal?: AbortSignal;
}

export const atcApi = {
  askKanana: async (payload: AiPayload, onChunk?: (text: string, audioBase64: string | null) => void) => {
    const finalMessages = payload.messages 
      ? payload.messages 
      : [{ role: "user" as const, content: payload.text || "" }];

    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const envAudio = import.meta.env.VITE_USE_KANANA_AUDIO;
    const useAudio = envAudio === 'true' || envAudio === true || (isLocal && envAudio !== 'false' && envAudio !== false);
    
    const isStream = true;
    
    const extra_body = {
      latency_first: true, 
      audio: useAudio ? { voice: "preset_spk_1" } : undefined
    };

    const requestBody: Record<string, unknown> = { 
      model: import.meta.env.VITE_KANANA_MODEL || "kanana-o", 
      messages: finalMessages, 
      stream: isStream,
      async: true, 
      extra_body
    };

    if (useAudio) {
      requestBody.modalities = ["text", "audio"];
    }

    
    const hasImage = finalMessages.some(msg => 
      Array.isArray(msg.content) && msg.content.some(part => part.type === "image_url")
    );
    if (hasImage) {
      requestBody.modalities = [...(requestBody.modalities as string[] || ["text"]), "image"];
    }

    const response = await request('/kanana', {
        method: 'POST', 
        body: JSON.stringify(requestBody),
        signal: payload.signal
      });

      if (!response) {
        throw new Error("Empty response from /kanana API");
      }
      
      if (response.queued) {
        const msg = "[SYSTEM_OFFLINE] 네트워크 연결이 끊어졌습니다. 요청이 큐에 저장되어 연결 복구 시 자동 동기화됩니다.";
        if (onChunk) onChunk(msg, null);
        return { message: msg, audio: null };
      }
    
    let resultPayload: any = null;

    if (response && !(response instanceof Response) && response.job_id) {
      const jobId = response.job_id;
      const pollResult = async () => {
        const maxRetries = ATC_CONFIG.AI.POLL_MAX_RETRIES;
        const pollInterval = ATC_CONFIG.AI.POLL_INTERVAL_MS;
        for (let i = 0; i < maxRetries; i++) {
          const data = await request(`/kanana-poll?job_id=${encodeURIComponent(jobId)}`, { method: 'GET', signal: payload.signal });
          if (data?.status === 'completed') return data.result;
          if (data?.status === 'failed') throw new Error(data.error || 'ASYNC_JOB_FAILED');
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        throw new Error('ASYNC_JOB_TIMEOUT');
      };

      resultPayload = await pollResult();
    } else {
      if (response instanceof Response && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";

        try {
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              const decodedChunk = decoder.decode(value, { stream: true });
              buffer += decodedChunk;
              buffer = parseStreamChunk(buffer, onChunk || (() => {}));
            }
          }
        } catch (err) {
          logger.error("Stream read error:", err);
        } finally {
          reader.releaseLock();
        }
        return { message: "", audio: null };
      } else {
        resultPayload = {
          message: response.message || "",
          audio: response.audio || null
        };
      }
    }

    if (onChunk && resultPayload.message) {
      
      const message = resultPayload.message;
      const chunkSize = Math.max(1, Math.floor(message.length / 20)); 
      let currentIndex = 0;

      while (currentIndex < message.length) {
        const nextIndex = Math.min(currentIndex + chunkSize, message.length);
        const chunk = message.slice(currentIndex, nextIndex);
        onChunk(chunk, currentIndex === 0 ? resultPayload.audio : null); 
        currentIndex = nextIndex;
        await new Promise(resolve => setTimeout(resolve, 50)); 
      }
    } else if (onChunk && resultPayload.audio) {
      onChunk("", resultPayload.audio);
    }

    return resultPayload;
  },

  askGemini: async (payload: Record<string, unknown>): Promise<FieldReport> => {
    const response = await request('/gemini', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeout: 15000,
      retries: 0
    });

    if (!response) throw new Error("Empty response from /gemini API");
    if (response.error) throw new Error(String(response.error));
    if (response.report) return response.report as FieldReport;
    if (response.log && typeof response.log === 'string') {
      const agentId = String((payload as any).agentId || 'AGENT');
      const agentName = String((payload as any).agentName || agentId);
      const risk_level = Number((payload as any)?.externalData?.risk_level ?? 5);
      const condition = (risk_level >= 8 ? 'CRITICAL' : risk_level >= 5 ? 'CAUTION' : 'NORMAL') as FieldReport['condition'];
      return {
        agentId,
        agentName,
        risk_level,
        condition,
        strategy: null,
        message: response.log,
        ts: Date.now()
      };
    }
    throw new Error("Invalid response from /gemini API");
  },
  
  executeProposals: async (actions: Record<string, unknown>[]) => {
    return request('/actions/bulk', {
      method: 'POST',
      body: JSON.stringify({ actions })
    });
  },
  
  togglePause: async (uuid: string, pause: boolean) => request(`/agents/${uuid}/pause`, { method: 'POST', body: JSON.stringify({ pause }) }),
  togglePriority: async (uuid: string, enable: boolean) => request(`/agents/${uuid}/priority`, { method: 'POST', body: JSON.stringify({ enable }) }),
  transferLock: async (uuid: string) => request(`/agents/${uuid}/transfer-lock`, { method: 'POST' }),
  terminateAgent: async (uuid: string) => request(`/agents/${uuid}`, { method: 'DELETE' }),
  toggleGlobalStop: async (enable: boolean) => request('/stop', { method: 'POST', body: JSON.stringify({ enable }) }),
  updatePriorityOrder: async (order: string[]) => request('/agents/priority-order', { method: 'POST', body: JSON.stringify({ order }) }),
  triggerOverride: async () => request('/override', { method: 'POST' }),
  releaseLock: async () => request('/release', { method: 'POST' }),
  scaleAgents: async (count: number) => request('/agents/scale', { method: 'POST', body: JSON.stringify({ count }) }),
  renameAgent: async (uuid: string, newName: string) => { 
    return request(`/agents/${uuid}/rename`, {
      method: 'POST',
      body: JSON.stringify({ newName }) 
    });
  },
  updateConfig: async (uuid: string, config: Record<string, unknown>) => request(`/agents/${uuid}/config`, { method: 'POST', body: JSON.stringify({ config }) }),
};
