// src/store/slices/createActionSlice.ts
import { StateCreator } from 'zustand';
import { ATCStore, ActionSlice } from './types';
import { ATC_CONFIG } from '@/constants/atcConfig';

export const createActionSlice: StateCreator<
  ATCStore,
  [],
  [],
  ActionSlice
> = (set, get) => ({
  deletedIds: new Set<string>(),
  fieldLocks: new Map<string, Map<string, { value: unknown, expiry: number }>>(),

  isAdminMuted: false,
  setIsAdminMuted: (muted) => set((s) => ({ isAdminMuted: typeof muted === 'function' ? muted(s.isAdminMuted) : muted })),
  toggleAdminMute: () => set((s) => ({ isAdminMuted: !s.isAdminMuted })),
  
  handoverTarget: null,
  triggerHandover: (reason) => {
    const agents = get().agents;
    const topEmergency = [...agents].sort((a, b) => 
      parseFloat(String(b.metrics?.load || '0')) - parseFloat(String(a.metrics?.load || '0'))
    )[0];
    
    get().addLog(ATC_CONFIG.LOG_MSG.HANDOVER(reason), "critical", "SYSTEM");
    set((s) => ({ 
      isAiAutoMode: false, 
      state: { ...s.state, handoverTarget: topEmergency?.uuid || 'SYSTEM' }
    }));
  },
  
  resetHandover: () => {
    set((s) => ({ isAiAutoMode: false, state: { ...s.state, handoverTarget: null } }));
    get().addLog(ATC_CONFIG.LOG_MSG.RECOVERY_COMPLETE, "success", "USER");
  },

  updatePriorityOrder: (order: string[]) => set((s) => ({ 
    state: { ...s.state, priorityAgents: order }
  })),

  markAction: (uuid, field, value, isDelete = false) => {
    const targetId = uuid ? String(uuid) : 'SYSTEM_GLOBAL';
    
    set((s) => {
      // 새로운 Set과 Map을 생성하여 불변성을 유지하고 React 리렌더링을 트리거합니다.
      const newDeletedIds = new Set(s.deletedIds);
      const newFieldLocks = new Map(s.fieldLocks);
      
      if (isDelete) {
        newDeletedIds.add(targetId);
      } else if (field) {
        const targetLocks = new Map(newFieldLocks.get(targetId) || new Map());
        targetLocks.set(field, { value, expiry: Date.now() + 5000 });
        newFieldLocks.set(targetId, targetLocks);
      }

      if (uuid === '') {
        // Global state update
        return { 
          deletedIds: newDeletedIds,
          fieldLocks: newFieldLocks,
          state: { ...s.state, [field]: value } 
        };
      } else {
        // Agent specific update
        const newAgents = s.agents.map(agent => {
          if (agent.uuid === uuid || agent.id === uuid) {
            if (isDelete) return { ...agent, isDeleting: true };
            return { ...agent, [field]: value };
          }
          return agent;
        });
        return { 
          deletedIds: newDeletedIds,
          fieldLocks: newFieldLocks,
          agents: newAgents 
        };
      }
    });
  },

  updateAgentConfigLocal: (uuid, config) => {
    const agent = get().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
    const actualUuid = agent?.uuid || uuid;
    set((s) => ({ agents: s.agents.map(a => a.uuid === actualUuid ? { ...a, ...config } : a) }));
  },

  playAlert: () => {},
  playSuccess: () => {},
  playClick: () => {},
  recordAction: () => {},
});
