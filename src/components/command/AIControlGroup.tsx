// src/components/command/AIControlGroup.tsx
import React, { useState } from 'react';
import clsx from 'clsx';
import { Brain, Bot } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';

interface AIControlGroupProps {
    variant?: 'sidebar' | 'tactical';
}

export const AIControlGroup = ({ variant = 'tactical' }: AIControlGroupProps) => {
    const { isAiMode, toggleAiMode, isAiAutoMode, toggleAiAutoMode, playClick } = useATC();
    const { isDark } = useUI();

    const handleModeToggle = () => {
        playClick?.();
        toggleAiMode(!isAiMode); 
    };

    const isSidebar = variant === 'sidebar';

    const buttons = (
        <>
            <Tooltip content="AI Link" position="bottom" className="flex-1">
                <button onClick={handleModeToggle}
                    className={clsx(
                        "w-full h-full rounded-lg flex flex-col items-center justify-center border outline-none transition-all duration-300",
                        isAiMode 
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]" 
                            : isDark 
                                ? "bg-zinc-800/50 border-white/5 text-zinc-500 hover:text-zinc-300" 
                                : "bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
                    )}>
                    <Brain size={14} className={isAiMode ? "animate-pulse" : ""} />
                    <span className="text-[7px] font-black uppercase mt-1">AI Link</span>
                </button>
            </Tooltip>

            <Tooltip content="Auto Pilot" position="bottom" className="flex-1">
                <button onClick={toggleAiAutoMode} disabled={!isAiMode}
                    className={clsx(
                        "w-full h-full rounded-lg flex flex-col items-center justify-center border outline-none transition-all duration-300",
                        isAiAutoMode 
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                            : isDark 
                                ? "bg-zinc-800/50 border-white/5 text-zinc-500" 
                                : "bg-slate-100 border-slate-200 text-slate-400",
                        !isAiMode && "opacity-50 cursor-not-allowed"
                    )}>
                    <Bot size={14} />
                    <span className="text-[7px] font-black uppercase mt-1">AI Auto</span>
                </button>
            </Tooltip>
        </>
    );
    return isSidebar ? <div className="flex-1 h-[60px] flex gap-1">{buttons}</div> : buttons;
};