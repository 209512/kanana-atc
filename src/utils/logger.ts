import { color } from './doNotUseColor';

const isProduction = import.meta.env?.PROD || process.env.NODE_ENV === 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProduction) {
      console.log(color('[LOG]'), ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (!isProduction) {
      console.warn(color('[WARN]'), ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (!isProduction) {
      console.error(color('[ERROR]'), ...args);
    } else {
      // NOTE: PRODUCTION: Replace with real error monitoring service (e.g. Sentry) in the future
      console.error(color('[App Error]'), ...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (!isProduction) {
      console.debug(color('[DEBUG]'), ...args);
    }
  },
};
