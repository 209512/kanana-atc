import { LogType } from '@/utils/logStyles';

export interface AIProposal {
  id: string;
  agentId: string;
  action: string;
  targetId?: string;
  value?: string | boolean | null;
  reason: string;
  timestamp: number;
}

export interface ParsedAction {
  id: string;
  action: string;
  targetId?: string;
  value?: string | boolean | null;
  reason: string;
  timestamp: number;
}

export interface LogEntry {
  id: string;
  agentId?: string;
  agentName?: string; // Resolved name at creation time
  message: string;
  messageStd?: string;
  messageTech?: string;
  timestamp: Date | number;
  type: LogType;
}

export interface RiskMetrics {
  ts: string;
  lat: string;
  tot: string;
  load: string;
}

export interface FieldReport {
  agentId: string;
  agentName: string;
  risk_level: number;
  condition: 'NORMAL' | 'CAUTION' | 'CRITICAL';
  strategy: string | null;
  message: string;
  ts: number;
}

export interface Agent {
  id: string;
  uuid: string;
  displayId?: string;
  displayName?: string;
  name?: string;
  model: string;
  status: 'active' | 'waiting' | 'idle' | 'paused' | 'processing';
  activity?: string;
  priority?: boolean;
  isPaused?: boolean;
  color?: string;
  position?: [number, number, number];
  activeTime?: number;
  index?: number;
  seed?: number;
  provider?: string;
  apiKey?: string;
  systemPrompt?: string;
  persona?: string;
  metrics: {
    ts: number;
    lat: number;
    tot: number;
    load: number;
  };
}

export interface ATCState {
  holder: string | null;
  waitingAgents: string[];
  priorityAgents: string[];
  forcedCandidate: string | null;
  globalStop: boolean;
  collisionCount: number;
  logs: LogEntry[];
  activeAgentCount: number;
  overrideSignal: boolean; 
  latency: number;
  trafficIntensity: number;
  pendingProposals: Map<string, AIProposal>;
  handoverTarget: string | null;
}
