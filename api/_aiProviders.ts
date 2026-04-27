// NOTE: Centralized AI Provider Configuration

export const AI_PROVIDERS = {
  KANANA: {
    API_URL: process.env.KANANA_ENDPOINT || 'https://api.kakaobrain.com/v1/inference/kanana',
    DEFAULT_MODEL: process.env.KANANA_MODEL || 'kanana-o',
    TIMEOUT_MS: Number(process.env.KANANA_API_TIMEOUT) || 300000,
    MAX_PAYLOAD: Number(process.env.MAX_PAYLOAD_LENGTH) || 100000,
    VOICE_PRESET: process.env.KANANA_VOICE_PRESET || 'preset_spk_1',
  },
  OPENAI: {
    API_URL: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
    DEFAULT_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  ANTHROPIC: {
    API_URL: process.env.ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
    DEFAULT_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
  },
  GEMINI: {
    NAME: 'gemini',
    API_URL: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models',
    DEFAULT_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash', // NOTE: Updated default model to gemini-2.0-flash to prevent 404 on new accounts
    ACTION: 'generateContent',
  }
};
