// src/contexts/atcTypes.ts
import { LogType } from '@/utils/logStyles';

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
}

export interface AgentMeta {
  isLocked: boolean;
  isWaiting: boolean;
  isPriority: boolean;
  isForced: boolean;
  isPaused: boolean;
  statusLabel: string;
  themeColor: string;
  glowIntensity: number;
}