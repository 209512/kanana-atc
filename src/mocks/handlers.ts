// src/mocks/handlers.ts
import { http, passthrough, HttpResponse } from 'msw';
import { v4 as uuidv4 } from 'uuid';
import { simulator, CONSTANTS } from './simulator';

const CONFIG = {
  STREAM_INTERVAL: 100,
  BASE_URL: '/api'
};

const createApiRegExp = (path: string) => {
  const cleanPath = path
    .replace(':uuid', '[^/]+')      
    .replace('.+', '[^/]+')         
    .replace(/\/$/, '');            
  return new RegExp(`.*${CONFIG.BASE_URL}/${cleanPath}$`);
};

let isInitialized = false;

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

  // 스트림 핸들러
  http.get(createApiRegExp('stream'), () => {
    isInitialized = true;
    const encoder = new TextEncoder();
    return new HttpResponse(new ReadableStream({
      start(controller) {
        const interval = setInterval(() => {
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
            let color = CONSTANTS.COLOR_DEFAULT;
            if (simulator.state.overrideSignal) { status = 'emergency'; color = CONSTANTS.COLOR_OVERRIDE; }
            else if (isPausedEffective) { status = 'paused'; color = CONSTANTS.COLOR_PAUSED; }
            else if (isLocked) { status = 'active'; color = CONSTANTS.COLOR_LOCKED; }
            else if (isPriority) { status = 'waiting'; color = CONSTANTS.COLOR_PRIORITY; }
            return {
              ...agent,
              status, color, isPaused: !!agent.isPaused, priority: isPriority,
              position: getOrbitPosition(agent.seed, effectiveActiveTime, index, isPausedEffective),
              metrics: { ts: '0.1s', lat: '12ms', tot: '0.5s', load: '15%' }
            };
          });
          const aliveUids = agentList.filter(a => !a.isPaused && !simulator.state.globalStop).map(a => a.uuid);
          const payload = {
            state: { ...simulator.state, activeAgentCount: agentList.length, trafficIntensity: simulator.state.trafficIntensity,
              waitingAgents: aliveUids.filter(id => id !== simulator.state.holder),
              logs: [...simulator.state.logs], timestamp: now }, 
            agents: agents
          };
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch (e) { clearInterval(interval); }
        }, CONFIG.STREAM_INTERVAL);
        return () => clearInterval(interval);
      }
    }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
  }),

  // 에이전트 스케일링
  http.post(createApiRegExp('agents/scale'), async ({ request }) => {
    const { count } = await request.json() as any;
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
      for (let i = 0; i < (currentCount - count); i++) {
        const id = keys[keys.length - 1 - i];
        const agent = simulator.agents.get(id);
        if (agent) simulator.addLog(id, `❌ TERMINATING: [${agent.displayName}]`, "error");
        simulator.agents.delete(id);
        simulator.state.priorityAgents = simulator.state.priorityAgents.filter(uid => uid !== id);
        lastActiveTimes.delete(id);
      }
    }
    simulator.state.trafficIntensity = count;
    simulator.state.activeAgentCount = simulator.agents.size;
    if (isInitialized) simulator.addLog("SYSTEM", `🚀 TRAFFIC_SCALED: ${simulator.agents.size}`, "system");
    return HttpResponse.json({ success: true });
  }),

  // 일시정지 제어
  http.post(createApiRegExp('agents/:uuid/pause'), async ({ request }) => {
    const { pause } = await request.json() as any;
    const urlParts = request.url.split('/');
    const uuid = urlParts[urlParts.length - 2];
    if (simulator.updateAgent(uuid, { isPaused: pause })) {
      if (pause && simulator.state.holder === uuid) {
        simulator.state.holder = null;
        simulator.addLog(uuid, "🔓 Lock Released (Paused)", "info");
      }
      simulator.addLog(uuid, pause ? "⏸️ SUSPENDED" : "▶️ RESUMED", "system");
      return HttpResponse.json({ success: true });
    }
    return HttpResponse.json({ success: false }, { status: 404 });
  }),

  // 우선순위 제어
  http.post(createApiRegExp('agents/:uuid/priority'), async ({ request }) => {
    const { enable } = await request.json() as any;
    const urlParts = request.url.split('/');
    const uuid = urlParts[urlParts.length - 2];
    if (simulator.agents.has(uuid)) {
      if (enable) {
        if (!simulator.state.priorityAgents.includes(uuid)) {
          simulator.state.priorityAgents = [...simulator.state.priorityAgents, uuid];
          simulator.addLog(uuid, "⭐ Priority Granted", "success");
        }
      } else {
        simulator.state.priorityAgents = simulator.state.priorityAgents.filter(uid => uid !== uuid);
        simulator.addLog(uuid, "⭐ Priority Revoked", "warn");
      }
      return HttpResponse.json({ success: true });
    }
    return HttpResponse.json({ success: false }, { status: 404 });
  }),

  // 이름 변경
  http.post(createApiRegExp('agents/:uuid/rename'), async ({ request }) => {
    const { newName } = await request.json() as any;
    const urlParts = request.url.split('/');
    const uuid = urlParts[urlParts.length - 2];
    const agent = simulator.agents.get(uuid);
    if (agent && agent.displayName !== newName) { 
      simulator.updateAgent(uuid, { displayName: newName });
      simulator.addLog(uuid, `📝 CALLSIGN_UPDATE: ${newName}`, 'system');
    }
    return HttpResponse.json({ success: true });
  }),
  
  // 에이전트 설정 (GET)
  http.get(createApiRegExp('agents/:uuid/config'), ({ request }) => {
    const urlParts = request.url.split('/');
    const uuid = urlParts[urlParts.length - 2];
    const agent = simulator.agents.get(uuid);
    return HttpResponse.json({ success: true, provider: 'mock', model: agent?.model || 'kanana-o', systemPrompt: 'You are a professional ATC AI Controller.' });
  }),

  // 글로벌 정지
  http.post(createApiRegExp('stop'), async ({ request }) => {
    const { enable } = await request.json() as any;
    simulator.state.globalStop = enable;
    simulator.addLog("SYSTEM", enable ? "🚨 Global stop Enabled" : "✅ Global stop Disabled", "system");
    return HttpResponse.json({ success: true });
  }),

  // 비상 오버라이드
  http.post(createApiRegExp('override'), () => { 
    simulator.state.overrideSignal = true; 
    simulator.state.holder = 'Human (Admin)';
    simulator.addLog("OPERATOR", "🚨 EMERGENCY OVERRIDE", "critical");
    return HttpResponse.json({ success: true }); 
  }),

  // 오버라이드 해제
  http.post(createApiRegExp('release'), () => { 
    simulator.state.overrideSignal = false; 
    simulator.state.holder = null;
    simulator.addLog("OPERATOR", "✅ OVERRIDE RELEASED", "info");
    return HttpResponse.json({ success: true }); 
  }),

  // 에이전트 제거
  http.delete(createApiRegExp('agents/.+'), ({ request }) => { 
    const uuid = request.url.split('/').pop() || "";
    const agent = simulator.agents.get(uuid);
    if (agent) {
      simulator.addLog(uuid, `❌ TERMINATING: [${agent.displayName}]`, "error");
      simulator.agents.delete(uuid); 
      simulator.state.priorityAgents = simulator.state.priorityAgents.filter(u => u !== uuid);
      lastActiveTimes.delete(uuid);
      const currentSize = simulator.agents.size;
      simulator.state.activeAgentCount = currentSize;
      simulator.state.trafficIntensity = currentSize;
    }
    return HttpResponse.json({ success: true }); 
  }),

  // 강제 할당
  http.post(createApiRegExp('agents/:uuid/transfer-lock'), ({ request }) => { 
    const urlParts = request.url.split('/');
    const uuid = urlParts[urlParts.length - 2];
    simulator.state.forcedCandidate = uuid; 
    simulator.state.holder = null;
    simulator.addLog(uuid, `⚡ FORCE_TRANSFER_INITIATED`, "system");
    return HttpResponse.json({ success: true }); 
  }),
  
  // 우선순위 순서 업데이트
  http.post(createApiRegExp('agents/priority-order'), async ({ request }) => {
    const { order } = await request.json() as any;
    const oldOrder = simulator.state.priorityAgents;
    if (JSON.stringify(oldOrder) === JSON.stringify(order)) return HttpResponse.json({ success: true });
    simulator.state.priorityAgents = order;
    const names = order.map((id: string) => simulator.agents.get(id)?.displayName || id).join(' > ');
    simulator.addLog('POLICY', `📑 Priority Sequence Updated: [ ${names} ]`, 'info');
    return HttpResponse.json({ success: true });
  }),

  // 에이전트 설정 업데이트 (POST)
  http.post(createApiRegExp('agents/:uuid/config'), async ({ request }) => {
    const body = await request.json() as any;
    const urlParts = request.url.split('/');
    const uuid = urlParts[urlParts.length - 2];
    if (simulator.agents.has(uuid)) {
      simulator.updateAgent(uuid, body.config);
      simulator.addLog(uuid, "⚙️ CONFIG_UPDATED", "success");
    }
    return HttpResponse.json({ success: true });
  }),
];