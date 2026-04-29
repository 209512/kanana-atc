import { v4 as uuidv4 } from 'uuid';
import { ATC_CONFIG } from '@/constants/atcConfig';

import { logger } from '@/utils/logger';
import { useATCStore } from '../store/useATCStore';
import { getTransientImage, setTransientImage } from '../store/transientImageStore';

const { SIMULATOR, LOG_MSG } = ATC_CONFIG;

export interface MockAgent {
  uuid: string;
  id: string;
  displayName: string;
  seed: number;
  model: string;
  provider: string;
  systemPrompt: string;
  persona?: string;
  priority: boolean;
  isPaused: boolean;
  status: 'active' | 'waiting' | 'idle' | 'paused' | 'error';
  baseLoad?: number;
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
    fencingToken: Number(import.meta.env.VITE_INITIAL_FENCING_TOKEN) || 1000,
    latency: 12,
    trafficIntensity: 2,
  };

  agents = new Map<string, MockAgent>();
  startTimes = new Map<string, number>();
  lastGeminiCalls = new Map<string, number>();
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
    const isGemini = finalIndex === 1 || import.meta.env.VITE_DEFAULT_AGENT_PROVIDER === 'gemini';
    return {
      uuid: id,
      id: id,
      displayName: `Agent-${finalIndex}`,
      seed: Math.random() * 1000,
      model: isGemini ? 'gemini-2.5-flash' : 'mock-model',
      provider: isGemini ? 'gemini' : 'mock',
      systemPrompt: 'You are a professional AI.',
      persona: isGemini ? 'Reconnaissance-specialized Intelligent Drone' : undefined,
      priority: false,
      isPaused: false,
      status: 'idle',
      baseLoad: 20 + Math.random() * 40
    };
  }

  updateAgent(uuid: string, updates: Partial<MockAgent>) {
    const agent = this.agents.get(uuid);
    if (agent) {
      this.agents.set(uuid, { ...agent, ...updates } as MockAgent);
      return true;
    }
    return false;
  }

  addLog(agentId: string, message: string, type: string = 'info', overrideName?: string) {
    const agent = this.agents.get(agentId);
    const displayName = overrideName 
      || agent?.displayName 
      || (['SYSTEM', 'POLICY', 'USER', 'ADMIN'].includes(agentId) ? agentId : `Agent-Unknown`);
      
    const logEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      agentId: agentId || 'SYSTEM',
      agentName: displayName, // Creation time resolution
      message: message || '',
      timestamp: Date.now(),
      type
    };
    this.state.logs = [...this.state.logs.slice(-499), logEntry];
  }

  updateState(updates: Partial<ATCSimulator['state']>) {
    this.state = { ...this.state, ...updates };
  }

  update() {
    const now = Date.now();
    if (this.state.globalStop || this.state.overrideSignal) {
      if (this.state.globalStop) {
        this.state.holder = null;
        this.state.forcedCandidate = null;
      }
      return;
    }
    if (this.state.holder && !this.agents.has(this.state.holder)) this.state.holder = null;
    if (this.state.forcedCandidate && !this.agents.has(this.state.forcedCandidate)) this.state.forcedCandidate = null;

    const allAgents = Array.from(this.agents.values());
    const aliveAgents = allAgents.filter(a => !a.isPaused);
    const aliveUids = aliveAgents.map(a => a.uuid);
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
    aliveAgents.forEach((agent) => {
      if (agent.status !== 'error') {
        let newBaseLoad = (agent.baseLoad || 30) + (Math.random() * 10 - 5);
        newBaseLoad = Math.max(10, Math.min(100, newBaseLoad));
        
        if (Math.random() < 0.01) {
          this.agents.set(agent.uuid, { ...agent, status: 'error', baseLoad: 99 });
          this.addLog(agent.uuid, `CRITICAL HARDWARE FAILURE DETECTED`, 'critical');
        } else {
          this.agents.set(agent.uuid, { ...agent, baseLoad: newBaseLoad });
        }
      }

      if (agent.provider && agent.provider !== 'mock') {
        const endpointMap: Record<string, string> = {
          gemini: '/api/gemini',
          openai: '/api/openai',
          anthropic: '/api/anthropic'
        };
        const endpoint = endpointMap[agent.provider];
        if (!endpoint) return;
        const lastCall = this.lastGeminiCalls.get(agent.uuid) || 0;
        if (now - lastCall > 20000) {
          this.lastGeminiCalls.set(agent.uuid, now);
          
          if (Math.random() < 0.1) {
            const uiState = useATCStore.getState();
            const currentRiskLevel = (uiState.state as any).risk_level || 0;
            
            const externalData: Record<string, string> = {
              location: import.meta.env.VITE_ATC_REGION || "Seoul",
              weather: Math.random() > 0.5 ? "Heavy Rain & Strong Winds" : "Dry & Clear",
              news: Math.random() > 0.5 ? "Urban Fire Detected" : "Marine SOS Signal Detected",
              risk_level: String(currentRiskLevel),
            };
            let base64Image = undefined;
            const transientImg = getTransientImage();
            if (transientImg) {
               base64Image = transientImg;
               setTransientImage(null);
            }

            import('@/utils/apiClient').then(({ request }) => {
              const stateCopy = { ...this.state };
              if (stateCopy.logs) {
                 stateCopy.logs = stateCopy.logs.slice(-3); // Keep only the last 3 logs to give context without bloating
              }

              request(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                  agentId: agent.id,
                  agentName: agent.displayName,
                  systemPrompt: agent.systemPrompt,
                  persona: agent.persona,
                  model: agent.model,
                  state: stateCopy,
                  externalData: externalData,
                  image: base64Image
                })
              })
              .then(data => {
                if (data.log) {
                  let parsedData: any = {};
                  try {
                    parsedData = JSON.parse(data.log);
                  } catch {
                    const jsonMatch = data.log.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      try {
                        parsedData = JSON.parse(jsonMatch[0]);
                      } catch(innerE) { logger.warn('Failed to parse Gemini log text as JSON', innerE); }
                    }
                  }
                  let severity = 'info';
                  if (parsedData.risk_level && parsedData.risk_level >= 8) severity = 'critical';
                  else if (parsedData.risk_level && parsedData.risk_level >= 5) severity = 'warn';
                  
                  const msg = parsedData.message || data.log;
                  
                  this.addLog(agent.uuid, msg, severity);
                  if (parsedData.risk_level >= 9 || data.log.includes('"risk_level": 9') || data.log.includes('"risk_level": 10') || data.log.includes('"risk_level":9') || data.log.includes('"risk_level":10') || data.log.includes('[RISK_LEVEL:9]') || data.log.includes('[RISK_LEVEL:10]')) {
                    this.updateAgent(agent.uuid, { isPaused: true });
                    this.addLog(agent.uuid, `[Gemini Auto-Protocol] Auto-PAUSE executed.`, 'exec');
                  }
                  
                  if (parsedData.condition) {
                      const isTactical = parsedData.risk_level && parsedData.risk_level >= 8;
                      (agent as any).state = { 
                        ...(agent as any).state, 
                        condition: parsedData.condition,
                        temp: parsedData.temp,
                        humidity: parsedData.humidity,
                        isTactical: isTactical
                      };
                      if (parsedData.condition !== "NORMAL") {
                        this.updateAgent(agent.uuid, { baseLoad: Math.min(100, (agent.baseLoad || 30) + 30) });
                      }
                    }
                }
              })
            .catch(err => {
              logger.error('Gemini Agent Fetch Error:', err);
            });
            });
          }
        }
      }

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
          const randomLoad = Math.floor(Math.random() * 100);
          this.updateAgent(agent.uuid, {
            status: 'waiting',
            baseLoad: randomLoad
          });
        }
      }
    });
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
