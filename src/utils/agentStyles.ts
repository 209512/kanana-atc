// src/utils/agentStyles.ts
import clsx from 'clsx';

interface AgentCardStyleProps {
    isForced: boolean;
    isLocked: boolean;
    isPaused: boolean;
    isPriority: boolean;
    isSelected: boolean;
    isDark: boolean;
    overrideSignal?: boolean;
    globalStop?: boolean;
    isAiProposed?: boolean;
}

export const getAgentCardStyle = ({
    isForced,
    isLocked,
    isPaused,
    isPriority,
    isSelected,
    isDark,
    overrideSignal,
    globalStop,
    isAiProposed
}: AgentCardStyleProps) => {
    const base = "rounded border transition-all relative overflow-hidden group";
    const effectivelyPaused = isPaused || globalStop;
    
    // 1. AI 제안 상태
    if (isAiProposed) {
        return clsx(
            base, 
            "border-sky-400 bg-sky-400/10 shadow-[0_0_20px_rgba(56,189,248,0.4)] z-50 scale-[1.02]",
            "animate-[pulse_2s_infinite]"
        );
    }

    // 2. 비상 상황
    if (overrideSignal) {
        return clsx(base, "bg-red-950/60 border-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)] z-30");
    }

    // 3. 강제 할당 시도
    if (isForced) {
        return clsx(base, "ring-2 ring-purple-500 animate-pulse bg-purple-500/10 z-20");
    }

    // 4. 제어권 소유자 (Locked)
    if (isLocked) {
        return clsx(base, isDark ? "bg-emerald-500/15 border-emerald-500" : "bg-emerald-50 border-emerald-400 shadow-sm");
    }

    // 5. 일시정지
    if (effectivelyPaused) {
        return clsx(
            base, 
            isDark 
                ? "bg-zinc-900/80 border-zinc-700 opacity-60" 
                : "bg-zinc-200/50 border-zinc-300 opacity-70 shadow-inner",
            "grayscale"
        );
    }
    
    // 6. 우선순위
    if (isPriority) {
        return clsx(
            base, 
            isDark 
                ? "bg-yellow-500/5 border-yellow-500/30" 
                : "bg-amber-100/50 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
        );
    }

    // 7. 선택됨
    if (isSelected) {
        return clsx(base, isDark ? "bg-blue-900/20 border-blue-500" : "bg-blue-50 border-blue-400");
    }
    
    // 기본 상태 (Idle)
    return clsx(base, isDark ? "bg-gray-800/30 border-gray-800" : "bg-white border-slate-200");
};

interface AgentTextStyleProps {
    isForced: boolean;
    isLocked: boolean;
    isDark: boolean;
    overrideSignal?: boolean;
}

export const getAgentTextStyle = ({
    isForced,
    isLocked,
    isDark,
    overrideSignal
}: AgentTextStyleProps) => {
    return clsx(
        "font-mono text-xs font-bold truncate transition-colors",
        overrideSignal ? "text-red-400" : 
        isForced ? "text-purple-400" : 
        isLocked ? "text-emerald-400" : 
        (isDark ? "text-gray-300" : "text-slate-700")
    );
};