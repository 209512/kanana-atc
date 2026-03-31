// src/components/common/AgentStatusBadge.tsx
import React from 'react';
import clsx from 'clsx';
import { Star, Zap, Pause, Activity } from 'lucide-react';
import { LOG_LEVELS } from '@/utils/logStyles';

interface AgentStatusBadgeProps {
    isLocked: boolean;
    isPaused: boolean;
    isForced: boolean;
    isPriority: boolean;
    isAiProposed?: boolean;
    className?: string;
}

export const AgentStatusBadge = ({ 
    isLocked, isPaused, isForced, isPriority, isAiProposed, className 
}: AgentStatusBadgeProps) => {
    return (
        <div className={clsx("flex items-center gap-1", className)}>
            {/* AI 지목 상태: 최좌측에 배치하여 즉각 인지 */}
            {isAiProposed && (
                <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full bg-sky-500 text-white font-black animate-[bounce_1s_infinite] shadow-[0_0_8px_rgba(14,165,233,0.5)] shrink-0">
                    <Zap size={8} className="fill-current" /> AI_TARGET
                </span>
            )}

            {/* 우선순위 별표 */}
            {isPriority && (
                <Star 
                    size={11} 
                    className="animate-pulse shrink-0" 
                    style={{ color: LOG_LEVELS.warn.color, fill: LOG_LEVELS.warn.color }} 
                />
            )}
            
            {/* 상태 텍스트 배지들 */}
            {isPaused ? (
                <span className="flex items-center gap-1 text-[9px] px-1 rounded border shrink-0" 
                    style={{ color: LOG_LEVELS.system.color, borderColor: LOG_LEVELS.system.color + '40', backgroundColor: LOG_LEVELS.system.color + '1A' }}>
                    <Pause size={8} /> STOPPED
                </span>
            ) : isLocked ? (
                <span className="flex items-center gap-1 text-[9px] px-1 rounded border animate-pulse font-bold shrink-0" 
                    style={{ color: LOG_LEVELS.success.color, borderColor: LOG_LEVELS.success.color + '40', backgroundColor: LOG_LEVELS.success.color + '1A' }}>
                    <Activity size={8} /> LIVE_LOCK
                </span>
            ) : isForced ? (
                <span className="flex items-center gap-1 text-[9px] px-1 rounded border animate-pulse font-bold shrink-0" 
                    style={{ color: LOG_LEVELS.system.color, borderColor: LOG_LEVELS.system.color + '40', backgroundColor: LOG_LEVELS.system.color + '1A' }}>
                    <Zap size={8} className="fill-current" /> SEIZING
                </span>
            ) : null}
        </div>
    );
};