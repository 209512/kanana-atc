// src/store/slices/types.ts
import { Agent, ATCState, AIProposal, ParsedAction, LogEntry } from '@/contexts/atcTypes';

export interface CoreSlice {
  state: ATCState;
  agents: Agent[];
  setState: (updater: ATCState | ((prev: ATCState) => ATCState)) => void;
  setAgents: (updater: Agent[] | ((prev: Agent[]) => Agent[])) => void;
  addLog: (message: string, type: LogEntry['type'], agentId?: string) => void;
  setTrafficIntensityLocal: (val: number) => void;
}

export interface AiSlice {
  isAiMode: boolean;
  isAiAutoMode: boolean;
  aiQuota: number;
  pendingProposals: Map<string, AIProposal>;
  riskScore: number;
  autonomyLevel: number;
  toggleAiMode: (isAi: boolean) => Promise<void>;
  toggleAiAutoMode: (value: boolean) => void;
  setAiQuota: (quota: number) => void;
  setRiskData: (riskScore: number, autonomyLevel: number) => void;
  approveProposals: () => Promise<void>;
  rejectProposals: () => void;
  _executeSystemAction: (action: string, pVal: string | null) => Promise<void>;
  _executeAgentAction: (action: string, actualUuid: string, pVal: string | null) => Promise<void>;
}

export interface ActionSlice {
  isAdminMuted: boolean;
  setIsAdminMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  toggleAdminMute: () => void;
  handoverTarget: string | null;
  triggerHandover: (reason: string) => void;
  resetHandover: () => void;
  
  markAction: (uuid: string, field: string, value: unknown, isDelete?: boolean) => void;
  updateAgentConfigLocal: (uuid: string, config: Partial<Agent>) => void;
  updatePriorityOrder: (order: string[]) => void;

  // 외부 변수로 관리되던 객체들을 Zustand 내부 상태로 편입 (React Reactivity 확보)
  deletedIds: Set<string>;
  fieldLocks: Map<string, Map<string, { value: unknown, expiry: number }>>;

  playAlert: () => void;
  playSuccess: () => void;
  playClick: () => void;
  recordAction: () => void;
}

export interface AuditLog {
  timestamp: number;
  prompt: Record<string, unknown> | string;
  response: string;
  reasoning: {
    thought: string;
    prediction: string;
    report: string;
  };
  actions: ParsedAction[];
}

export interface ATCStore extends CoreSlice, AiSlice, ActionSlice {
  lastKnownGoodActions?: ParsedAction[];
  setLastKnownGoodActions?: (actions: ParsedAction[]) => void;
  metrics?: {
    totalAiCalls: number;
    jailbreakAttempts: number;
    jsonParseFailures: number;
    successfulActions: number;
  };
  recordMetric?: (type: 'call' | 'jailbreak' | 'parseFailure' | 'success') => void;
  auditLogs?: AuditLog[];
  addAuditLog?: (log: Omit<AuditLog, 'timestamp'>) => void;
  isInitializing?: boolean; // 초기 스케일링 중복 방지 플래그
}
