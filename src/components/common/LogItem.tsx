// src/components/common/LogItem.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { LogEntry } from '@/contexts/atcTypes';
import { getLogStyle } from '@/utils/logStyles';
import { Copy, Check, ShieldAlert, AlertTriangle, Info, Zap } from 'lucide-react';

import { useUIStore } from '@/store/useUIStore';

interface LogItemProps {
    log: LogEntry; displayMessage?: string; isDark: boolean; showTimestamp?: boolean; compact?: boolean; onClick?: (agentId: string) => void;
}

export const LogItem = React.memo(({ log, displayMessage, isDark, showTimestamp = true, compact = false, onClick }: LogItemProps) => {
    const terminalFontSize = useUIStore(s => s.terminalFontSize);
    const [showContext, setShowContext] = useState(false);
    const [copied, setCopied] = useState(false);
    const style = getLogStyle(log.type, isDark);
    const messageToRender = displayMessage || log.message;
    const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (log.id === 'streaming-log') {
            timeout = setTimeout(() => setIsTyping(true), 0);
            return () => clearTimeout(timeout);
        }
        
        const logTime = new Date(log.timestamp).getTime();
        const isRecent = Date.now() - logTime < 2000;
        if (!isRecent || !['insight', 'proposal', 'exec'].includes(log.type)) {
            timeout = setTimeout(() => setIsTyping(false), 0);
            return () => clearTimeout(timeout);
        }

        timeout = setTimeout(() => setIsTyping(true), 0);

        const endTimeout = setTimeout(() => {
            setIsTyping(false);
        }, 1000);

        return () => {
            clearTimeout(timeout);
            clearTimeout(endTimeout);
        };
    }, [log.timestamp, log.type, log.id]);

    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(messageToRender);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => { setCopied(false); setShowContext(false); }, 1500);
    }, [messageToRender]);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    const renderTextWithBadges = (text: string) => {
        // [CONDITION:xxx], [RISK_LEVEL:x], [STRATEGY:xxx], UUID 등 매칭 정규식
        // 보안/UI 요구사항: UUID(예: 123e4567-e89b-12d3-a456-426614174000 등)가 노출되지 않도록 마스킹
        const badgeRegex = /(\[CONDITION:[^\]]+\]|\[RISK_LEVEL:[^\]]+\]|\[STRATEGY:[^\]]+\]|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;
        
        const parts = text.split(badgeRegex);
        
        return parts.map((part, index) => {
            // UUID 마스킹 처리 (UI 노출 방지)
            if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(part)) {
                return <span key={index} className="inline align-middle text-gray-500 italic">[HIDDEN_ID]</span>;
            }
            if (part.startsWith('[CONDITION:')) {
                const condition = part.slice(11, -1);
                const isCritical = condition.includes('CRITICAL') || condition.includes('EMERGENCY');
                return (
                    <span key={`cond-${index}`} className={clsx(
                        "inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded font-bold text-[10px] border tracking-wider align-middle",
                        isCritical ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    )}>
                        {isCritical ? <AlertTriangle size={10} /> : <Info size={10} />}
                        {condition}
                    </span>
                );
            }
            if (part.startsWith('[RISK_LEVEL:')) {
                const level = part.slice(12, -1);
                const num = parseInt(level, 10);
                const isHigh = num >= 7;
                return (
                    <span key={`risk-${index}`} className={clsx(
                        "inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded font-bold text-[10px] border tracking-wider align-middle",
                        isHigh ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                    )}>
                        <ShieldAlert size={10} />
                        RISK {level}
                    </span>
                );
            }
            if (part.startsWith('[STRATEGY:')) {
                const strategy = part.slice(10, -1);
                return (
                    <span key={`strat-${index}`} className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded font-bold text-[10px] border tracking-wider bg-blue-500/20 text-blue-400 border-blue-500/30 align-middle">
                        <Zap size={10} />
                        {strategy.replace(/_/g, ' ')}
                    </span>
                );
            }
            return <span key={`text-${index}`} className="inline align-middle">{part}</span>;
        });
    };

    return (
        <div 
            data-testid="log-item"
            data-type={log.type}
            data-agent={log.agentId}
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
            onClick={() => log.agentId && log.agentId !== 'SYSTEM' && onClick?.(log.agentId)}
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
            <div data-testid="log-message" 
                className="font-mono flex-1 tracking-tight break-words whitespace-pre-wrap leading-relaxed select-text overflow-hidden relative transition-all"
                style={{ fontSize: compact ? '9px' : `${terminalFontSize}px` }}
            >
                {(log.type === 'insight' || log.type === 'proposal') ? (
                    <div className={clsx(
                        "prose prose-sm max-w-none text-inherit sm:pointer-events-auto inline",
                        isDark && "prose-invert"
                    )}>
                        <ReactMarkdown 
                            components={{
                                p: ({ children }) => {
                                    const maskChildren = React.Children.map(children, child => {
                                        if (typeof child === 'string') {
                                            return renderTextWithBadges(child);
                                        }
                                        return child;
                                    });
                                    return <span className="inline leading-snug">{maskChildren}</span>;
                                },
                                strong: ({ children }) => (
                                    <strong className={clsx(
                                        "font-black px-1 rounded-sm", 
                                        log.type === 'insight' ? "bg-sky-500/20 text-sky-400" : "bg-amber-500/20 text-amber-400"
                                    )}>{children}</strong>
                                ),
                                a: ({ node, ...props }) => (
                                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition-colors" />
                                ),
                                img: () => null // 보안: 외부 이미지 로드 차단
                            }}
                        >
                            {messageToRender.replace(/\n\s*\n/g, '\n')}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <span className="inline leading-snug">{renderTextWithBadges(messageToRender)}</span>
                )}
                {/* Typing Cursor indicator if the log is recent and still receiving chunks. */}
                {isTyping && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-current animate-pulse align-middle opacity-70"></span>
                )}
            </div>
        </div>
    );
});