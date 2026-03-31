// src/contexts/atcTypes.ts
import { LogType } from '@/utils/logStyles';

export interface AIProposal {
  id: string;
  action: 'PAUSE' | 'RESUME' | 'PRIORITY' | 'REVOKE' | 'TRANSFER' | 'RENAME'
  | 'TERMINATE' | 'STOP' | 'START' | 'OVERRIDE' | 'RELEASE' | 'SCALE';
  targetId?: string;
  value?: any;
  reason: string;
  timestamp: number;
}

export interface LogEntry {
  id: string;
  agentId?: string;
  message: string;
  messageStd?: string;
  messageTech?: string;
  timestamp: Date | number;
  type: LogType;
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
  position: [number, number, number];
  metrics?: {
    ts: string;
    lat: string;
    tot: string;
    load: string;
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
  pendingProposals: AIProposal[];
  handoverTarget: string | null;
  autonomyLevel: number;
}