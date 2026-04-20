// src/utils/logger.ts
const isProduction = import.meta.env?.PROD || process.env.NODE_ENV === 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    // TODO: Integrate Sentry or keep generic error for production
    if (!isProduction) {
      console.error(...args);
    } else {
      // LOG: Generic error in production
      console.error("[App Error] An error occurred.");
    }
  },
  debug: (...args: unknown[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
};
