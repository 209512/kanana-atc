import { useState, useCallback } from 'react';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { Agent } from '@/contexts/atcTypes';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';

export const useTacticalActions = () => {
    const agents = useATCStore(s => s.agents);
    const state = useATCStore(s => s.state);
    const playClick = useATCStore(s => s.playClick);
    const playAlert = useATCStore(s => s.playAlert);
    
    const { 
        togglePause, 
        togglePriority, 
        transferLock, 
        terminateAgent, 
        toggleGlobalStop, 
        renameAgent,
        updatePriorityOrder
    } = useAgentMutations();
    
    const isDark = useUIStore(s => s.isDark);
    const sidebarWidth = useUIStore(s => s.sidebarWidth);
    const areTooltipsEnabled = useUIStore(s => s.areTooltipsEnabled);
    
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const globalStop = !!state?.globalStop;

    const handleStartRename = useCallback((agentId: string) => {
        if (playClick) playClick();
        setRenamingId(agentId);
        const target = agents.find((a: Agent) => String(a.uuid || a.id) === String(agentId));
        setNewName(target?.displayId || agentId);
    }, [agents, playClick]);

    const handleCancelRename = useCallback(() => {
        if (playClick) playClick();
        setRenamingId(null);
        setNewName('');
    }, [playClick]);

    const handleConfirmRename = useCallback((id: string) => {
        const trimmedName = newName.trim();
        if (!trimmedName) return handleCancelRename();
        
        renameAgent.mutate({ uuid: id, newName: trimmedName }, {
            onSuccess: () => {
                setRenamingId(null);
                setNewName('');
            }
        });
    }, [newName, renameAgent, handleCancelRename]);
        
    const onTogglePriority = useCallback((id: string) => {
        togglePriority.mutate(id);
    }, [togglePriority]);

    const onTogglePause = useCallback((agentId: string) => {
        togglePause.mutate(agentId);
    }, [togglePause]);

    const handleTerminate = useCallback((id: string) => {
        terminateAgent.mutate(id);
    }, [terminateAgent]);

    const onTransferLock = useCallback((id: string) => {
        transferLock.mutate(id);
    }, [transferLock]);

    const handleToggleGlobalStop = useCallback(() => {
        toggleGlobalStop.mutate();
    }, [toggleGlobalStop]);

    const handleUpdatePriorityOrder = useCallback((order: string[]) => {
        updatePriorityOrder.mutate(order);
    }, [updatePriorityOrder]);

    return {
        agents, 
        state, 
        isDark, 
        sidebarWidth, 
        areTooltipsEnabled,
        renamingId, newName, setNewName, globalStop,
        handleStartRename, handleCancelRename, handleConfirmRename,
        toggleGlobalStop: handleToggleGlobalStop, 
        onTogglePause, 
        terminateAgent: handleTerminate, 
        togglePriority: onTogglePriority, 
        onTransferLock, 
        submitRename: (id: string, name: string) => renameAgent.mutate({ uuid: id, newName: name }),
        updatePriorityOrder: handleUpdatePriorityOrder,
        playAlert 
    };
};