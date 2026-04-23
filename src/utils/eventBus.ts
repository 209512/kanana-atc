import { Agent } from '../contexts/atcTypes';

export type ATCEventMap = {
  'SYSTEM_ACTION': { action: string; pVal: string | null };
  'AGENT_ACTION': { action: string; actualUuid: string; pVal: string | null; agents: Agent[] };
};

type EventCallback<K extends keyof ATCEventMap> = (detail: ATCEventMap[K]) => void;

class ATCEventBus {
  private target = new EventTarget();

  emit<K extends keyof ATCEventMap>(type: K, detail: ATCEventMap[K]) {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on<K extends keyof ATCEventMap>(type: K, listener: EventCallback<K>) {
    const wrapper = (e: Event) => listener((e as CustomEvent).detail);
    this.target.addEventListener(type, wrapper);
    return () => this.target.removeEventListener(type, wrapper);
  }
}

export const atcEventBus = new ATCEventBus();
