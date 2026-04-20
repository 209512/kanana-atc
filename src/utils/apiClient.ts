import { ATC_CONFIG } from '@/constants/atcConfig';
import { logger } from './logger';
import { queryClient } from '@/main';
import { useATCStore } from '@/store/useATCStore';
import { queryKeys } from '@/constants/queryKeys';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoff?: number;
}

export const getSafeBaseUrl = (url: string) => {
  if (url.startsWith('http')) return url.replace(/\/$/, '');
  return url.startsWith('/') ? url.replace(/\/$/, '') : '/' + url.replace(/\/$/, '');
};

export const initAuth = async (): Promise<string | null> => {
  return queryClient.fetchQuery({
    queryKey: queryKeys.auth(),
    queryFn: async () => {
      try {
        const baseUrlStr = import.meta.env.VITE_API_BASE_URL || BASE_URL;
        const safeBase = getSafeBaseUrl(baseUrlStr);
        const initUrl = `${safeBase}/init`;
        const res = await fetch(initUrl);
        
        if (res.ok) {
          try {
            const data = await res.json();
            return data.token || null;
          } catch {
            return null; // JSON 파싱 실패 시 토큰 없음으로 처리 (500 에러 던지지 않음)
          }
        }
        
        // 404 Not Found 거나 모킹이 안 된 환경 등일 때는 토큰 없이 진행하도록 허용 (무비용 배포 환경 호환)
        if (res.status === 404 || res.status === 500) {
          logger.warn(`[AUTH_INIT] Auth endpoint returned ${res.status}. Proceeding without token.`);
          return null;
        }
        
        throw new Error(`Init failed with status ${res.status}`);
      } catch (err) {
        logger.warn("[AUTH_INIT_WARN] Proceeding without token:", err);
        return null; // 네트워크 에러나 기타 에러 시에도 앱 크래시 대신 토큰 없이 진행
      }
    },
    staleTime: 1000 * 60 * 60 * 23,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 0 // 실패 시 재시도하지 않고 바로 null 반환
  });
};

export const request = async (url: string, options: RequestOptions = {}) => {
  const { 
    timeout = Number(import.meta.env.VITE_API_TIMEOUT) || ATC_CONFIG.SIMULATOR.API_TIMEOUT,
    retries = Number(import.meta.env.VITE_API_RETRIES) || ATC_CONFIG.SIMULATOR.API_RETRIES, 
    backoff = Number(import.meta.env.VITE_API_BACKOFF) || ATC_CONFIG.SIMULATOR.API_BACKOFF, 
    ...fetchOptions 
  } = options;

  const baseUrlStr = import.meta.env.VITE_API_BASE_URL || BASE_URL;
  const isExternal = url.startsWith('/proxy') || url.startsWith('http') || url.startsWith(baseUrlStr);
  const formattedUrl = url.startsWith('/') ? url : '/' + url;
  
  let finalUrl = url;
  if (!isExternal) {
    const safeBase = getSafeBaseUrl(baseUrlStr);
    finalUrl = safeBase + formattedUrl;
  }

  if (url.includes('/kanana')) {
    logger.log(`%c[AI_CALL] 🧠 ${finalUrl}`, 'color: #268bd2; font-weight: bold;');
  }

  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.error(`[TIMEOUT] ⏳ ${finalUrl} (Attempt ${i + 1})`);
      controller.abort();
    }, timeout);

    try {
      const token = await initAuth();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json', 
        'Accept': 'application/json', 
        ...fetchOptions.headers as Record<string, string>
      };
      
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
        const kananaKey = window.sessionStorage?.getItem?.('KANANA_API_KEY') || window.localStorage.getItem('KANANA_API_KEY');
        if (kananaKey) {
          headers['x-kanana-key'] = kananaKey;
        }
        
        const agentKeys = window.localStorage.getItem('AGENT_API_KEYS');
        if (agentKeys) {
          headers['x-agent-keys'] = agentKeys; // JSON string
        }
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(finalUrl, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
          if (response.status === 401) {
            queryClient.invalidateQueries({ queryKey: queryKeys.auth() });
          }
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = {};
          }
          
          const errorMsg = errorData.error || errorData.message || `HTTP_${response.status}`;
          if (errorMsg === "QUOTA_EXCEEDED" || response.status === 429) {
            useATCStore.getState().setAiQuota(0); // Zustand로 즉각 동기화
          }
          
          throw new Error(errorMsg);
        }

      clearTimeout(timeoutId);
      
      let isStream = false;
      try {
        isStream = fetchOptions.body && typeof fetchOptions.body === 'string' && JSON.parse(fetchOptions.body).stream;
      } catch {
        // Ignore parse error
      }
      if (isStream) return response;

      const data = await response.json();
      return data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const error = err as Error;
      lastError = error;
      if (i === retries) break;
      
      const isClientError = error.message.startsWith('HTTP_4') || error.message.includes('400') || error.message.includes('401') || error.message.includes('403') || error.message.includes('INVALID_INPUT') || error.message.includes('FORBIDDEN') || error.message.includes('CONFIG_ERROR');
      const isServerError = error.message.startsWith('HTTP_5') || error.message.includes('500') || error.message.includes('502') || error.message.includes('503') || error.message.includes('504');
      const isTimeout = error.name === 'AbortError' || error.message.includes('504') || error.message.toLowerCase().includes('timeout');

      // Do not retry if the error is a client error (e.g. 400 Bad Request, 403 Forbidden) and NOT a rate limit error (429)
      if (isClientError && !error.message.includes('429') && !error.message.includes('QUOTA_EXCEEDED')) break;
      
      // Do not retry endlessly for server errors (500) to prevent Thundering Herd. Limit to max 1 retry for server errors.
      if (isServerError && i >= 1) {
        break;
      } else if (isTimeout && i >= 1) {
        break;
      } else if (error.name === 'AbortError') {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }
  if (lastError) throw lastError;
  throw new Error("Unknown fetch error");
};
