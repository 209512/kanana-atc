// src/components/layout/SidebarContainer.tsx
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useUIStore } from '@/store/useUIStore';
import { useSidebarResize } from '@/hooks/system/useSidebarResize';

import { SidebarHeader } from '@/components/sidebar/SidebarHeader';
import { SidebarControlPanel } from '@/components/sidebar/SidebarControlPanel';
import { SystemStats } from '@/components/sidebar/SystemStats';
import { AgentList } from '@/components/sidebar/AgentList';
import { AgentSettings } from '@/components/sidebar/AgentSettings';
import { CompactSidebar } from '@/components/sidebar/CompactSidebar';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

export const SidebarContainer = () => {
    const { sidebarWidth, setSidebarWidth, isDark, isSidebarCollapsed, toggleSidebar } = useUIStore();
    const [uptime, setUptime] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const { sidebarRef, isResizing, handleMouseDown } = useSidebarResize(sidebarWidth, setSidebarWidth);

    useEffect(() => {
        const timer = setInterval(() => setUptime(u => u + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const actualWidth = isSidebarCollapsed ? 64 : sidebarWidth;

    return (
        <>
            <aside 
                ref={sidebarRef}
                className={clsx(
                    "h-screen border-l flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.3)] backdrop-blur-xl pointer-events-auto relative sidebar-container", // fixed는 App.tsx에서 처리
                    isDark ? "bg-[#0d1117]/85 border-white/5 text-gray-300" : "bg-white/80 border-slate-200/40 text-slate-800",
                    !isResizing && "transition-all duration-300"
                )}
                style={{ width: actualWidth }}
            >
                {/* Resizer */}
                {!isSidebarCollapsed && (
                    <div 
                        onMouseDown={handleMouseDown}
                        className="absolute top-0 bottom-0 left-[-8px] w-4 cursor-col-resize z-[60] group"
                    >
                        {/* 가이드 라인 */}
                        <div className={clsx(
                            "absolute right-[7px] top-0 bottom-0 w-[1.5px] transition-colors",
                            isResizing 
                                ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                                : "group-hover:bg-blue-500/50 bg-transparent"
                        )} />
                    </div>
                )}

                {/* 사이드바 접기/펼치기 토글 버튼 (왼쪽 가장자리에 튀어나온 형태) */}
                <button
                    onClick={toggleSidebar}
                    className={clsx(
                        "absolute top-1/2 -translate-y-1/2 -left-[24px] w-6 h-12 flex items-center justify-center rounded-l-md border-y border-l shadow-[-4px_0_10px_rgba(0,0,0,0.2)] backdrop-blur-md transition-colors z-[70]",
                        isDark ? "bg-[#161b22] border-white/10 text-gray-400 hover:text-white hover:bg-gray-800" : "bg-white border-slate-200/60 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    )}
                >
                    {isSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>

                {isSidebarCollapsed ? (
                    <CompactSidebar uptime={uptime} formatUptime={formatUptime} onOpenSettings={() => setIsSettingsOpen(true)} />
                ) : (
                    <div className="flex flex-col h-full w-full opacity-100 transition-opacity duration-200">
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
                )}
            </aside>

            {isSettingsOpen && (
                <AgentSettings onClose={() => setIsSettingsOpen(false)} />
            )}
        </>
    );
};