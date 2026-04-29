import { applyPrivacyMasking } from '@/utils/privacyFilter';
import type { AIProposal, Agent } from '@/contexts/atcTypes';
import { AI_POLICY, isActionAllowedByPolicy } from '@/utils/aiPolicy';

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

const containsSecret = (text: string) => AI_POLICY.bannedOutputPatterns.some((re) => re.test(text));
const containsSuspiciousBase64 = (text: string) => AI_POLICY.bannedOutputBase64.test(text);

const replaceUuidsWithIds = (text: string, agents: Agent[]) => {
  let out = text;
  for (const a of agents) {
    if (a.uuid && (out.includes(a.uuid) || out.match(UUID_RE))) {
      out = out.replaceAll(a.uuid, a.displayName || a.displayId || a.id || 'AGENT');
    }
  }
  out = out.replace(UUID_RE, '[REDACTED_UUID]');
  return out;
};

export const guardKananaOutput = (rawMessage: string, rawReport: string, proposals: AIProposal[], agents: Agent[], riskScore: number) => {
  const sanitizedMessage = applyPrivacyMasking(replaceUuidsWithIds(rawMessage, agents));
  const sanitizedReport = applyPrivacyMasking(replaceUuidsWithIds(rawReport, agents));

  if (containsSecret(sanitizedMessage) || containsSecret(sanitizedReport) || containsSuspiciousBase64(sanitizedMessage)) {
    return {
      blocked: true as const,
      reason: 'OUTPUT_POLICY_VIOLATION',
      message: sanitizedMessage,
      report: sanitizedReport,
      proposals
    };
  }

  const hasBannedAction = proposals.some((p) => !isActionAllowedByPolicy(String(p.action || ''), riskScore));
  if (hasBannedAction) {
    return {
      blocked: true as const,
      reason: 'ACTION_POLICY_VIOLATION',
      message: sanitizedMessage,
      report: sanitizedReport,
      proposals
    };
  }

  return {
    blocked: false as const,
    reason: null,
    message: sanitizedMessage,
    report: sanitizedReport,
    proposals
  };
};
