import { logger } from './logger';

type ErrorContext = Record<string, unknown>;

class ErrorTracker {
  private static instance: ErrorTracker;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureException(event.error || new Error(event.message), { source: 'window.error' });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.captureException(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), { source: 'unhandledrejection' });
      });
    }

    logger.log('[ErrorTracker] Initialized centralized error monitoring.');
  }

  captureException(error: Error, context?: ErrorContext) {
    logger.error('[Captured Error]', error, context);
    
    this.reportToBackend(error, context);
  }

  captureMessage(message: string, context?: ErrorContext) {
    logger.warn('[Captured Message]', message, context);
    
    this.reportToBackend(new Error(message), context);
  }

  private async reportToBackend(error: Error, context?: ErrorContext) {
    const logEndpoint = import.meta.env.VITE_ERROR_LOG_ENDPOINT;
    if (!logEndpoint) return;

    try {
      await fetch(logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
          context,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Failed to report error to backend', e);
    }
  }
}

export const errorTracker = ErrorTracker.getInstance();
