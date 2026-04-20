// src/hooks/ai/useAgentMutations.ts
import { useMutation } from '@tanstack/react-query';
import { atcApi } from '@/contexts/atcApi';
import { useATCStore } from '@/store/useATCStore';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { queryKeys } from '@/constants/queryKeys';

export const useAgentMutations = () => {
  const togglePause = useMutation({
    mutationKey: queryKeys.mutations.togglePause(),
    mutationFn: async (uuid: string) => {
      const agent = useATCStore.getState().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      if (!agent) throw new Error('Agent not found');
      await atcApi.togglePause(agent.uuid, agent.isPaused);
    },
    onMutate: async (uuid) => {
      const store = useATCStore.getState();
      const agent = store.agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      if (!agent) return;
      const actualUuid = agent.uuid;
      const newVal = !agent.isPaused;
      
      store.playClick();
      store.markAction(actualUuid, 'isPaused', newVal);
      return { actualUuid, previousValue: agent.isPaused };
    },
    onError: (err, uuid, context) => {
      logger.error('[MUTATION] togglePause Error:', err);
      const store = useATCStore.getState();
      store.playAlert();
      if (context?.actualUuid) {
        store.markAction(context.actualUuid, 'isPaused', context.previousValue);
      }
      toast.error('Failed to change agent state.');
    }
  });

  const togglePriority = useMutation({
    mutationKey: queryKeys.mutations.togglePriority(),
    mutationFn: async (uuid: string) => {
      const agent = useATCStore.getState().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      if (!agent) throw new Error('Agent not found');
      await atcApi.togglePriority(agent.uuid, agent.priority);
    },
    onMutate: async (uuid) => {
      const store = useATCStore.getState();
      const agent = store.agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      if (!agent) return;
      const actualUuid = agent.uuid;
      const newVal = !agent.priority;
      
      if (newVal) store.playSuccess(); else store.playClick();
      store.markAction(actualUuid, 'priority', newVal);
      
      const currentOrder = store.state.priorityAgents || [];
      const newOrder = newVal 
        ? [...currentOrder, actualUuid] 
        : currentOrder.filter(id => id !== actualUuid);
      store.markAction('', 'priorityAgents', newOrder);

      return { actualUuid, previousValue: agent.priority, previousOrder: currentOrder };
    },
    onError: (err, uuid, context) => {
      logger.error('[MUTATION] togglePriority Error:', err);
      const store = useATCStore.getState();
      store.playAlert();
      if (context?.actualUuid) {
        store.markAction(context.actualUuid, 'priority', context.previousValue);
        store.markAction('', 'priorityAgents', context.previousOrder);
      }
      toast.error('Failed to change priority.');
    }
  });

  const transferLock = useMutation({
    mutationKey: queryKeys.mutations.transferLock(),
    mutationFn: async (uuid: string) => {
      const agent = useATCStore.getState().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      await atcApi.transferLock(actualUuid);
    },
    onMutate: async (uuid) => {
      const store = useATCStore.getState();
      const agent = store.agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      
      store.playAlert();
      // 낙관적 업데이트: 바로 대상 에이전트를 강제 할당 후보로 지정
      store.markAction('', 'forcedCandidate', actualUuid);
      // holder는 null로 덮어씌우지 않고, 서버가 1초 뒤에 변경하도록 둡니다 (락 충돌 방지)
      return { actualUuid };
    },
    onError: (err, uuid, context) => {
      logger.error('[MUTATION] transferLock Error:', err);
      const store = useATCStore.getState();
      store.playAlert();
      store.markAction('', 'forcedCandidate', null);
      toast.error('Failed to acquire manual control.');
    }
  });

  const terminateAgent = useMutation({
    mutationKey: queryKeys.mutations.terminateAgent(),
    mutationFn: async (uuid: string) => {
      const agent = useATCStore.getState().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      await atcApi.terminateAgent(actualUuid);
    },
    onMutate: async (uuid) => {
      const store = useATCStore.getState();
      const agents = store.agents;
      if (agents.length <= 1) {
        store.playAlert();
        throw new Error('Cannot terminate last agent');
      }
      store.playClick();
      const agent = agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      
      store.markAction(actualUuid, '', null, true);
      return { actualUuid, originalCount: agents.length };
    },
    onSuccess: (data, uuid, context) => {
      if (context?.originalCount) {
        useATCStore.getState().setTrafficIntensityLocal(Math.max(0, context.originalCount - 1));
      }
    },
    onError: (err, uuid, context) => {
      if (err.message === 'Cannot terminate last agent') return;
      logger.error('[MUTATION] terminateAgent Error:', err);
      const store = useATCStore.getState();
      store.playAlert();
      if (context?.actualUuid) {
        store.markAction(context.actualUuid, '', null, false);
      }
      toast.error('Failed to terminate agent.');
    }
  });

  const toggleGlobalStop = useMutation({
    mutationKey: queryKeys.mutations.toggleGlobalStop(),
    mutationFn: async () => {
      const newVal = useATCStore.getState().state.globalStop;
      await atcApi.toggleGlobalStop(newVal);
    },
    onMutate: async () => {
      const store = useATCStore.getState();
      store.playAlert();
      const newVal = !store.state.globalStop;
      store.markAction('', 'globalStop', newVal);
      return { previousValue: !newVal };
    },
    onError: (err, variables, context) => {
      logger.error('[MUTATION] toggleGlobalStop Error:', err);
      const store = useATCStore.getState();
      store.markAction('', 'globalStop', context?.previousValue ?? false);
      toast.error('System control failed. Please try again.');
    }
  });

  const triggerOverride = useMutation({
    mutationKey: queryKeys.mutations.triggerOverride(),
    mutationFn: async () => {
      await atcApi.triggerOverride();
    },
    onMutate: async () => {
      const store = useATCStore.getState();
      store.playAlert();
      store.markAction('', 'overrideSignal', true);
      store.markAction('', 'holder', 'USER');
    },
    onError: (err) => {
      logger.error('[MUTATION] triggerOverride Error:', err);
      const store = useATCStore.getState();
      store.markAction('', 'overrideSignal', false);
      store.markAction('', 'holder', null);
      toast.error('Failed to send override command.');
    }
  });

  const releaseLock = useMutation({
    mutationKey: queryKeys.mutations.releaseLock(),
    mutationFn: async () => {
      await atcApi.releaseLock();
    },
    onMutate: async () => {
      const store = useATCStore.getState();
      store.playSuccess();
      store.markAction('', 'overrideSignal', false);
      store.markAction('', 'holder', null);
    },
    onError: (err) => {
      logger.error('[MUTATION] releaseLock Error:', err);
      const store = useATCStore.getState();
      store.markAction('', 'overrideSignal', true);
      store.markAction('', 'holder', 'USER');
      toast.error('Failed to release control.');
    }
  });

  const updatePriorityOrder = useMutation({
    mutationKey: queryKeys.mutations.updatePriorityOrder(),
    mutationFn: async (newOrder: string[]) => {
      await atcApi.updatePriorityOrder(newOrder);
    },
    onMutate: async (newOrder) => {
      const store = useATCStore.getState();
      store.markAction('', 'priorityAgents', newOrder);
    },
    onError: (err) => {
      logger.error('[MUTATION] updatePriorityOrder Error:', err);
      toast.error('Failed to update priority queue.');
    }
  });

  const renameAgent = useMutation({
    mutationKey: queryKeys.mutations.renameAgent(),
    mutationFn: async ({ uuid, newName }: { uuid: string; newName: string }) => {
      const agent = useATCStore.getState().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      await atcApi.renameAgent(actualUuid, newName);
    },
    onMutate: async ({ uuid, newName }) => {
      const store = useATCStore.getState();
      const agent = store.agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      const previousName = agent?.displayName || null;
      store.markAction(actualUuid, 'displayName', newName);
      return { actualUuid, previousName };
    },
    onSuccess: () => {
      useATCStore.getState().playSuccess();
    },
    onError: (err, variables, context) => {
      logger.error('[MUTATION] renameAgent Error:', err);
      const store = useATCStore.getState();
      store.playAlert();
      if (context?.actualUuid) {
        store.markAction(context.actualUuid, 'displayName', context.previousName);
      }
      toast.error('Failed to rename agent.');
    }
  });

  const updateAgentConfig = useMutation({
    mutationKey: queryKeys.mutations.updateAgentConfig(),
    mutationFn: async ({ uuid, config }: { uuid: string; config: Record<string, unknown> }) => {
      const agent = useATCStore.getState().agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      await atcApi.updateConfig(actualUuid, config);
    },
    onMutate: async ({ uuid, config }) => {
      const store = useATCStore.getState();
      const agent = store.agents.find(a => a.uuid === uuid || a.id === uuid || a.displayName === uuid);
      const actualUuid = agent?.uuid || uuid;
      store.updateAgentConfigLocal(actualUuid, config);
      return { actualUuid };
    },
    onSuccess: () => {
      useATCStore.getState().playSuccess();
    },
    onError: (err) => {
      logger.error('[MUTATION] updateAgentConfig Error:', err);
      useATCStore.getState().playAlert();
      toast.error('Failed to save settings.');
    }
  });

  const scaleAgents = useMutation({
    mutationKey: queryKeys.mutations.scaleAgents(),
    mutationFn: async (val: number) => {
      const res = await atcApi.scaleAgents(val);
      if (!res || !res.success) throw new Error("Scale failed");
    },
    onMutate: async (val) => {
      const store = useATCStore.getState();
      const previousIntensity = store.state.trafficIntensity;
      if (previousIntensity !== val) {
        store.setTrafficIntensityLocal(val);
      }
      return { previousIntensity };
    },
    onError: (err, val, context) => {
      logger.error('[MUTATION] scaleAgents Error:', err);
      if (context?.previousIntensity !== undefined) {
        useATCStore.getState().setTrafficIntensityLocal(context.previousIntensity);
      }
    }
  });

  return {
    togglePause,
    togglePriority,
    transferLock,
    terminateAgent,
    toggleGlobalStop,
    triggerOverride,
    releaseLock,
    updatePriorityOrder,
    renameAgent,
    updateAgentConfig,
    scaleAgents
  };
};
