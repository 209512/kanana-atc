// src/components/sidebar/SidebarControlPanel.tsx
import React from 'react';
import clsx from 'clsx';
import { VolumeX, Speaker, Unlock, Lock, Brain, Database, Info } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { LOG_LEVELS } from '@/utils/logStyles';

export const SidebarControlPanel = () => {
    const { state, isAiMode, toggleAiMode, triggerOverride, releaseLock, isAdminMuted, toggleAdminMute, addLog, playClick } = useATC();
    const { isDark } = useUI();
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const [isOverrideLoading, setIsOverrideLoading] = React.useState(false);
    const isHuman = (state.holder && state.holder.includes('Human')) || state.overrideSignal;
    const handleOverride = async () => {
        if (isOverrideLoading || isHuman) return;

        setIsOverrideLoading(true);
        try {
            await triggerOverride();
        } catch (e) {
            console.error("Override Failed", e);
        } finally {
            setIsOverrideLoading(false);
        }
    };

    const handleRelease = async () => {
        try {
            await releaseLock();
        } catch (e) {
            console.error("Release Failed", e);
        }
    };

    const handleMuteToggle = () => {
        playClick?.();
        toggleAdminMute();
    };

    const handleModeToggle = async () => {
        const nextMode = !isAiMode;
        playClick?.();

        setIsAnalyzing(true);
        try {
            await toggleAiMode(nextMode); 
        } catch (err) {
            console.error("AI Mode Toggle Failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className={clsx(
            "p-2.5 border-b z-20 relative shrink-0 grid grid-cols-[auto_auto_1fr] gap-1 h-20 items-center min-w-0",
            isDark ? "border-gray-800 bg-gray-900/50" : "border-slate-200 bg-slate-50/50"
        )}>
            {/* AI MODE TOGGLE */}
            <div className="flex flex-col gap-1">
                <Tooltip 
                    content={isAiMode ? "Switch to Simulation" : "Connect to Kanana-o"} 
                    position="bottom"
                >
                    <button 
                        onClick={handleModeToggle}
                        className={clsx(
                            "h-[60px] w-14 rounded flex flex-col items-center justify-center gap-1 transition-all border group",
                            isAiMode 
                                ? "bg-blue-500/10 text-blue-400"
                                : (isDark ? "bg-gray-800 border-gray-700 text-gray-500" : "bg-white border-slate-300 text-slate-400")
                        )}
                        style={{ borderColor: isAiMode ? LOG_LEVELS.insight.color : undefined }}
                    >
                        {isAnalyzing ? (
                            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            isAiMode ? <Brain size={16} className="animate-pulse" /> : <Database size={16} />
                        )}
                        <span className="text-[9px] font-black uppercase tracking-tighter">
                            {isAnalyzing ? "Analyzing" : "AI Link"}
                        </span>
                    </button>
                </Tooltip>
            </div>

            {/* AUDIO CONTROL */}
            <div className="flex flex-col gap-1 min-w-0">
                <Tooltip content={isAdminMuted ? "Unmute All" : "Mute All"} position="bottom">
                    <button 
                        onClick={handleMuteToggle}
                        className={clsx(
                            "h-[60px] w-14 rounded flex flex-col items-center justify-center gap-1 transition-all border min-w-0",
                            isAdminMuted 
                                ? (isDark ? "bg-red-900/20 border-red-800/50 text-red-400" : "bg-red-50 border-red-200 text-red-500")
                                : (isDark ? "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300" : "bg-white border-slate-300 hover:bg-slate-50 text-slate-600 shadow-sm")
                        )}
                    >
                        {isAdminMuted ? <VolumeX size={16} /> : <Speaker size={16} />}
                        <span className="text-[9px] font-bold uppercase tracking-tighter">Audio</span>
                    </button>
                </Tooltip>
            </div>
            
            {/* OVERRIDE CONTROL */}
            <div className="flex items-center h-full min-w-0">
                {isHuman ? (
                    <button 
                        onClick={handleRelease} 
                        className="h-[60px] w-full rounded bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[10px] flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/20 transition-all active:scale-95 uppercase tracking-wider"
                    >
                        <Unlock size={16} />
                        <span>Release Lock</span>
                    </button>
                ) : (
                    <Tooltip content="Force Manual Control" position="bottom" className="w-full h-full">
                        <button 
                            onClick={handleOverride} 
                            disabled={isOverrideLoading} 
                            className={clsx(
                                "h-[60px] w-full rounded font-bold text-[10px] flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 uppercase tracking-wider",
                                isOverrideLoading 
                                    ? "bg-gray-600 cursor-wait opacity-50"
                                    : "bg-red-500 hover:bg-red-600 text-white shadow-red-900/20"
                            )}
                        >
                            {isOverrideLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Lock size={16} />
                                    <span>Emergency Takeover</span>
                                </>
                            )}
                        </button>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};