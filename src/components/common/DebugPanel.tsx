// src/components/common/DebugPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Flame, CloudRain, Briefcase, Zap, X, Send } from 'lucide-react';
import { logger } from '@/utils/logger';
import { useTranslation } from 'react-i18next';

export const DebugPanel = () => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const [isInjecting, setIsInjecting] = useState(false);
    const [customEvent, setCustomEvent] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // MSW가 꺼져있는 프로덕션 환경이면 아예 동작하지 않게 처리
        if (import.meta.env.VITE_USE_MSW === 'false') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl + Shift + D (또는 Cmd + Shift + D) 로 패널 토글
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                setIsVisible(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const injectEvent = async (type: string) => {
        if (isInjecting) return;
        setIsInjecting(true);

        let payload = {};
        switch (type) {
            case 'FIRE':
                payload = { news: "도심 3구역 대형 화재 발생 및 유독가스 확산 중" };
                break;
            case 'STORM':
                payload = { weather: "초강력 태풍 북상, 풍속 30m/s 이상, 전 구역 비행 주의" };
                break;
            case 'ECONOMY':
                payload = { economy: "글로벌 금융 위기로 코스피 5% 급락, 자산 보호 프로토콜 요망" };
                break;
            case 'CUSTOM':
                if (!customEvent.trim()) {
                    setIsInjecting(false);
                    return;
                }
                payload = { custom: customEvent.trim() };
                break;
            default:
                break;
        }

        try {
            await fetch('/api/mock/inject-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
                logger.error("Failed to inject event:", err);
            } finally {
                setTimeout(() => setIsInjecting(false), 1000);
                if (type === 'CUSTOM') {
                    setCustomEvent('');
                    inputRef.current?.blur();
                }
            }
        };

        if (!isVisible || import.meta.env.VITE_USE_MSW === 'false') return null;

        return (
            <div className="fixed bottom-4 right-4 z-50 bg-black/90 border border-red-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(239,68,68,0.2)] backdrop-blur-md text-white font-mono text-xs w-80">
                <div className="flex items-center justify-between border-b border-red-500/30 pb-2 mb-3">
                    <div className="flex items-center gap-2 text-red-400 font-bold">
                        <Zap size={14} className="animate-pulse" />
                        <span>{t('debug.title', 'EVENT INJECTOR (DEMO)')}</span>
                    </div>
                    <button 
                        onClick={() => setIsVisible(false)} 
                        className="text-zinc-500 hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                        aria-label={t('debug.close', 'Close Debug Panel')}
                    >
                        <X size={14} />
                    </button>
                </div>
                
                <div className="space-y-2">
                    <p className="text-zinc-400 text-[10px] leading-tight mb-2">
                        {t('debug.desc', 'Inject specific events to trigger Gemini Agents & Kanana-O Autopilot.')}
                    </p>
                    <button 
                        onClick={() => injectEvent('FIRE')}
                        disabled={isInjecting}
                        className={clsx(
                            "w-full flex items-center gap-2 p-2 min-h-[44px] rounded border transition-all",
                            isInjecting ? "opacity-50 cursor-not-allowed" : "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-400 hover:border-orange-500/50"
                        )}
                    >
                        <Flame size={14} />
                        <span>{t('debug.trigger.fire', 'Trigger: URBAN FIRE')}</span>
                    </button>

                    <button 
                        onClick={() => injectEvent('STORM')}
                        disabled={isInjecting}
                        className={clsx(
                            "w-full flex items-center gap-2 p-2 min-h-[44px] rounded border transition-all",
                            isInjecting ? "opacity-50 cursor-not-allowed" : "bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20 text-sky-400 hover:border-sky-500/50"
                        )}
                    >
                        <CloudRain size={14} />
                        <span>{t('debug.trigger.storm', 'Trigger: STORM WARNING')}</span>
                    </button>

                    <button 
                        onClick={() => injectEvent('ECONOMY')}
                        disabled={isInjecting}
                        className={clsx(
                            "w-full flex items-center gap-2 p-2 min-h-[44px] rounded border transition-all",
                            isInjecting ? "opacity-50 cursor-not-allowed" : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 hover:border-emerald-500/50"
                        )}
                    >
                        <Briefcase size={14} />
                        <span>{t('debug.trigger.economy', 'Trigger: MARKET CRASH')}</span>
                    </button>

                    <div className="mt-4 pt-3 border-t border-zinc-800">
                        <p className="text-zinc-500 text-[10px] mb-1">{t('debug.custom_title', 'Custom Event Injection')}</p>
                        <div className="flex items-center gap-1">
                            <input 
                                ref={inputRef}
                                type="text"
                                value={customEvent}
                                onChange={(e) => setCustomEvent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        injectEvent('CUSTOM');
                                    }
                                }}
                                placeholder={t('debug.custom_placeholder', 'e.g., Terrorist spotted...')}
                                disabled={isInjecting}
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-2 min-h-[44px] text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
                                aria-label="Custom Event Input"
                            />
                            <button
                                onClick={() => injectEvent('CUSTOM')}
                                disabled={isInjecting || !customEvent.trim()}
                                className={clsx(
                                    "p-2 min-w-[44px] min-h-[44px] rounded border transition-all flex items-center justify-center shrink-0",
                                    (isInjecting || !customEvent.trim()) ? "bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed" : "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                                )}
                                aria-label={t('debug.send', 'SEND EVENT')}
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
