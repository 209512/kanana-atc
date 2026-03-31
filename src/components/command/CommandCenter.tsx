// src/components/command/CommandCenter.tsx
import React from 'react';
import clsx from 'clsx';
import { Send, Brain, Mic, MicOff, Loader2 } from 'lucide-react';
import { useCommandCenter } from '@/hooks/system/useCommandCenter';
import { useUI } from '@/hooks/system/useUI';
import { useATC } from '@/hooks/system/useATC';
import { Tooltip } from '@/components/common/Tooltip';
import { useSTT } from '@/hooks/system/useSTT';

export const CommandCenter = () => {
    const { isDark } = useUI();
    const { isAiMode } = useATC();
    const { inputValue, setInputValue, isAnalyzing, handleAnalyze } = useCommandCenter();

    const { isListening, toggleListening, hasSupport } = useSTT((text) => {
        setInputValue(text);
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && isAiMode) { 
            e.preventDefault();
            handleAnalyze();
        }
    };

    return (
        <div className={clsx(
            "w-full max-w-2xl px-4 transition-all duration-300",
            !isAiMode && "opacity-60 grayscale-[0.5]"
        )}> 
            <div className={clsx(
                "relative flex items-center gap-2 p-2 rounded-2xl border backdrop-blur-xl transition-all shadow-2xl",
                !isAiMode ? "bg-zinc-800/40 border-zinc-700/50" :
                isListening ? "ring-2 ring-red-500/50 border-red-500/50 bg-red-500/5" : 
                (isDark ? "bg-zinc-900/80 border-white/10 shadow-black/40" : "bg-white/90 border-slate-300 shadow-xl shadow-slate-200/50")
            )}>
                {/* 상태 표시기 */}
                <div className={clsx(
                    "absolute -top-3 left-6 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all z-10 select-none",
                    !isAiMode ? "bg-zinc-800 text-zinc-500" :
                    isAnalyzing ? "bg-sky-500 text-white animate-pulse" : 
                    isListening ? "bg-red-500 text-white animate-bounce" :
                    (isDark ? "bg-zinc-700 text-zinc-300" : "bg-slate-600 text-white")
                )}>
                    <Tooltip content={!isAiMode ? "System Link Offline" : "AI Core Active"} position="top">
                        <span>
                            {!isAiMode ? "AI_LINK_OFFLINE" : isAnalyzing ? "Kanana-O Analyzing..." : isListening ? "Listening..." : "Ready for Command"}
                        </span>
                    </Tooltip>
                </div>

                {/* Analyze 버튼 */}
                <Tooltip content="Analyze Strategic Command (Enter)" position="top">
                    <button
                        onClick={() => handleAnalyze()}
                        disabled={!isAiMode || isAnalyzing || isListening}
                        className={clsx(
                            "group flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-[11px] transition-all overflow-hidden relative shrink-0",
                            !isAiMode ? "bg-zinc-700 text-zinc-500 cursor-not-allowed" :
                            isAnalyzing ? "bg-sky-500/20 text-sky-400 cursor-wait" : "bg-sky-500 hover:bg-sky-400 text-white active:scale-95 disabled:opacity-50"
                        )}
                    >
                        <Brain size={16} />
                        <span className="hidden sm:inline">ANALYZE</span>
                    </button>
                </Tooltip>

                {/* 입력창 */}
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={!isAiMode ? "AI Link is required for commands..." : isListening ? "Listening..." : "Enter strategic command..."}
                        disabled={!isAiMode || isAnalyzing}
                        className={clsx(
                            "w-full bg-transparent px-2 py-3 text-xs focus:outline-none transition-colors",
                            isDark 
                                ? "text-white placeholder-zinc-500" 
                                : "text-slate-900 placeholder-slate-500 font-medium",
                            !isAiMode && "cursor-not-allowed"
                        )}
                    />
                </div>

                {/* STT */}
                <div className="flex items-center gap-1 pr-1">
                    {hasSupport && (
                        <Tooltip content={isListening ? "Stop STT" : "Start Voice Input"} position="top">
                            <button 
                                onClick={toggleListening}
                                disabled={!isAiMode}
                                className={clsx(
                                    "p-2.5 rounded-lg transition-all",
                                    !isAiMode ? "text-zinc-800" : isListening ? "bg-red-500 text-white shadow-lg" : "text-zinc-500 hover:bg-black/5"
                                )}
                            >
                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
};