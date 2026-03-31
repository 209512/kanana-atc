// src/components/common/LogItem.tsx
import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { LogEntry } from '@/contexts/atcTypes';
import { getLogStyle } from '@/utils/logStyles';
import { Copy, Check } from 'lucide-react';

interface LogItemProps {
    log: LogEntry; displayMessage?: string; isDark: boolean; showTimestamp?: boolean; compact?: boolean; onClick?: (agentId: string) => void;
}

export const LogItem = React.memo(({ log, displayMessage, isDark, showTimestamp = true, compact = false, onClick }: LogItemProps) => {
    const [showContext, setShowContext] = useState(false);
    const [copied, setCopied] = useState(false);
    const style = getLogStyle(log.type, isDark);
    const messageToRender = displayMessage || log.message;
    const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(messageToRender);
        setCopied(true);
        setTimeout(() => { setCopied(false); setShowContext(false); }, 1500);
    }, [messageToRender]);

    return (
        <div 
            className={clsx(
                "grid gap-x-2 border-b last:border-0 w-full group relative items-start transition-none",
                "grid-cols-[auto_auto_1fr]",
                compact ? "py-1 px-1 text-[9px]" : "py-2 px-2 text-[11px]",
                isDark ? "border-white/5 hover:bg-white/5" : "border-black/5 hover:bg-black/5",
                log.agentId && log.agentId !== 'SYSTEM' && "cursor-pointer",
                style.className
            )}
            onContextMenu={(e) => { e.preventDefault(); setShowContext(true); }}
            onMouseLeave={() => !copied && setShowContext(false)}
        >
            {showContext && (
                <div className={clsx(
                    "absolute right-2 top-1 z-20 flex border rounded shadow-xl overflow-hidden animate-in fade-in zoom-in duration-100",
                    isDark ? "bg-gray-900 border-sky-500/50" : "bg-white border-sky-400 shadow-sky-900/10"
                )}>
                    <button onClick={handleCopy} className={clsx(
                        "p-1.5 flex items-center gap-2 px-3 transition-colors",
                        isDark ? "hover:bg-sky-500/20 text-sky-400" : "hover:bg-sky-50 text-sky-600"
                    )}>
                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        <span className="text-[10px] font-bold">{copied ? "COPIED" : "COPY ALL"}</span>
                    </button>
                </div>
            )}

            {showTimestamp && <span className="opacity-30 font-mono shrink-0 select-none text-[0.85em] mt-0.5">{timeStr}</span>}
            <span className={clsx("font-mono font-black shrink-0 select-none mt-0.5 min-w-[35px]", style.className)}>{style.tag}</span>

            {/* select-text. 드래그 복사 */}
            <div className="font-mono flex-1 tracking-tight break-words whitespace-pre-wrap leading-relaxed select-text overflow-hidden">
                {(log.type === 'insight' || log.type === 'proposal') ? (
                    <div className={clsx(
                        "prose prose-sm max-w-none text-inherit sm:pointer-events-auto",
                        isDark && "prose-invert"
                    )}>
                        <ReactMarkdown 
                            components={{
                                p: ({ children }) => <span className="block leading-snug mb-1 last:mb-0">{children}</span>,
                                strong: ({ children }) => (
                                    <strong className={clsx(
                                        "font-black px-1 rounded-sm", 
                                        log.type === 'insight' ? "bg-sky-500/20 text-sky-400" : "bg-amber-500/20 text-amber-400"
                                    )}>{children}</strong>
                                )
                            }}
                        >
                            {messageToRender.replace(/\n\s*\n/g, '\n')}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <span>{messageToRender}</span>
                )}
            </div>
        </div>
    );
});