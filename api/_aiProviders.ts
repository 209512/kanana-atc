// Centralized AI Provider Configuration

export const AI_PROVIDERS = {
  KANANA: {
    API_URL: 'https://api.kakaobrain.com/v1/inference/kanana',
    DEFAULT_MODEL: 'kanana-o',
  },
  OPENAI: {
    API_URL: 'https://api.openai.com/v1/chat/completions',
    DEFAULT_MODEL: 'gpt-4o-mini',
  },
  ANTHROPIC: {
    API_URL: 'https://api.anthropic.com/v1/messages',
    DEFAULT_MODEL: 'claude-3-5-sonnet-20240620',
  },
  GEMINI: {
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
    DEFAULT_MODEL: 'gemini-1.5-flash',
    ACTION: 'generateContent',
  },
};
