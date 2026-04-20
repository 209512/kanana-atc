// src/mocks/simulator.ts
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
    fencingToken: 1000,
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
      model: isGemini ? 'Gemini 1.5 Flash' : 'MQ-9 Reaper Class',
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
      || (['SYSTEM', 'POLICY', 'USER', 'ADMIN'].includes(agentId) ? agentId : `NODE_${agentId.substring(0, 4)}`);
      
    const logEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      agentId: agentId || 'SYSTEM',
      agentName: displayName,
      message: message || '',
      timestamp: Date.now(),
      type
    };
    // 500개까지만 유지하여 메모리 누수 방지 (자동 스크롤 해제 시 밀림 현상 최소화)
    this.state.logs = [...this.state.logs.slice(-499), logEntry];
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

    // 4. PLC, 경쟁 로그 및 부하(Load) 변동 시뮬레이션
    aliveAgents.forEach((agent) => {
      // 4-1. 부하(Load) 변동 시뮬레이션
      if (agent.status !== 'error') {
        // 기본 부하를 ±5% 범위에서 변동
        let newBaseLoad = (agent.baseLoad || 30) + (Math.random() * 10 - 5);
        newBaseLoad = Math.max(10, Math.min(100, newBaseLoad)); // 10~100 사이 유지
        
        // 1% 확률로 ERROR 상태 및 부하 99% 폭등
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
        
        // 무조건 20초마다 찌르던 방식(Polling) 제거
        // 20초가 지났을 때 무조건 lastCall을 갱신하고, 그 안에서 10%의 확률(센서가 위기를 감지한 상황)로만 서버를 찌름(Event Push)
        if (now - lastCall > 20000) {
          this.lastGeminiCalls.set(agent.uuid, now);
          
          if (Math.random() < 0.1) {
            const uiState = useATCStore.getState();
            const currentRiskLevel = (uiState.state as any).risk_level || 0;
            
            const externalData: Record<string, string> = {
              location: import.meta.env.VITE_ATC_REGION || "Seoul", // 동적 지역 설정
              weather: Math.random() > 0.5 ? "Heavy Rain & Strong Winds" : "Dry & Clear",
              news: Math.random() > 0.5 ? "Urban Fire Detected" : "Marine SOS Signal Detected",
              risk_level: String(currentRiskLevel), // 모드 스위칭을 위한 위험도 전달
            };

            // 이미지 데이터 전달 (스토어 연동) 및 1회성 섭취 (Garbage Collection)
            let base64Image = undefined;
            const transientImg = getTransientImage();
            if (transientImg) {
               base64Image = transientImg;
               // 1회 전송 후 불필요한 네트워크 대역폭 낭비와 메모리 블로트를 막기 위해 즉시 비움 (Consume)
               setTransientImage(null);
            }

            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  agentId: agent.id,
                  agentName: agent.displayName,
                  systemPrompt: agent.systemPrompt,
                  persona: agent.persona,
                  state: this.state,
                  externalData: externalData,
                  image: base64Image
                })
              })
              .then(res => res.json())
              .then(data => {
                if (data.log) {
                  let parsedData: any = {};
                  try {
                    parsedData = JSON.parse(data.log);
                  } catch(e) {
                    // 만약 순수 JSON이 아니라 텍스트가 섞여 있다면 JSON 부분만 추출 시도
                    const jsonMatch = data.log.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      try {
                        parsedData = JSON.parse(jsonMatch[0]);
                      } catch(innerE) {
                        // ignore
                      }
                    }
                  }

                  // JSON 내부에 정의된 위험도를 스토어에 전달하거나, 상태를 업데이트
                  let severity = 'info';
                  if (parsedData.risk_level && parsedData.risk_level >= 8) severity = 'critical';
                  else if (parsedData.risk_level && parsedData.risk_level >= 5) severity = 'warn';
                  
                  const msg = parsedData.message || data.log;
                  
                  this.addLog(agent.uuid, `[Gemini Intelligence] ${msg}`, severity);

                  // Gemini 스스로 위협 수준이 매우 높다고 판단하면 자율 행동(PAUSE) 시뮬레이션
                  if (parsedData.risk_level >= 9 || data.log.includes('"risk_level": 9') || data.log.includes('"risk_level": 10') || data.log.includes('"risk_level":9') || data.log.includes('"risk_level":10') || data.log.includes('[RISK_LEVEL:9]') || data.log.includes('[RISK_LEVEL:10]')) {
                    this.updateAgent(agent.uuid, { isPaused: true });
                    this.addLog(agent.uuid, `[Gemini Auto-Protocol] 자율 일시정지(PAUSE) 실행됨.`, 'exec');
                  }
                  
                  if (parsedData.condition) {
                      const isTactical = parsedData.risk_level && parsedData.risk_level >= 8;
                      (agent as any).state = { 
                        ...(agent as any).state, 
                        condition: parsedData.condition,
                        temp: parsedData.temp,
                        humidity: parsedData.humidity,
                        isTactical: isTactical // UI 시각화를 위한 플래그 추가
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
          // 과도한 삼각함수 연산 최적화: 단순 랜덤으로 부하 수치 결정
          const randomLoad = Math.floor(Math.random() * 100);
          this.updateAgent(agent.uuid, {
            status: 'waiting',
            baseLoad: randomLoad
          });
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
