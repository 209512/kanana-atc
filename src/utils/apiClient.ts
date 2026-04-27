import { ATC_CONFIG } from '@/constants/atcConfig';
import { logger } from './logger';
import { queryClient } from '@/main';
import { useATCStore } from '@/store/useATCStore';
import { queryKeys } from '@/constants/queryKeys';
import { encryptDataAsync, injectSecureHeaders } from '@/utils/secureStorage';
import { idbService } from './idbService';

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api';

// NOTE: Background Sync Manager
export const processOfflineQueue = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  
  // NOTE: Prevent crash when IndexedDB access is blocked
  // NOTE: Prevent crash on restricted IndexedDB access
  let requests = [];
  try {
    requests = await idbService.getOfflineRequests();
  } catch (e) {
    logger.warn("[OfflineSync] IndexedDB access denied or failed", e);
    return;
  }
  
  if (!requests || requests.length === 0) return;
  
  logger.log(`[OfflineSync] Found ${requests.length} queued requests. Syncing...`);
  for (const req of requests) {
    try {
      // NOTE: Ensure we do not re-queue on sync
      await request(req.url, { method: req.method, headers: req.headers, body: req.body, _isSync: true } as any);
      await idbService.removeOfflineRequest(req.id);
      logger.log(`[OfflineSync] Synced request ${req.id}`);
    } catch (e) {
      logger.error(`[OfflineSync] Failed to sync request ${req.id}`, e);
      // NOTE: Catch logical client errors to prevent infinite sync retry
      if (e instanceof Error) {
         const msg = e.message.toUpperCase();
         const isClientError = msg.startsWith('HTTP_4') || msg.includes('BAD_REQUEST') || msg.includes('UNAUTHORIZED') || msg.includes('INVALID_INPUT') || msg.includes('FORBIDDEN') || msg.includes('CONFIG_ERROR') || msg.includes('INVALID_API_KEY');
         if (isClientError && !msg.includes('429') && !msg.includes('QUOTA_EXCEEDED')) {
             await idbService.removeOfflineRequest(req.id);
         }
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', processOfflineQueue);
  // NOTE: Attempt sync on load
  setTimeout(processOfflineQueue, 2000);
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoff?: number;
  _isSync?: boolean;
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
        const baseUrlStr = import.meta.env?.VITE_API_BASE_URL || BASE_URL;
        const safeBase = getSafeBaseUrl(baseUrlStr);
        const initUrl = `${safeBase}/init`;
        const res = await fetch(initUrl);
        
        if (res.ok) {
          try {
            const data = await res.json();
            return data.token || null;
          } catch {
            return null; 
          }
        }
        
        
        if (res.status === 404) {
          logger.warn(`[AUTH_INIT] Auth endpoint returned 404. Proceeding without token.`);
          return null;
        }
        
        throw new Error(`Init failed with status ${res.status}`);
      } catch (err) {
        logger.warn("[AUTH_INIT_WARN] Proceeding without token:", err);
        return null; 
      }
    },
    staleTime: 1000 * 60 * 60 * 23,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 0 
  });
};

export const request = async (url: string, options: RequestOptions = {}) => {
  const { 
    timeout = Number(import.meta.env?.VITE_API_TIMEOUT) || ATC_CONFIG.SIMULATOR.API_TIMEOUT,
    retries = Number(import.meta.env?.VITE_API_RETRIES) || ATC_CONFIG.SIMULATOR.API_RETRIES, 
    backoff = Number(import.meta.env?.VITE_API_BACKOFF) || ATC_CONFIG.SIMULATOR.API_BACKOFF, 
    ...fetchOptions 
  } = options;

  const baseUrlStr = import.meta.env?.VITE_API_BASE_URL || BASE_URL;
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
    // NOTE: Intercept offline requests before trying fetch to save battery & time
    if (typeof window !== 'undefined' && !navigator.onLine && !fetchOptions._isSync) {
       // NOTE: Allow GET requests to just fail, but queue POST/PUT/DELETE for mutations
       if (fetchOptions.method && fetchOptions.method !== 'GET') {
         await idbService.addOfflineRequest({
           url: finalUrl,
           method: fetchOptions.method,
           headers: fetchOptions.headers,
           body: fetchOptions.body
         });
         logger.log(`[OfflineSync] Queued ${fetchOptions.method} ${finalUrl}`);
         // NOTE: Return dummy success so the UI can proceed optimistically
         return { success: true, queued: true };
       }
       throw new Error('NETWORK_OFFLINE');
    }

    const controller = new AbortController();
    
    // NOTE: Link external AbortSignal if provided
    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => controller.abort());
      if (fetchOptions.signal.aborted) controller.abort();
    }

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
        // NOTE: Inject secure headers without exposing raw keys to XSS
        await injectSecureHeaders(headers);
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
          
          // NOTE: Prevent [object Object] by stringifying nested objects
          let errorMsg = errorData.error || errorData.message;
          if (typeof errorMsg === 'object') {
             errorMsg = JSON.stringify(errorMsg);
          }
          errorMsg = errorMsg || `HTTP_${response.status}`;
          
          throw new Error(errorMsg);
        }

      clearTimeout(timeoutId);
      
      let isStream = false;
      if (fetchOptions.body && typeof fetchOptions.body === 'string') {
        try {
          const parsed = JSON.parse(fetchOptions.body);
          isStream = !!parsed.stream;
        } catch {
          // NOTE: Fallback if not JSON
        }
      }
      if (isStream) return response;

      const data = await response.json();
      return data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const error = err as Error;
      lastError = error;
      if (i === retries) break;
      
      const isClientError = error.message.startsWith('HTTP_4') || error.message.includes('BAD_REQUEST') || error.message.includes('UNAUTHORIZED') || error.message.includes('INVALID_INPUT') || error.message.includes('FORBIDDEN') || error.message.includes('CONFIG_ERROR') || error.message.includes('QUOTA_EXCEEDED');
      const isServerError = error.message.startsWith('HTTP_5') || error.message.includes('SERVICE_TEMPORARILY_UNAVAILABLE');
      const isTimeout = error.name === 'AbortError' || error.message.includes('HTTP_504') || error.message.toLowerCase().includes('timeout');

      // NOTE: Do not retry on non-rate-limit client errors
      if (isClientError && !error.message.includes('HTTP_429') && !error.message.includes('QUOTA_EXCEEDED')) break;
      
      // NOTE: Retry logic:
      // NOTE: Server Error (500): Retry up to max retries
      // NOTE: Timeout (AbortError / 504): Retry up to max retries
      if (isServerError && i >= retries) {
        break;
      } else if (isTimeout && i >= retries) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }
  if (lastError) throw lastError;
  throw new Error("Unknown fetch error");
};
