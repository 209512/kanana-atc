// src/components/common/AIControlGroup.tsx
import React from 'react';
import clsx from 'clsx';
import { Brain, Bot } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';

interface AIControlGroupProps {
    variant?: 'sidebar' | 'tactical';
    isCompact?: boolean;
}

export const AIControlGroup = ({ variant = 'tactical', isCompact = false }: AIControlGroupProps) => {
    const isAiMode = useATCStore(s => s.isAiMode);
    const toggleAiMode = useATCStore(s => s.toggleAiMode);
    const isAiAutoMode = useATCStore(s => s.isAiAutoMode);
    const toggleAiAutoMode = useATCStore(s => s.toggleAiAutoMode);
    const playClick = useATCStore(s => s.playClick);
    const isDark = useUIStore(s => s.isDark);
    const openKananaKeyModal = useUIStore(s => s.openKananaKeyModal);

    const handleModeToggle = () => {
        playClick?.();
        if (!isAiMode) {
            const kananaKey = sessionStorage.getItem('KANANA_API_KEY') || localStorage.getItem('KANANA_API_KEY');
            if (!kananaKey) {
                openKananaKeyModal();
                return;
            }
        }
        toggleAiMode(!isAiMode); 
    };

    const handleToggleAutoMode = () => {
        if (!isAiMode) {
            const kananaKey = sessionStorage.getItem('KANANA_API_KEY') || localStorage.getItem('KANANA_API_KEY');
            if (!kananaKey) {
                openKananaKeyModal();
                return;
            }
            toggleAiMode(true);
        }
        toggleAiAutoMode();
    };

    const isSidebar = variant === 'sidebar';

    if (isCompact) {
        return (
        <div className="flex flex-col gap-3">
            <Tooltip content={isAiMode ? "AI Link ON" : "AI Link OFF"} position="left">
                <button 
                    onClick={handleModeToggle}
                    className={clsx(
                        "p-2 rounded-lg transition-colors",
                        isAiMode 
                            ? (isDark ? "text-blue-400 bg-blue-500/10" : "text-blue-600 bg-blue-50")
                            : (isDark ? "text-gray-500 hover:bg-gray-800 hover:text-gray-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")
                    )}
                >
                    <Brain size={16} />
                </button>
            </Tooltip>

            {isAiMode && (
                <Tooltip content={isAiAutoMode ? "AI Auto ON" : "AI Auto OFF"} position="left">
                    <button 
                        onClick={handleToggleAutoMode}
                        className={clsx(
                            "p-2 rounded-lg transition-colors relative",
                            isAiAutoMode 
                                ? (isDark ? "text-amber-400 bg-amber-500/10" : "text-amber-600 bg-amber-50")
                                : (isDark ? "text-gray-500 hover:bg-gray-800 hover:text-gray-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")
                        )}
                    >
                        <Bot size={16} />
                        {isAiAutoMode && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                        )}
                    </button>
                </Tooltip>
            )}
        </div>
        );
    }

    const buttons = (
        <>
            <Tooltip content="AI Link" position="bottom" className="flex-1">
                <button 
                    data-testid="btn-ai-link"
                    onClick={handleModeToggle}
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
                <button onClick={handleToggleAutoMode} disabled={!isAiMode}
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
