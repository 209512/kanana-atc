import { parseStreamChunk } from '@/utils/streamParser';
import { logger } from '../utils/logger';
import { useATCStore } from '@/store/useATCStore';
import { request } from '@/utils/apiClient';

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

    // NOTE: Environment-aware Audio Fallback (PCM on local, Web API on Vercel)
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const envAudio = import.meta.env?.VITE_USE_KANANA_AUDIO;
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    
    // NOTE: Force TTS fallback on Vercel to prevent 50MB payload limits
    const useAudio = !isVercel && (envAudio === 'true' || envAudio === true || (isLocal && envAudio !== 'false' && envAudio !== false));
    
    // NOTE: Fake Keep-Alive on Vercel (10s Edge Timeout Bypass)
    const isStream = true;
    
    const extra_body = {
      latency_first: true, 
      audio: useAudio ? { voice: "preset_spk_1" } : undefined
    };

    const requestBody: Record<string, unknown> = { 
      model: import.meta.env?.VITE_KANANA_MODEL || "kanana-o", 
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
      
      // NOTE: Handle Offline Queue Response Gracefully
      if (response.queued) {
        const msg = "[SYSTEM_OFFLINE] 네트워크 연결이 끊어졌습니다. 요청이 큐에 저장되어 연결 복구 시 자동 동기화됩니다.";
        if (onChunk) onChunk(msg, null);
        return { message: msg, audio: null };
      }
    
    let resultPayload: any = null;

    // NOTE: Poll Async Queue (Redis) via Web Worker to prevent UI freezing/frame drops
    if (response && !(response instanceof Response) && response.job_id) {
      const jobId = response.job_id;
      
      resultPayload = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/pollWorker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (e) => {
          if (e.data.type === 'SUCCESS') {
            resolve(e.data.payload);
          } else if (e.data.type === 'ERROR') {
            reject(new Error(e.data.error || 'ASYNC_JOB_FAILED'));
          }
          worker.terminate();
        };

        worker.onerror = (e) => {
          reject(new Error('PollWorker failed: ' + e.message));
          worker.terminate();
        };

        const baseUrl = import.meta.env?.VITE_API_BASE_URL || '/api';
        let apiKey = import.meta.env?.VITE_KANANA_API_KEY || "";
        if (!apiKey && typeof window !== 'undefined' && window.sessionStorage) {
            apiKey = window.sessionStorage.getItem('KANANA_API_KEY') || "";
        }
        
        worker.postMessage({ jobId, baseUrl, apiKey });
      });

      if (!resultPayload) {
        throw new Error("ASYNC_JOB_TIMEOUT");
      }
    } else {
      // NOTE: Fallback for synchronous or direct stream mode
      if (response instanceof Response && response.body) {
        // NOTE: Stream reading
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