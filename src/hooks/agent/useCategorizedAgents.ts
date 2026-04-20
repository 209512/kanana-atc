// src/hooks/agent/useCategorizedAgents.ts
import { useMemo } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { Agent } from '@/contexts/atcTypes';

export const useCategorizedAgents = () => {
    const rawAgents = useATCStore(s => s.agents);
    const state = useATCStore(s => s.state);

    const agents = useMemo(() => rawAgents || [], [rawAgents]);

    return useMemo(() => {
        const priorityIds = state?.priorityAgents || [];

        const priorityAgents = priorityIds
            .map((id: string) => agents.find((a: Agent) => a.id === id || a.uuid === id))
            .filter((a): a is Agent => !!a) || [];
        
        const queueAgents = agents.filter((a: Agent) => !priorityIds.includes(a.id) && !priorityIds.includes(a.uuid)) || [];

        const sortedNormalAgents = [...queueAgents].sort((a: Agent, b: Agent) => 
            (a.displayId || a.id).localeCompare((b.displayId || b.id), undefined, { 
                numeric: true, 
                sensitivity: 'base' 
            })) || [];
            
        return {
            priorityAgents,
            normalAgents: sortedNormalAgents,
            queueAgents,
            masterAgent: agents.find((a: Agent) => a.id === state?.holder) || null,
            priorityIds
        };
    }, [agents, state?.priorityAgents, state?.holder]);
};