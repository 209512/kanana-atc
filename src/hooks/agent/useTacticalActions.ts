// src/hooks/agent/useTacticalActions.ts
import { useState, useCallback } from 'react';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { Agent } from '@/contexts/atcTypes'; 

export const useTacticalActions = () => {
    const { 
        agents, state, togglePause, 
        renameAgent: submitRename,
        terminateAgent: apiTerminate, 
        togglePriority: apiTogglePriority, transferLock, 
        playClick, playAlert, toggleGlobalStop: apiToggleGlobalStop
    } = useATC();
    
    const { isDark, sidebarWidth, areTooltipsEnabled } = useUI();
    
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

    const handleConfirmRename = useCallback(async (id: string) => {
        const trimmedName = newName.trim();
        const invalidPattern = /[^a-zA-Z0-9\-_\.]/;

        if (invalidPattern.test(trimmedName)) {
            if (playAlert) playAlert();
            return;
        }

        const targetAgent = agents.find((a: Agent) => String(a.uuid || a.id) === String(id));
        if (!trimmedName || trimmedName === (targetAgent?.displayId || id)) {
            return handleCancelRename();
        }
        
        try {
            await submitRename(id, trimmedName);
            setRenamingId(null);
            setNewName('');
        } catch (err) {
            if (playAlert) playAlert();
        }
    }, [newName, agents, submitRename, playAlert, handleCancelRename]);
        
    const togglePriority = useCallback((id: string) => {
        apiTogglePriority(id);
    }, [apiTogglePriority]);

    const onTogglePause = useCallback((agentId: string) => {
        togglePause(agentId);
    }, [togglePause]);

    const handleTerminate = useCallback((id: string) => {
        apiTerminate(id);
    }, [apiTerminate]);

    const onTransferLock = useCallback((id: string) => {
        transferLock(id);
    }, [transferLock]);

    const handleToggleGlobalStop = useCallback(() => {
        apiToggleGlobalStop();
    }, [apiToggleGlobalStop]);

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
        togglePriority, 
        onTransferLock, 
        submitRename,
        playAlert 
    };
};