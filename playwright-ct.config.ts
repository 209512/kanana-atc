import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  testDir: './src/components',
  testMatch: '**/*.spec.tsx',
  snapshotDir: './__snapshots__',
  timeout: 10 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    ctPort: 3100,
    ctViteConfig: {
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
        },
      },
      define: {
        'import.meta.env.VITE_LOAD_THRESHOLD': JSON.stringify('70'),
        'import.meta.env.VITE_LATENCY_THRESHOLD': JSON.stringify('100'),
        'import.meta.env.VITE_COOL_DOWN_MS': JSON.stringify('2500'),
        'import.meta.env.VITE_EMERGENCY_LEVEL': JSON.stringify('85'),
        'import.meta.env.VITE_STREAM_INTERVAL': JSON.stringify('100'),
        'import.meta.env.VITE_LOCK_DURATION': JSON.stringify('5000'),
        'import.meta.env.VITE_AI_QUOTA': JSON.stringify('20'),
        'import.meta.env.VITE_LEVEL_NORMAL': JSON.stringify('30'),
        'import.meta.env.VITE_LEVEL_CAUTION': JSON.stringify('70'),
        'import.meta.env.VITE_LEVEL_EMERGENCY': JSON.stringify('95'),
        'import.meta.env.VITE_USE_KANANA_AUDIO': JSON.stringify('false'),
      },
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
