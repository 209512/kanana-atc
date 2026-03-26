// src/components/command/TacticalItem.tsx
import React, { memo } from 'react';
import clsx from 'clsx';
import { useTacticalActions } from '@/hooks/agent/useTacticalActions';
import { useAgentLogic } from '@/hooks/agent/useAgentLogic';
import { AgentStatusBadge } from '@/components/common/AgentStatusBadge';
import { AgentActionButtons } from '@/components/common/AgentActionButtons';
import { AgentIdentity } from '@/components/agent/AgentIdentity';
import { getAgentCardStyle } from '@/utils/agentStyles';

interface Props {
    agent: any;
}

export const TacticalItem = memo(({ agent }: Props) => {
    const { 
        isDark, state, renamingId, newName, setNewName, 
        handleStartRename, handleCancelRename, handleConfirmRename,
        onTransferLock, togglePriority, onTogglePause, terminateAgent 
    } = useTacticalActions();

    const { isLocked, isPaused, isForced, isPriority, isOverride } = useAgentLogic(agent, state);

    return (
        <div className={clsx(
            getAgentCardStyle({
                isForced, 
                isLocked, 
                isPaused, 
                isPriority, 
                isSelected: false, 
                isDark, 
                overrideSignal: isOverride, 
                globalStop: !!state.globalStop
            }),
            "p-2 group relative transition-all duration-200 border rounded-sm mb-1 overflow-hidden",
            isLocked && "ring-1 ring-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
        )}>
            {isOverride && (
                <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10 animate-pulse" />
            )}

            <div className="flex justify-between items-center mb-1.5 gap-2 h-7">
                <AgentIdentity 
                    agent={agent} state={state} isDark={isDark}
                    isRenaming={renamingId === agent.id}
                    newName={newName} setNewName={setNewName}
                    onStartRename={() => handleStartRename(agent.id)}
                    onConfirm={handleConfirmRename} onCancel={handleCancelRename}
                />

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex shrink-0">
                    <AgentActionButtons 
                        agent={agent} state={state}
                        onTogglePriority={togglePriority}
                        onTogglePause={onTogglePause}
                        onTerminate={terminateAgent}
                        onTransferLock={onTransferLock}
                        tooltipPosition="left"
                    />
                </div>
            </div>
            
            <div className="flex justify-between items-center text-[10px] opacity-70 gap-2 h-4">
                <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
                    <AgentStatusBadge isLocked={isLocked} isPaused={isPaused} isForced={isForced} isPriority={isPriority} />
                    <span className={clsx(
                        "truncate font-mono leading-none pt-[1px] tracking-tight",
                        isLocked ? "text-emerald-500 font-bold" : "text-gray-400"
                    )}>
                        {isPaused ? "HALTED" : (agent.activity || "Standby")}
                    </span>
                </div>
                <span className={clsx("px-1 rounded shrink-0 font-mono text-[9px] max-w-[85px] truncate py-0.5 border border-transparent", 
                    isDark ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-600")}>
                    {agent.model}
                </span>
            </div>
        </div>
    );
}, (prev, next) => {
    return (
        prev.agent.id === next.agent.id &&
        prev.agent.status === next.agent.status &&
        prev.agent.activity === next.agent.activity &&
        prev.agent.priority === next.agent.priority &&
        prev.agent.displayId === next.agent.displayId &&
        (prev as any).state?.holder === (next as any).state?.holder &&
        (prev as any).state?.globalStop === (next as any).state?.globalStop &&
        (prev as any).state?.forcedCandidate === (next as any).state?.forcedCandidate
    );
});