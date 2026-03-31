// src/mocks/simulator.ts
import { v4 as uuidv4 } from 'uuid';
import { ATC_CONFIG } from '@/constants/atcConfig';

const { SIMULATOR, LOG_MSG } = ATC_CONFIG;

export interface MockAgent {
  uuid: string;
  id: string;
  displayName: string;
  seed: number;
  model: string;
  provider: string;
  systemPrompt: string;
  priority: boolean;
  isPaused: boolean;
  status: 'active' | 'waiting' | 'idle' | 'paused';
}

class ATCSimulator {
  state = {
    resourceId: `lock-${Date.now()}`,
    holder: null as string | null,
    priorityAgents: [] as string[],
    forcedCandidate: null as string | null,
    globalStop: false,
    collisionCount: 0,
    logs: [] as any[],
    activeAgentCount: 2,
    overrideSignal: false,
    fencingToken: 1000,
    latency: 12,
    trafficIntensity: 2,
  };

  agents = new Map<string, MockAgent>();
  startTimes = new Map<string, number>();
  lockExpiry = 0;

  constructor() {
    this.init();
  }

  private init() {
    for (let i = 1; i <= 2; i++) {
      const id = uuidv4();
      this.agents.set(id, this.createAgent(id, i));
      this.startTimes.set(id, Date.now());
    }
  }

  getNextAvailableIndex(): number {
    const existingIndices = Array.from(this.agents.values())
      .map(a => {
        const match = a.displayName.match(/Agent-(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);
    
    let index = 1;
    while (existingIndices.includes(index)) index++;
    return index;
  }

  createAgent(id: string, index?: number): MockAgent {
    const finalIndex = index ?? this.getNextAvailableIndex();
    return {
      uuid: id,
      id: id,
      displayName: `Agent-${finalIndex}`,
      seed: Math.random() * 1000,
      model: 'MQ-9 Reaper Class',
      provider: 'mock',
      systemPrompt: 'You are a professional AI.',
      priority: false,
      isPaused: false,
      status: 'idle'
    };
  }

  updateAgent(uuid: string, updates: Partial<MockAgent>) {
    const agent = this.agents.get(uuid);
    if (agent) {
      this.agents.set(uuid, { ...agent, ...updates });
      return true;
    }
    return false;
  }

  addLog(agentId: string, message: string, type: string = 'info', overrideName?: string) {
    const agent = this.agents.get(agentId);
    const displayName = overrideName 
      || agent?.displayName 
      || (['SYSTEM', 'POLICY', 'USER', 'ADMIN'].includes(agentId) ? agentId : `NODE_${agentId.substring(0, 4)}`);
      
    const logEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      agentId: agentId || 'SYSTEM',
      agentName: displayName,
      message: message || '',
      timestamp: Date.now(),
      type
    };
    this.state.logs = [...this.state.logs.slice(-99), logEntry];
  }

  updateState(updates: Partial<ATCSimulator['state']>) {
    this.state = { ...this.state, ...updates };
  }

  update() {
    const now = Date.now();

    // 1. 글로벌 정지/오버라이드 시 즉시 반환
    if (this.state.globalStop || this.state.overrideSignal) {
      if (this.state.globalStop) {
        this.state.holder = null;
        this.state.forcedCandidate = null;
      }
      return;
    }

    // 2. ★ 고스트 에이전트 체크
    if (this.state.holder && !this.agents.has(this.state.holder)) this.state.holder = null;
    if (this.state.forcedCandidate && !this.agents.has(this.state.forcedCandidate)) this.state.forcedCandidate = null;

    const allAgents = Array.from(this.agents.values());
    const aliveAgents = allAgents.filter(a => !a.isPaused);
    const aliveUids = aliveAgents.map(a => a.uuid);

    // 3. 강제 할당 (Transfer-Lock)
    if (this.state.forcedCandidate) {
      if (now >= this.lockExpiry) {
        const targetId = this.state.forcedCandidate;
        this.state.forcedCandidate = null; 
        this.state.holder = targetId;
        this.state.fencingToken++;
        
        this.addLog(targetId, LOG_MSG.TRANSFER_SUCCESS, "success");
        this.addLog(targetId, LOG_MSG.LOCK_GRANTED(this.state.fencingToken), "lock");
        this.lockExpiry = now + SIMULATOR.LOCK_DURATION;
      }
      return;
    }

    // 4. PLC, 경쟁 로그
    aliveAgents.forEach((agent) => {
      if (this.state.holder && this.state.holder !== agent.uuid) {
        const holderAgent = this.agents.get(this.state.holder);
        if (holderAgent) {
          const phase = (now + (agent.seed % 50) * 100) % 10000;
          if (phase < 100) {
            const isHolderPriority = this.state.priorityAgents.includes(this.state.holder);
            const isAgentPriority = this.state.priorityAgents.includes(agent.uuid);

            if (isHolderPriority && isAgentPriority) {
              this.addLog('POLICY', LOG_MSG.PRIORITY_CONTENTION, 'policy');
              this.addLog(agent.uuid, LOG_MSG.WAIT_FOR(holderAgent.displayName), 'warn');
            } else if (isHolderPriority && !isAgentPriority) {
              this.addLog(agent.uuid, LOG_MSG.BLOCKED_BY(holderAgent.displayName), 'policy');
            } else {
              this.addLog(agent.uuid, LOG_MSG.WAIT_FOR(holderAgent.displayName), 'warn');
            }
          }
        }
      }
    });

    // 5. 일반 할당
    if (!this.state.holder || now > this.lockExpiry) {
      if (aliveUids.length > 0) {
        const priorityPool = this.state.priorityAgents.filter(id => aliveUids.includes(id));
        let nextId: string;

        if (priorityPool.length > 0) {
          nextId = priorityPool[0];
          const remaining = this.state.priorityAgents.filter(id => id !== nextId);
          this.state.priorityAgents = [...remaining, nextId];
        } else {
          const otherCandidates = aliveUids.filter(id => id !== this.state.holder);
          const finalPool = otherCandidates.length > 0 ? otherCandidates : aliveUids;
          nextId = finalPool[Math.floor(Math.random() * finalPool.length)];
        }

        if (nextId !== this.state.holder || !this.state.holder) {
          this.state.holder = nextId;
          this.state.fencingToken++;
          this.addLog(nextId, LOG_MSG.LOCK_GRANTED(this.state.fencingToken), "lock");
          this.lockExpiry = now + SIMULATOR.LOCK_DURATION;
        }
      }
    }
    
  }
}

export const simulator = new ATCSimulator();