// src/components/layout/SidebarContainer.tsx
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useUI } from '@/hooks/system/useUI';
import { useSidebarResize } from '@/hooks/system/useSidebarResize';

import { SidebarHeader } from '@/components/sidebar/SidebarHeader';
import { SidebarControlPanel } from '@/components/sidebar/SidebarControlPanel';
import { SystemStats } from '@/components/sidebar/SystemStats';
import { AgentList } from '@/components/sidebar/AgentList';
import { AgentSettings } from '@/components/sidebar/AgentSettings';

const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

export const SidebarContainer = () => {
    const { sidebarWidth, setSidebarWidth, isDark } = useUI();
    const [uptime, setUptime] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const { sidebarRef, isResizing, handleMouseDown } = useSidebarResize(sidebarWidth, setSidebarWidth);

    useEffect(() => {
        const timer = setInterval(() => setUptime(u => u + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const isCollapsed = sidebarWidth <= 10;

    return (
        <>
            <aside 
                ref={sidebarRef}
                className={clsx(
                    "h-screen border-l flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.3)] backdrop-blur-xl pointer-events-auto relative", // fixed는 App.tsx에서 처리
                    isDark ? "bg-[#0d1117]/85 border-white/5 text-gray-300" : "bg-white/80 border-slate-200/40 text-slate-800",
                    !isResizing && "transition-all duration-300"
                )}
                style={{ width: isCollapsed ? '4px' : sidebarWidth }}
            >
                {/* Resizer */}
                <div 
                    onMouseDown={handleMouseDown}
                    className="absolute top-0 bottom-0 left-[-8px] w-4 cursor-col-resize z-[60] group"
                >
                    {/* 가이드 라인 */}
                    <div className={clsx(
                        "absolute right-[7px] top-0 bottom-0 w-[1.5px] transition-colors",
                        isResizing 
                            ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                            : "group-hover:bg-blue-500/50 bg-transparent",
                        isCollapsed && "bg-blue-500 animate-pulse w-[2px]"
                    )} />
                </div>

                {/* 내부 콘텐츠: 닫혔을 때 숨김 처리 */}
                <div className={clsx(
                    "flex flex-col h-full w-full",
                    isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 transition-opacity duration-200"
                )}>
                    <SidebarHeader onOpenSettings={() => setIsSettingsOpen(true)} />
                    <SidebarControlPanel />

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 min-w-0">
                        <SystemStats />
                        <AgentList />
                    </div>

                    {/* Footer Info */}
                    <div className={clsx(
                        "p-3 border-t text-[10px] font-mono flex justify-between items-center gap-4 min-w-0 shrink-0",
                        isDark ? "border-gray-800 bg-[#0b0e14] text-gray-600" : "border-slate-200 bg-white text-slate-400"
                    )}>
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <span className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                SYSTEM_READY
                            </span>
                            <span className="opacity-50 select-none text-[8px] truncate hidden sm:inline">v2.4.0-RC</span>
                        </div>
                        <div className="shrink-0 whitespace-nowrap">
                            <span className="tabular-nums font-bold">UPTIME: {formatUptime(uptime)}</span>
                        </div>
                    </div>
                </div>
            </aside>

            {isSettingsOpen && (
                <AgentSettings onClose={() => setIsSettingsOpen(false)} />
            )}
        </>
    );
};