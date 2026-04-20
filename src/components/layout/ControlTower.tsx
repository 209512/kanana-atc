// src/components/layout/ControlTower.tsx
import React from 'react';
import clsx from 'clsx';
import { TerminalLog } from '@/components/monitoring/terminal/TerminalLog';
import { QueueDisplay } from '@/components/monitoring/queue/QueueDisplay';
import { TacticalPanel } from '@/components/command/TacticalPanel';
import { useUIStore } from '@/store/useUIStore';
import { Radio, TerminalSquare, Layers } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';

export const ControlTower = () => {
    const { sidebarWidth, isSidebarCollapsed, isTacticalPanelOpen, setTacticalPanelOpen, isTerminalOpen, setTerminalOpen, isQueueOpen, setQueueOpen, isDark } = useUIStore();
    const actualSidebarWidth = isSidebarCollapsed ? 64 : sidebarWidth;

    return (
        <>
            {/* Panel Restore Buttons (FABs) - Sidebar width 에 맞춰 이동 */}
            <div 
                className="absolute top-20 right-0 flex flex-col gap-2 z-40 pointer-events-none transition-all duration-300" 
                style={{ transform: `translateX(calc(-${actualSidebarWidth}px - 16px))` }}
            >
                {!isTacticalPanelOpen && (
                    <Tooltip content="Open Tactical Command" position="left">
                        <button 
                            onClick={() => setTacticalPanelOpen(true)}
                            className={clsx(
                                "p-3 rounded-full shadow-xl pointer-events-auto transition-all hover:scale-110",
                                isDark ? "bg-gray-800/80 text-gray-400 hover:text-white border border-gray-700/50" : "bg-white/80 text-slate-500 hover:text-slate-800 border border-slate-200/50"
                            )}
                        >
                            <Radio size={20} />
                        </button>
                    </Tooltip>
                )}
                {!isTerminalOpen && (
                    <Tooltip content="Open Terminal Log" position="left">
                        <button 
                            onClick={() => setTerminalOpen(true)}
                            className={clsx(
                                "p-3 rounded-full shadow-xl pointer-events-auto transition-all hover:scale-110",
                                isDark ? "bg-gray-800/80 text-gray-400 hover:text-white border border-gray-700/50" : "bg-white/80 text-slate-500 hover:text-slate-800 border border-slate-200/50"
                            )}
                        >
                            <TerminalSquare size={20} />
                        </button>
                    </Tooltip>
                )}
                {!isQueueOpen && (
                    <Tooltip content="Open Sector Queue" position="left">
                        <button 
                            onClick={() => setQueueOpen(true)}
                            className={clsx(
                                "p-3 rounded-full shadow-xl pointer-events-auto transition-all hover:scale-110",
                                isDark ? "bg-gray-800/80 text-gray-400 hover:text-white border border-gray-700/50" : "bg-white/80 text-slate-500 hover:text-slate-800 border border-slate-200/50"
                            )}
                        >
                            <Layers size={20} />
                        </button>
                    </Tooltip>
                )}
            </div>

            <div 
                className="absolute inset-y-0 right-0 pointer-events-none transition-all duration-300" 
                style={{ 
                    zIndex: 30,
                    right: `${actualSidebarWidth}px`
                }}
            >
                <TerminalLog />
                {isQueueOpen && <QueueDisplay />}
                <TacticalPanel />
            </div>
        </>
    );
};