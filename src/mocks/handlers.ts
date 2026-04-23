// src/mocks/handlers.ts
import { http, passthrough, HttpResponse } from 'msw';
import { v4 as uuidv4 } from 'uuid';
import { simulator } from './simulator';
import { ATC_CONFIG, ATCColor } from '@/constants/atcConfig';

const { SIMULATOR, LOG_MSG } = ATC_CONFIG;

let isInitialized = false;

/**
 * Resolves ID to actual UUID if DisplayName is provided
 */
const resolveUuid = (idOrName: string): string => {
  // 1. Return if already valid UUID
  if (simulator.agents.has(idOrName)) return idOrName;
  
  // 2. Find by DisplayName (case-insensitive)
  const found = Array.from(simulator.agents.values()).find(
    (a) => a.displayName.toLowerCase() === idOrName.toLowerCase() || a.id === idOrName
  );
  
  return found ? found.uuid : idOrName;
};

const getOrbitPosition = (seed: number, activeTime: number, index: number, isPaused: boolean): [number, number, number] => {
  const radius = 5 + (index % 3) * 2.8;
  const direction = (seed % 2 === 0) ? 1 : -1;
  const angle = (seed * (Math.PI * 2 / 5)) + (activeTime * 0.0003 * direction);
  return [Math.cos(angle) * radius, ((index % 4) - 1.5) * 1.5, Math.sin(angle) * radius];
};

const lastActiveTimes = new Map<string, number>();

