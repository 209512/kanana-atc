import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import './index.css'
import './i18n'
import { logger } from './utils/logger'
import { errorTracker } from './utils/errorTracker'
import { ATCInitializer } from '@/components/layout/ATCInitializer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  const { worker } = await import('./mocks/browser');
  const { http, HttpResponse } = await import('msw');
  
  
  if (typeof window !== 'undefined') {
    (window as unknown as { msw: unknown }).msw = { worker, http, HttpResponse };
  }

  return worker.start({
    onUnhandledRequest(req, print) {
      const url = req.url.toString();
      
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
        url.includes('src/') ||
        url.includes('/assets/') ||
        url.includes('.svg') ||
        url.includes('.js') ||
        url.includes('.css')
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

function renderApp(root: HTMLElement) {
  
  let appRoot = (window as any).__REACT_ROOT__;
  if (!appRoot) {
    appRoot = createRoot(root);
    (window as any).__REACT_ROOT__ = appRoot;
  }

  appRoot.render(
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
