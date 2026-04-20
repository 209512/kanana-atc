// src/components/common/AgentActionButtons.tsx
import React from 'react';
import clsx from 'clsx';
import { Play, Pause, Trash2, Star, Zap, Edit2 } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { Agent, ATCState } from '@/contexts/atcTypes';
import { useAgentLogic } from '@/hooks/agent/useAgentLogic';

interface AgentActionButtonsProps {
    agent: Agent;
    state: ATCState;
    onTogglePriority: (uuid: string, enable: boolean) => void;
    onTogglePause: (uuid: string, isPaused: boolean) => void; 
    onTerminate: (uuid: string) => void;
    onTransferLock: (uuid: string) => void;
    onStartRename?: (uuid: string) => void;
    layout?: 'row' | 'compact';
    showLabels?: boolean;
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'bottom-left' | 'bottom-right';
}

// AI 제안 시 공통 스타일: 하늘색 글로우 및 맥동 효과
const proposedStyle = "ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.6)] animate-[pulse_1s_infinite] scale-110 z-10";

export const RenameButton = ({ 
    onClick, 
    className, 
    isProposed 
}: { 
    onClick: (e: React.MouseEvent) => void, 
    className?: string,
    isProposed?: boolean 
}) => (
    <Tooltip content={isProposed ? "AI RECOMMEND: Rename" : "Rename Agent"} position="right">
        <button 
            onClick={onClick} 
            className={clsx(
                "p-1 rounded transition-all hover:bg-blue-500/20 text-blue-500 cursor-pointer shrink-0", 
                isProposed && proposedStyle,
                className
            )}
        >
            <Edit2 size={11} className={isProposed ? "animate-bounce" : ""} />
        </button>
    </Tooltip>
);

const getActionButtonClass = (active: boolean, colorClass: string, hoverClass: string, disabled?: boolean, showLabels?: boolean) => 
    clsx(
        "p-1.5 rounded transition-all flex items-center justify-center gap-1",
        active ? colorClass : `text-gray-400 ${hoverClass}`,
        showLabels && "flex-1 text-[10px]",
        disabled ? "opacity-20 cursor-not-allowed grayscale pointer-events-none" : "cursor-pointer"
    );

export const AgentActionButtons = ({
    agent, state, onTogglePriority, onTogglePause, onTerminate, onTransferLock, onStartRename,
    showLabels = false, tooltipPosition = 'bottom', layout
}: AgentActionButtonsProps) => {
    const { isLocked, isPaused, isPriority } = useAgentLogic(agent, state);
    const isGlobalStopped = !!state.globalStop;
    const targetUuid = agent.uuid || agent.id; 
    
    // AI 제안 확인 로직 (Map 구조에서 O(1) 탐색으로 최적화)
    const proposalsMap = state.pendingProposals;
    
    // Map에서 uuid나 displayId를 키로 가진 제안을 찾습니다.
    let myProposal = undefined;
    if (proposalsMap) {
        for (const p of proposalsMap.values()) {
            if (p.targetId === targetUuid || p.targetId === agent.displayId) {
                myProposal = p;
                break;
            }
        }
    }
    
    // 개별 액션 매칭
    const isPauseProposed = myProposal?.action === 'PAUSE';
    const isResumeProposed = myProposal?.action === 'RESUME';
    const isPriorityProposed = myProposal?.action === 'PRIORITY' || myProposal?.action === 'REVOKE';
    const isTransferProposed = myProposal?.action === 'TRANSFER';
    const isTerminateProposed = myProposal?.action === 'TERMINATE';
    const isRenameProposed = myProposal?.action === 'RENAME';

    const isThisAgentTarget = !!myProposal;

    return (
        <div className={clsx(
            "flex items-center gap-1", 
            layout === 'compact' ? "justify-end w-full" : "",
            isThisAgentTarget && "bg-sky-500/10 rounded-lg p-0.5 ring-1 ring-sky-500/20"
        )}>
            {/* Rename Button */}
            {onStartRename && (
                <RenameButton 
                    onClick={(e) => { e.stopPropagation(); onStartRename(targetUuid); }}
                    isProposed={isRenameProposed}
                />
            )}

            {/* Priority Button */}
            <Tooltip content={isPriorityProposed ? "AI RECOMMEND: Priority" : (isPriority ? "Revoke Priority" : "Grant Priority")} position={tooltipPosition}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onTogglePriority(targetUuid, !isPriority); }} 
                    className={clsx(
                      getActionButtonClass(isPriority, "bg-yellow-500/10 text-yellow-500 border border-yellow-500/50", "hover:bg-yellow-400/10", false, showLabels),
                      isPriorityProposed && proposedStyle
                    )}
                >
                    <Star size={12} className={clsx(isPriority && "fill-current")} />
                </button>
            </Tooltip>

            {/* Pause/Resume Button */}
            <Tooltip content={isPauseProposed || isResumeProposed ? "AI RECOMMEND: State Change" : (isPaused ? "Resume" : "Pause")} position={tooltipPosition}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onTogglePause(targetUuid, isPaused); }} 
                    className={clsx(
                      getActionButtonClass(isPaused, "bg-zinc-700 text-zinc-100 border border-zinc-500", "hover:bg-zinc-600", isGlobalStopped, showLabels),
                      (isPauseProposed || isResumeProposed) && proposedStyle
                )}>
                    {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                </button>
            </Tooltip>

            {/* Seize (Transfer) Button */}
            <Tooltip content={isTransferProposed ? "AI RECOMMEND: Force Seize" : "Transfer Lock"} position={tooltipPosition}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onTransferLock(targetUuid); }} 
                    className={clsx(
                      getActionButtonClass(false, "bg-purple-500/10 text-purple-500", "hover:bg-purple-500/20", isGlobalStopped || isLocked || isPaused, showLabels),
                      isTransferProposed && proposedStyle
                )}>
                    <Zap size={12} />
                </button>
            </Tooltip>

            {/* Terminate Button */}
            <Tooltip content={isTerminateProposed ? "AI RECOMMEND: Termination" : "Terminate"} position={tooltipPosition}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onTerminate(targetUuid); }} 
                    className={clsx(
                        getActionButtonClass(false, "", "hover:bg-red-500/20 text-red-500", false, showLabels),
                        isTerminateProposed && "ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse scale-110 z-10 bg-red-500/10"
                    )}>
                    <Trash2 size={12} />
                </button>
            </Tooltip>
        </div>
    );
};