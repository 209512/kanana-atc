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
  isAnalyzing: boolean;
  pendingProposals: Map<string, AIProposal>;
  riskScore: number;
  autonomyLevel: number;
  toggleAiMode: (isAi: boolean) => Promise<void>;
  toggleAiAutoMode: (value: boolean) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setRiskData: (riskScore: number, autonomyLevel: number) => void;
  approveProposals: () => Promise<void>;
  rejectProposals: () => void;
  clearProposals: () => void;
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
  metrics?: {
    totalAiCalls: number;
    jailbreakAttempts: number;
    jsonParseFailures: number;
    successfulActions: number;
  };
  recordMetric?: (type: 'call' | 'jailbreak' | 'parseFailure' | 'success') => void;
  auditLogs?: AuditLog[];
  addAuditLog?: (log: Omit<AuditLog, 'timestamp'>) => void;
  initAuditLogs?: () => Promise<void>;
  isInitializing?: boolean; 
}
