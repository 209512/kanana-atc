// process.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    KANANA_API_KEY: string;
    KANANA_ENDPOINT: string;
    NODE_ENV: 'development' | 'production';
  }
}