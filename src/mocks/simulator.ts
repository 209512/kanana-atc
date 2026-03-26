// src/mocks/simulator.ts
import { v4 as uuidv4 } from 'uuid';

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

export const CONSTANTS = {
  LOCK_NAME: 'traffic-control-lock',
  LOCK_DURATION: 5000,
  TRANSFER_DELAY: 800,
  COLOR_DEFAULT: '#3b82f6',
  COLOR_OVERRIDE: '#ef4444',
  COLOR_LOCKED: '#10b981',
  COLOR_PRIORITY: '#f59e0b',
  COLOR_PAUSED: '#94a3b8',
};

class ATCSimulator {
  state = {
    resourceId: `${CONSTANTS.LOCK_NAME}-${Date.now()}`,
    holder: null as string | null,
    waitingAgents: [] as string[],
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
    while (existingIndices.includes(index)) {
      index++;
    }
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
      systemPrompt: 'You are a helpful AI traffic controller.',
      priority: false,
      isPaused: false,
      status: 'idle'
    };
  }

  updateAgent(uuid: string, updates: Partial<MockAgent>) {
    const agent = this.agents.get(uuid);
    if (agent) {
      const updatedAgent = { ...agent, ...updates };
      this.agents.set(uuid, updatedAgent);
      return true;
    }
    return false;
  }

  addLog(agentId: string, message: string, type: string = 'info') {
    const agent = this.agents.get(agentId);
    const displayName = agent ? agent.displayName : (['SYSTEM', 'POLICY', 'NETWORK', 'ADMIN', 'OPERATOR'].includes(agentId) ? agentId : agentId);
    
    const logEntry = {
      id: `S-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      agentId,
      agentName: displayName,
      message,
      timestamp: Date.now(),
      type
    };

    this.state.logs = [...this.state.logs, logEntry].slice(-100);
  }

  update() {
    const now = Date.now();

    if (this.state.globalStop) {
      this.state.holder = null;
      this.state.forcedCandidate = null;
      return;
    }

    const allAgents = Array.from(this.agents.values());
    const aliveAgents = allAgents.filter(a => !a.isPaused);
    const aliveUids = aliveAgents.map(a => a.uuid);

    if (this.state.overrideSignal) return;

    aliveAgents.forEach((agent, index) => {
      if (this.state.holder && this.state.holder !== agent.uuid) {
        const holderAgent = this.agents.get(this.state.holder);
        const holderName = holderAgent?.displayName || (this.state.holder === 'Human (Admin)' ? 'ADMIN' : 'SYSTEM');
        
        const jitter = (agent.seed % 50) * 100; 
        const phase = (now + jitter) % 10000;

        if (phase < 100) {
          if (this.state.priorityAgents.includes(this.state.holder) && !this.state.priorityAgents.includes(agent.uuid)) {
            this.addLog(agent.uuid, `🚫 BLOCKED_BY: [${holderName}]`, 'policy');
            if (index === 0) this.addLog('POLICY', `🚨 Priority Contention`, 'policy');
          } else {
            this.addLog(agent.uuid, `⚔️ WAIT_FOR: [${holderName}]`, 'warn');
          }
        }
      }
    });

    if (this.state.forcedCandidate) {
      if (this.state.holder !== null) {
        const oldHolder = this.state.holder;
        this.state.holder = null;
        this.state.resourceId = `${CONSTANTS.LOCK_NAME}-${now}`;
        this.lockExpiry = now + CONSTANTS.TRANSFER_DELAY;
        this.addLog(oldHolder, `🔓 Lock Released`, "info");
      } else if (now > this.lockExpiry) {
        const targetId = this.state.forcedCandidate;
        this.state.forcedCandidate = null;
        this.state.holder = targetId;
        
        this.addLog(targetId, `✨ Success: Received Transferred Lock`, "success");
        this.addLog(targetId, `🔒 Access Granted (Fence: ${++this.state.fencingToken})`, "lock");
        
        this.lockExpiry = now + CONSTANTS.LOCK_DURATION;
      }
    } 
    else if (!this.state.holder || now > this.lockExpiry) {
      if (aliveUids.length > 0) {
        const priorityPool = this.state.priorityAgents.filter(id => aliveUids.includes(id));
        const nextId = priorityPool.length > 0 
          ? priorityPool[Math.floor(Math.random() * priorityPool.length)]
          : aliveUids[Math.floor(Math.random() * aliveUids.length)];

        if (nextId !== this.state.holder) {
          this.state.holder = nextId;
          this.addLog(nextId, `🔒 Access Granted (Fence: ${++this.state.fencingToken})`, "lock");
          this.lockExpiry = now + CONSTANTS.LOCK_DURATION;
        }
      }
    }
  }
}

export const simulator = new ATCSimulator();