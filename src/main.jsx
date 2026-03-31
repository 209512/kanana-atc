// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App'
import { ATCProvider } from '@/contexts/ATCProvider'
import { UIProvider } from '@/contexts/UIProvider'

async function enableMocking() {
  const isLocal = import.meta.env.MODE === 'development';
  const isVercel = window.location.hostname.includes('vercel.app');
  const forceMock = import.meta.env.VITE_USE_MSW === 'true';

  if (isLocal || isVercel || forceMock) {
    const { worker } = await import('./mocks/browser');
    return worker.start({
      onUnhandledRequest(req, print) {
        const url = req.url.toString();
        if (url.includes('/api/kanana') || url.includes('/proxy/kanana')) {
          return;
        }
        print.warning();
      },
      serviceWorker: {
        url: '/mockServiceWorker.js',
        updateViaCache: 'none'
      }
    });
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <UIProvider>
        <ATCProvider>
          <App />
        </ATCProvider>
      </UIProvider>
    </StrictMode>
  );
});