// src/contexts/atcApi.ts
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
}

// 순수 API 요청 객체 (상태를 내부에 가지지 않음)
export const atcApi = {
  askKanana: async (payload: AiPayload, onChunk?: (text: string, audioBase64: string | null) => void) => {
    const currentQuota = useATCStore.getState().aiQuota;
    // 쿼터 체크 시 로컬 상태(20)를 믿지 않고, 만약 0이라면 바로 차단
    if (currentQuota <= 0) throw new Error("QUOTA_EXCEEDED");

    const finalMessages = payload.messages 
      ? payload.messages 
      : [{ role: "user" as const, content: payload.text || "" }];

    // Vercel 무료 배포 환경을 고려하여 기본적으로 TTS(Web Speech API)로 폴백하도록 수정합니다.
    // 만약 VITE_USE_KANANA_AUDIO가 명시적으로 'true'일 때만 오디오 파이프라인을 탑승시킵니다.
    const useAudio = import.meta.env.VITE_USE_KANANA_AUDIO === 'true';
    const isStream = true; // 진정한 비동기 큐 사용을 위해 스트리밍 비활성화 지시(단, 서버에 Redis가 없으면 다시 스트리밍됨)
    
    const extra_body = {
      latency_first: true,
      audio: useAudio ? { voice: "preset_spk_1" } : undefined
    };

    const requestBody: Record<string, unknown> = { 
      model: "kanana-o", 
      messages: finalMessages, 
      stream: isStream,
      async: true, // Vercel 10초 룰 회피를 위한 비동기 큐 지시 플래그
      extra_body
    };

    if (useAudio) {
      requestBody.modalities = ["text", "audio"];
    }

    // 이미지가 메시지 배열에 포함되어 있다면 modalities에 "image" 추가
    const hasImage = finalMessages.some(msg => 
      Array.isArray(msg.content) && msg.content.some(part => part.type === "image_url")
    );
    if (hasImage) {
      requestBody.modalities = [...(requestBody.modalities as string[] || ["text"]), "image"];
    }

    const response = await request('/kanana', {
        method: 'POST', 
        body: JSON.stringify(requestBody)
      });

      if (!response) {
        throw new Error("Empty response from /kanana API");
      }

    // Zustand 스토어의 쿼터를 1회 차감합니다.
    useATCStore.getState().setAiQuota(currentQuota - 1);
    
    let resultPayload: any = null;

    // request()는 stream: false이거나 202 응답(Async Queue)일 경우 JSON 파싱된 객체를 반환합니다.
    // response가 Response 객체(스트림)가 아니고, job_id 속성을 가진 일반 객체인지 확인합니다.
    if (response && !(response instanceof Response) && response.job_id) {
      // Async Queue 모드 처리 (job_id 폴링)
      const jobId = response.job_id;

      // 폴링 로직 (최대 120초 대기)
      const maxRetries = 60;
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        try {
          const pollData = await request(`/kanana-poll?job_id=${jobId}`, { method: 'GET' });
          
          if (pollData.status === "completed") {
            resultPayload = pollData.result;
            break;
          } else if (pollData.status === "failed") {
            throw new Error(pollData.error || "ASYNC_JOB_FAILED");
          }
        } catch (e: any) {
          // 404나 기타 오류일 수 있으므로 무시하고 계속 폴링
          logger.warn(`[POLL_WARN] ${e.message}`);
        }
      }

      if (!resultPayload) {
        throw new Error("ASYNC_JOB_TIMEOUT");
      }
    } else {
      // 동기 모드 처리 (폴백 - Redis가 없어 Async 모드가 무시된 경우)
      if (response instanceof Response && response.body) {
        // 스트리밍 모드 폴백
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
      // 전체 메시지를 타이핑 효과처럼 잘라서 onChunk 호출 (스트리밍 시뮬레이션)
      const message = resultPayload.message;
      const chunkSize = Math.max(1, Math.floor(message.length / 20)); // 약 20번의 청크로 분할
      let currentIndex = 0;

      while (currentIndex < message.length) {
        const nextIndex = Math.min(currentIndex + chunkSize, message.length);
        const chunk = message.slice(currentIndex, nextIndex);
        onChunk(chunk, currentIndex === 0 ? resultPayload.audio : null); // 첫 청크에만 오디오 첨부
        currentIndex = nextIndex;
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms 대기
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