export const handlers = [
  http.all('*/api/kanana', () => passthrough()),
  http.all('*/proxy/kanana', () => passthrough()),
  http.all('*/api/kanana-poll', () => passthrough()),
  http.all('*/api/init', () => passthrough()),
  http.all('*/api/gemini', () => passthrough()),
  http.all('*/api/openai', () => passthrough()),
  http.all('*/api/anthropic', () => passthrough()),

  // Stream Handler
  http.get('*/api/stream', () => {
    isInitialized = true;
    const encoder = new TextEncoder();
    let intervalId: any;
    
    return new HttpResponse(new ReadableStream({
      start(controller) {
        // WORKER: Dynamic interval for main thread optimization (250ms ~ 1000ms)
        const agentCount = simulator.agents.size;
        const dynamicInterval = Math.max(250, Math.min(1000, agentCount * 5));
        
        intervalId = setInterval(() => {
          simulator.update();
          const now = Date.now();
          const agentList = Array.from(simulator.agents.values());
          const agents = agentList.map((agent, index) => {
            const isPriority = simulator.state.priorityAgents.includes(agent.uuid);
            const isPausedEffective = agent.isPaused || simulator.state.globalStop;
            const isLocked = simulator.state.holder === agent.uuid;
            
            let effectiveActiveTime: number;
            const startTime = simulator.startTimes.get(agent.uuid) || now;
            if (isPausedEffective) {
              effectiveActiveTime = lastActiveTimes.get(agent.uuid) || (now - startTime);
            } else {
              effectiveActiveTime = now - startTime;
              lastActiveTimes.set(agent.uuid, effectiveActiveTime);
            }

            let status: any = 'idle';

            let color: ATCColor = SIMULATOR.COLORS.DEFAULT;
            if (simulator.state.overrideSignal) { 
              status = 'emergency'; 
              color = SIMULATOR.COLORS.OVERRIDE; 
            } else if (isPausedEffective) { 
              status = 'paused'; 
              color = SIMULATOR.COLORS.PAUSED; 
            } else if (isLocked) { 
              status = 'active'; 
              color = SIMULATOR.COLORS.LOCKED; 
            } else if (isPriority) { 
              status = 'waiting'; 
              color = SIMULATOR.COLORS.PRIORITY; 
            }

            return {
              ...agent,
              status, color, isPaused: !!agent.isPaused, priority: isPriority,
              position: getOrbitPosition(agent.seed, effectiveActiveTime, index, isPausedEffective),
              metrics: { ts: '0.1s', lat: '12ms', tot: '0.5s', load: '15%' }
            };
          });

          const aliveUids = agentList.filter(a => !a.isPaused && !simulator.state.globalStop).map(a => a.uuid);
          const payload = {
            state: { 
              ...simulator.state, 
              activeAgentCount: agentList.length,
              waitingAgents: aliveUids.filter(id => id !== simulator.state.holder),
              timestamp: now 
            }, 
            agents: agents
          };
          try { 
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); 
          } catch (e) { 
            clearInterval(intervalId); 
          }
        }, dynamicInterval);
      },
      cancel() {
        if (intervalId) clearInterval(intervalId);
      }
    }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  }),

  // Bulk Action Handler (w/ resolveUuid)
  http.post('*/api/actions/bulk', async ({ request }) => {
    const { actions } = await request.json() as { actions: any[] };
    
    if (!actions || !Array.isArray(actions)) {
      return HttpResponse.json({ success: false }, { status: 400 });
    }

    actions.forEach(action => {
      const { action: type, targetId: rawTargetId, value } = action;
      if (!rawTargetId && !['STOP', 'START', 'OVERRIDE', 'RELEASE'].includes(type)) return;

      // Convert provided ID to actual UUID
      const targetId = resolveUuid(rawTargetId);

      switch(type) {
        case 'PAUSE': 
          simulator.updateAgent(targetId, { isPaused: true }); 
          break;
        case 'RESUME': 
          simulator.updateAgent(targetId, { isPaused: false }); 
          break;
        case 'PRIORITY': 
          if (simulator.agents.has(targetId) && !simulator.state.priorityAgents.includes(targetId)) {
            simulator.state.priorityAgents = [...simulator.state.priorityAgents, targetId];
          }
          break;
        case 'REVOKE': 
          simulator.state.priorityAgents = simulator.state.priorityAgents.filter(id => id !== targetId);
          break;
        case 'TRANSFER':
          simulator.state.forcedCandidate = targetId;
          simulator.state.holder = null;
          simulator.lockExpiry = Date.now() + SIMULATOR.TRANSFER_DELAY;
          break;
        case 'TERMINATE':
          simulator.agents.delete(targetId);
          simulator.state.priorityAgents = simulator.state.priorityAgents.filter(u => u !== targetId);
          if (simulator.state.holder === targetId) simulator.state.holder = null;
          break;
        case 'RENAME':
          if (value) simulator.updateAgent(targetId, { displayName: String(value) });
          break;
        case 'SCALE': 
          if (value !== undefined && value !== null) {
            simulator.updateState({ trafficIntensity: Number(value) });
          }
          break;
        case 'STOP': 
          simulator.state.globalStop = true; 
          break;
        case 'START': 
          simulator.state.globalStop = false; 
          break;
        case 'OVERRIDE':
          simulator.state.overrideSignal = true;
          simulator.state.holder = 'USER';
          break;
        case 'RELEASE':
          simulator.state.overrideSignal = false;
          simulator.state.holder = null;
          break;
      }
    });

    return HttpResponse.json({ success: true });
  }),
  
  // Agent Scale
  http.post('*/api/agents/scale', async ({ request }) => {
    const { count } = await request.json() as any;
    simulator.updateState({ trafficIntensity: count });
    const currentAgents = Array.from(simulator.agents.values());
    const currentCount = currentAgents.length;
    if (count > currentCount) {
      for (let i = 0; i < (count - currentCount); i++) {
        const id = uuidv4();
        const newAgent = simulator.createAgent(id);
        simulator.agents.set(id, newAgent);
        simulator.startTimes.set(id, Date.now());
      }
    } else if (count < currentCount) {
      const keys = Array.from(simulator.agents.keys());
      const removeCount = currentCount - count;

      for (let i = 0; i < removeCount; i++) {
        const id = keys[keys.length - 1 - i];
        const agent = simulator.agents.get(id);
        
        if (agent) {
          const deletedName = agent.displayName;
          simulator.addLog("SYSTEM", LOG_MSG.TERMINATING(deletedName), "error", deletedName);
          
          simulator.agents.delete(id);
          simulator.state.priorityAgents = simulator.state.priorityAgents.filter(uid => uid !== id);
          lastActiveTimes.delete(id);
          
          if (simulator.state.holder === id) {
            simulator.state.holder = null;
          }
        }
      }
    }
    return HttpResponse.json({ success: true, count });
  }),

  // Pause Control
  http.post('*/api/agents/:uuid/pause', async ({ request, params }) => {
    const { pause } = await request.json() as any;
    const { uuid } = params;
    if (simulator.updateAgent(uuid as string, { isPaused: pause })) {
      if (pause && simulator.state.holder === uuid) {
        simulator.state.holder = null;
        simulator.addLog(uuid as string, LOG_MSG.LOCK_RELEASED_PAUSED, "info");
      }
      simulator.addLog(uuid as string, pause ? LOG_MSG.SUSPENDED : LOG_MSG.RESUMED, "system");
      return HttpResponse.json({ success: true });
    }
    return HttpResponse.json({ success: false }, { status: 404 });
  }),

  // Priority Control
  http.post('*/api/agents/:uuid/priority', async ({ request, params }) => {
    const { enable } = await request.json() as any;
    const { uuid } = params;
    const targetId = uuid as string;
    if (simulator.agents.has(targetId)) {
      if (enable) {
        if (!simulator.state.priorityAgents.includes(targetId)) {
          simulator.state.priorityAgents = [...simulator.state.priorityAgents, targetId];
          simulator.addLog(targetId, LOG_MSG.PRIORITY_GRANTED, "success");
        }
      } else {
        simulator.state.priorityAgents = simulator.state.priorityAgents.filter(uid => uid !== targetId);
        simulator.addLog(targetId, LOG_MSG.PRIORITY_REVOKED, "warn");
      }
      return HttpResponse.json({ success: true });
    }
    return HttpResponse.json({ success: false }, { status: 404 });
  }),

  // Agent Rename
  http.post('*/api/agents/:uuid/rename', async ({ params, request }) => {
    const { uuid } = params;
    const { newName } = await request.json() as any;
    const targetId = String(uuid);
    const success = simulator.updateAgent(targetId, { displayName: newName });
    if (success) {
      simulator.addLog(targetId, LOG_MSG.CALLSIGN_REV(newName), 'system');
      return HttpResponse.json({ success: true, id: targetId, displayName: newName });
    }
    return HttpResponse.json({ success: false }, { status: 404 });
  }),

  // Get Agent Config
  http.get('*/api/agents/:uuid/config', ({ params }) => {
    const { uuid } = params;
    const agent = simulator.agents.get(uuid as string);
    if (agent) {
      return HttpResponse.json({ 
        success: true, 
        provider: agent.provider, 
        model: agent.model, 
        systemPrompt: agent.systemPrompt 
      });
    }
    return HttpResponse.json({ success: false }, { status: 404 });
  }),

  // Inject Debug Event
  http.post('*/api/mock/inject-event', async ({ request }) => {
    try {
      const { targetId, eventType, severity } = await request.json() as any;
      if (simulator.agents.has(targetId)) {
        simulator.addLog(targetId, `[CONDITION:${eventType}] [RISK_LEVEL:${severity === 'CRITICAL' ? 9 : 5}]`, severity.toLowerCase());
        return HttpResponse.json({ success: true });
      }
      return HttpResponse.json({ success: false }, { status: 404 });
    } catch (e) {
      return HttpResponse.json({ success: false }, { status: 400 });
    }
  }),

  // Global Stop
  http.post('*/api/stop', async ({ request }) => {
    const { enable } = await request.json() as any;
    simulator.state.globalStop = enable;
    simulator.addLog("USER", enable ? LOG_MSG.GLOBAL_STOP : LOG_MSG.GLOBAL_START, "system");
    return HttpResponse.json({ success: true });
  }),

  // Emergency Override
  http.post('*/api/override', () => { 
    simulator.state.overrideSignal = true; 
    simulator.state.holder = 'USER';
    simulator.addLog("USER", LOG_MSG.EMERGENCY_OVERRIDE, "critical");
    return HttpResponse.json({ success: true }); 
  }),

  // Release Override
  http.post('*/api/release', () => { 
    simulator.state.overrideSignal = false; 
    simulator.state.holder = null;
    simulator.addLog("USER", LOG_MSG.OVERRIDE_RELEASED, "info");
    return HttpResponse.json({ success: true }); 
  }),

  // Terminate Agent
  http.delete('*/api/agents/:uuid', ({ params }) => { 
    const { uuid } = params;
    const targetId = String(uuid);
    const agent = simulator.agents.get(targetId);
    
    if (agent) {
      const deletedName = agent.displayName;
      simulator.addLog("SYSTEM", LOG_MSG.TERMINATING(deletedName), "error", deletedName);
      simulator.agents.delete(targetId); 
      simulator.startTimes.delete(targetId);
      lastActiveTimes.delete(targetId);
      
      simulator.state.priorityAgents = simulator.state.priorityAgents.filter(u => u !== targetId);
      if (simulator.state.holder === targetId) simulator.state.holder = null;
      if (simulator.state.forcedCandidate === targetId) simulator.state.forcedCandidate = null;

      simulator.state.activeAgentCount = simulator.agents.size;
      return HttpResponse.json({ success: true });
    }
    return HttpResponse.json({ success: true });
  }),

  // Force Transfer Lock
  http.post('*/api/agents/:uuid/transfer-lock', ({ params }) => { 
    const { uuid } = params;
    const targetId = String(uuid);
    
    simulator.state.forcedCandidate = targetId; 
    simulator.state.holder = null;
    simulator.lockExpiry = Date.now() + SIMULATOR.TRANSFER_DELAY;
    
    simulator.addLog(targetId, LOG_MSG.FORCE_TRANSFER, "system");
    return HttpResponse.json({ success: true }); 
}),

  // Update Priority Order
  http.post('*/api/agents/priority-order', async ({ request }) => {
    const { order } = await request.json() as any;
    simulator.state.priorityAgents = order;
    const names = order.map((id: string) => simulator.agents.get(id)?.displayName || id).join(' > ');
    simulator.addLog('POLICY', LOG_MSG.PRIORITY_UPDATED(names), 'info');
    return HttpResponse.json({ success: true });
  }),

  // Update Agent Config (POST)
  http.post('*/api/agents/:uuid/config', async ({ params, request }) => {
    const body = await request.json() as any;
    const { uuid } = params;
    if (simulator.agents.has(uuid as string)) {
      simulator.updateAgent(uuid as string, body.config);
      simulator.addLog(uuid as string, LOG_MSG.CONFIG_UPDATED, "info");
    }
    return HttpResponse.json({ success: true });
  }),
];
