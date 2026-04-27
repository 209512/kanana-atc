const getEnvOrLocal = (key: string, fallback: number) => {
  if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
    const local = window.localStorage.getItem(key);
    if (local !== null && !isNaN(Number(local))) return Number(local);
  }
  return Number((import.meta.env as Record<string, string>)?.[key]) || fallback;
};

export const ATC_CONFIG = {
  
  RISK: {
    LOAD_THRESHOLD: getEnvOrLocal('VITE_LOAD_THRESHOLD', 70),
    LATENCY_THRESHOLD: getEnvOrLocal('VITE_LATENCY_THRESHOLD', 100),
    MAX_SCORE: 100,
    PENALTY_COLLISION: 25,
    PENALTY_DENSITY: 5,
    HISTORY_LIMIT: 10,
    COOL_DOWN_MS: getEnvOrLocal('VITE_COOL_DOWN_MS', 2500),
    TREND_WINDOW: 3,
    TREND_MAX_AGE: 7000,
    EMERGENCY_LEVEL: getEnvOrLocal('VITE_EMERGENCY_LEVEL', 85),
  },

  
  SIMULATOR: {
    STREAM_INTERVAL: getEnvOrLocal('VITE_STREAM_INTERVAL', 100),
    BASE_URL: '/api',
    LOCK_DURATION: getEnvOrLocal('VITE_LOCK_DURATION', 5000),
    TRANSFER_DELAY: 800,
    API_TIMEOUT: 60000,
    API_RETRIES: 0,
    API_BACKOFF: 300,
    COLORS: {
      DEFAULT: '#3b82f6',
      OVERRIDE: '#ef4444',
      LOCKED: '#10b981',
      PRIORITY: '#f59e0b',
      PAUSED: '#94a3b8',
    } as const,
  },
  
  AI: {
    DEFAULT_QUOTA: Number(import.meta.env?.VITE_AI_QUOTA) || 20,
    THINKING_AGENT: 'AGENT-THINKING',
    NETWORK_AGENT: "NETWORK",
    SYSTEM_AGENT: 'AGENT-SYSTEM',
    POLL_MAX_RETRIES: 60,
    POLL_INTERVAL_MS: 2000,
    ANALYSIS_COOLDOWN_MS: 10000,
  },

  
  LOGS: {
    MAX_DISPLAY: 1000,
  },
  LOG_MSG: {
    // NOTE: [TERMINATE/SCALE]
    TERMINATING: (name: string) => `❌ NODE_OFFLINE: TERMINATED_[${name}]`,
    TRAFFIC_SCALED: (count: number) => `🚀 TRAFFIC_ADJUSTED: ${count}_NODES_ACTIVE`,

    // NOTE: [STATE]
    SUSPENDED: "⏸️ NODE_STATE: SUSPENDED",
    RESUMED: "▶️ NODE_STATE: ACTIVE",
    LOCK_RELEASED_PAUSED: "🔓 ACCESS_RELEASED: NODE_PAUSED",
    LOCK_RELEASED: "🔓 ACCESS_RELEASED: IDLE",

    // NOTE: [LOCK/ACCESS]
    LOCK_GRANTED: (fence: number) => `🔒 ACCESS_ACQUIRED: TOKEN_#${fence}`,
    TRANSFER_SUCCESS: `✨ LOCK_HANDOVER: PROTOCOL_COMPLETE`,
    FORCE_TRANSFER: "⚡ LOCK_OVERRIDE: MANUAL_TRANSFER",

    // NOTE: [PRIORITY]
    PRIORITY_GRANTED: "⭐ PRIORITY_LEVEL: ELEVATED",
    PRIORITY_REVOKED: "⭐ PRIORITY_LEVEL: NORMALIZED",
    PRIORITY_UPDATED: (seq: string) => `📑 POLICY_REVISED: QUEUE_[${seq}]`,
    PRIORITY_CONTENTION: `🚨 CONTENTION_ALERT: PRIORITY_CONFLICT`,

    // NOTE: [CONTENTION]
    WAIT_FOR: (name: string) => `⚔️ RESOURCE_BUSY: QUEUED_BEHIND_[${name}]`,
    BLOCKED_BY: (name: string) => `🚫 ACCESS_DENIED: HELD_BY_[${name}]`,

    // NOTE: [SYSTEM/AI]
    GLOBAL_STOP: "🚨 SYSTEM_HALT: EMERGENCY_STOP_ACTIVE",
    GLOBAL_START: "✅ SYSTEM_READY: OPERATIONS_RESUMED",
    EMERGENCY_OVERRIDE: "🚨 SIGNAL_OVERRIDE: MANUAL_CONTROL_ACTIVE",
    OVERRIDE_RELEASED: "✅ SIGNAL_RESTORED: SYSTEM_NOMINAL",
    CONFIG_UPDATED: "⚙️ CONFIG_SYNC: PARAMETERS_UPDATED",
    CALLSIGN_REV: (name: string) => `📝 CALLSIGN_UPDATED: ${name}`,

    // NOTE: [AI_PROVIDER]
    AI_MODE_ON: "🌐 AI_LINK: ESTABLISHED (AUTOPILOT_ON)",
    AI_MODE_OFF: "🔌 AI_LINK: DISCONNECTED (MANUAL_ONLY)",
    PROPOSAL_EXEC: (count: number) => `⚙️ AI_EXECUTION: DEPLOYING_${count}_ACTIONS`,
    PROPOSAL_REJECT: "❌ AI_PROPOSAL: OPERATOR_REJECTED",
    HANDOVER: (reason: string) => `📋 HANDOVER_REQUIRED: [${reason}]`,
    RECOVERY_COMPLETE: "🛡️ CONTROL_RECOVERY: OPERATOR_IN_COMMAND",
    EARLY_EXIT: "🚨 EARLY_EXIT: NEGATIVE_TREND_DETECTED",
    
    
    AI_THINKING: "🧠 AI_ANALYSIS: EVALUATING_RADAR_CONTEXT",
    AI_QUOTA_EXCEEDED: "⚠️ AI_LIMIT: DAILY_QUOTA_EXCEEDED",
    AI_PARSE_ERROR: "❌ AI_DATA: INVALID_RESPONSE_FORMAT",
    AI_AUTO_PILOT: (count: number) => `🚀 AUTO_PILOT: EXECUTING_${count}_ACTIONS`,
    AI_PROPOSALS_FOUND: (count: number) => `🤖 AI_PROPOSALS: ${count}_ACTIONS_DETECTED`,
    
    
    ERR_400: "🚫 AI_ERR: BAD_REQUEST (CHECK_FORMAT)",
    ERR_401: "🔒 AI_ERR: INVALID_API_KEY",
    ERR_429: "🚫 AI_LIMIT: RATE_LIMIT_EXCEEDED",
    ERR_500: "🔥 AI_BUSY: SERVER_OVERLOAD",
    ERR_504: "⏳ AI_TIMEOUT: GATEWAY_TIMEOUT",
    ERR_GENERIC: (msg: string) => `❌ AI_ERR: ${msg}`,
  },

  
  LEVELS: {
    NORMAL: Number(import.meta.env?.VITE_LEVEL_NORMAL) || 30,
    CAUTION: Number(import.meta.env?.VITE_LEVEL_CAUTION) || 70,
    EMERGENCY: Number(import.meta.env?.VITE_LEVEL_EMERGENCY) || 95,
  }
} as const;

export type ATCColor = typeof ATC_CONFIG.SIMULATOR.COLORS[keyof typeof ATC_CONFIG.SIMULATOR.COLORS];