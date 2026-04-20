// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import './index.css'
import './i18n'
import { logger } from './utils/logger'
import { errorTracker } from './utils/errorTracker'
import { ATCInitializer } from '@/components/layout/ATCInitializer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Initialize centralized error tracker
errorTracker.init();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

async function enableMocking() {
  const isLocal = import.meta.env.MODE === 'development';
  const isVercel = window.location.hostname.includes('vercel.app');
  const forceMock = import.meta.env.VITE_USE_MSW === 'true';

  // import.meta.env.DEV를 통해 빌드 시 모킹 관련 코드가 트리쉐이킹되도록 보장합니다.
  if (import.meta.env.DEV && (isLocal || isVercel || forceMock)) {
    const { worker } = await import('./mocks/browser');
    const { http, HttpResponse } = await import('msw');
    
    // E2E 테스트(Playwright 등) 환경을 위해 전역 객체에 worker 노출
    if (typeof window !== 'undefined') {
      (window as unknown as { msw: unknown }).msw = { worker, http, HttpResponse };
    }

    return worker.start({
      onUnhandledRequest(req, print) {
        const url = req.url.toString();
        // MSW가 처리할 필요 없는 정적 리소스 요청들은 경고를 띄우지 않습니다.
        if (
          url.includes('/api/kanana') || 
          url.includes('/proxy/kanana') ||
          url.includes('node_modules') ||
          url.includes('@react-refresh') ||
          url.includes('fonts.googleapis.com') ||
          url.includes('fonts.gstatic.com') ||
          url.includes('cdn.jsdelivr.net') ||
          url.includes('chrome-extension') ||
          url.includes('.vite') ||
          url.includes('src/')
        ) {
          return;
        }
        print.warning();
      },
      serviceWorker: {
        url: '/mockServiceWorker.js'
      }
    });
  }
}

function renderApp(root: HTMLElement) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ATCInitializer>
          <App />
        </ATCInitializer>
      </QueryClientProvider>
    </StrictMode>
  );
}

const root = typeof document !== 'undefined' ? document.getElementById('root') : null;

if (root) {
  enableMocking()
    .then(() => renderApp(root))
    .catch((error) => {
      logger.error('Failed to enable mocking:', error);
      renderApp(root);
    });
}
