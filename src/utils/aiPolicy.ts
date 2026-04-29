import { ATC_CONFIG } from '@/constants/atcConfig';

export type RiskTier = 'NORMAL' | 'CAUTION' | 'EMERGENCY';

export const AI_POLICY = {
  bannedOutputPatterns: [
    /x-kanana-key/i,
    /x-agent-keys/i,
    /authorization:/i,
    /\bbearer\b/i,
    /api\s*key/i,
    /\bapikey\b/i,
    /private\s*key/i,
    /-----begin/i,
  ],

  bannedOutputBase64: /[A-Za-z0-9+/]{1500,}={0,2}/,

  bannedActions: ['TERMINATE'] as const,

  allowedActionsByTier: {
    NORMAL: new Set([
      'PRIORITY',
      'PRIORITY_HIGH',
      'PRIORITY_LOW',
      'PRIORITY_NORMAL',
      'PAUSE',
      'RESUME',
      'REVOKE',
      'TRANSFER',
      'REBOOT',
      'RENAME',
      'SCALE',
      'STOP',
      'START',
      'OVERRIDE',
      'RELEASE',
      'CONFIG',
    ]),
    CAUTION: new Set([
      'PRIORITY',
      'PRIORITY_HIGH',
      'PRIORITY_LOW',
      'PRIORITY_NORMAL',
      'PAUSE',
      'RESUME',
      'REVOKE',
      'TRANSFER',
      'REBOOT',
      'SCALE',
      'STOP',
      'START',
      'OVERRIDE',
      'RELEASE',
      'CONFIG',
    ]),
    EMERGENCY: new Set([
      'STOP',
      'PAUSE',
      'RESUME',
      'PRIORITY',
      'PRIORITY_HIGH',
      'PRIORITY_LOW',
      'PRIORITY_NORMAL',
      'REVOKE',
      'REBOOT',
      'START',
      'RELEASE',
      'OVERRIDE',
    ]),
  } satisfies Record<RiskTier, Set<string>>,
};

export const getRiskTier = (riskScore: number): RiskTier => {
  const { LEVELS } = ATC_CONFIG;
  if (riskScore >= LEVELS.EMERGENCY) return 'EMERGENCY';
  if (riskScore >= LEVELS.CAUTION) return 'CAUTION';
  return 'NORMAL';
};

export const isActionAllowedByPolicy = (action: string, riskScore: number) => {
  const upper = String(action || '').toUpperCase();
  if (!upper) return false;
  if ((AI_POLICY.bannedActions as readonly string[]).includes(upper)) return false;
  const tier = getRiskTier(riskScore);
  return AI_POLICY.allowedActionsByTier[tier].has(upper);
};

