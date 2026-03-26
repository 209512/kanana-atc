// src/components/command/TacticalPanel.tsx
import React, { useRef, useState, useMemo } from 'react';
import Draggable from 'react-draggable';
import clsx from 'clsx';
import { ChevronDown, Radio, Play, Pause } from 'lucide-react';
import { TacticalItem } from '@/components/command/TacticalItem';
import { useTacticalActions } from '@/hooks/agent/useTacticalActions';
import { useCategorizedAgents } from '@/hooks/agent/useCategorizedAgents';
import { Agent } from '@/contexts/atcTypes';
import { Tooltip } from '@/components/common/Tooltip';

export const TacticalPanel = () => {
    const { isDark, sidebarWidth, globalStop, toggleGlobalStop, agents } = useTacticalActions();
    const { priorityAgents, normalAgents } = useCategorizedAgents();
    
    const [isOpen, setIsOpen] = useState(true);
    const [filterMode, setFilterMode] = useState<'all' | 'priority'>('all');
    const nodeRef = useRef(null);

    const safeSidebarWidth = typeof sidebarWidth === 'number' && !isNaN(sidebarWidth) ? sidebarWidth : 280;

    const activeCount = useMemo(() => {
        return agents.filter((a: Agent) => String(a.status).toLowerCase() !== 'paused' && !globalStop).length;
    }, [agents, globalStop]);

    const sortedTacticalList = useMemo(() => {
        if (filterMode === 'priority') return priorityAgents;

        return [...agents].sort((a, b) => 
            (a.displayId || a.id).localeCompare(b.displayId || b.id, undefined, { numeric: true })
        );
        
    }, [priorityAgents, normalAgents, filterMode, agents]);

    return (
        <Draggable nodeRef={nodeRef} handle=".tactical-handle" bounds="body">
            <div ref={nodeRef} 
                className={clsx("fixed top-20 w-80 rounded-xl border shadow-2xl backdrop-blur-md z-50 flex flex-col max-h-[600px] overflow-hidden transition-colors pointer-events-auto", 
                isDark ? "bg-[#0d1117]/90 border-gray-800 text-gray-300" : "bg-slate-50/80 border-slate-200/40 text-slate-800")}
                style={{ right: safeSidebarWidth + 20 }}>
                
                <div className={clsx("p-3 border-b flex justify-between items-center tactical-handle cursor-move select-none shrink-0", 
                    isDark ? "bg-gray-800/20 border-gray-800" : "bg-white/40 border-slate-200/40")}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] font-mono">
                        <Radio size={14} className="text-blue-500" />
                        <Tooltip content="Active Node Engagement Control" position="bottom-right">
                            <span>Tactical Command</span>
                        </Tooltip>
                    </div>
                    <Tooltip content={isOpen ? "Minimize" : "Expand"} position="bottom">
                        <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-white/10 rounded transition">
                            <ChevronDown size={14} className={clsx(!isOpen && "rotate-180")} />
                        </button>
                    </Tooltip>
                </div>

                {isOpen && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 pb-2">
                        <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
                            <Tooltip content={globalStop ? "Resume All" : "Halt All"} position="bottom">
                                <button onClick={toggleGlobalStop}
                                    className={clsx("w-full p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 border transition-all",
                                        globalStop ? "bg-red-500 text-white border-red-600 animate-pulse" : (isDark ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-slate-300")
                                    )}>
                                    {globalStop ? <Play size={12} /> : <Pause size={12} />}
                                    {globalStop ? "RESUME ALL" : "HALT ALL"}
                                </button>
                            </Tooltip>
                            <Tooltip content="Live Active / Total Nodes" position="bottom">
                                <div className={clsx("p-2 rounded text-[10px] font-mono flex flex-col items-center justify-center border",
                                    isDark ? "bg-gray-900 border-gray-800 text-gray-500" : "bg-slate-50 border-slate-200 text-slate-500")}>
                                    <span className="font-bold text-lg text-blue-500 leading-none">{activeCount} / {agents.length}</span>
                                </div>
                            </Tooltip>
                        </div>

                        <div className="flex p-0.5 rounded bg-black/10 border border-gray-500/10 mb-2">
                            <Tooltip content="Filter: All" position="bottom" className="flex-1">
                                <button onClick={() => setFilterMode('all')} className={clsx("w-full py-1 text-[9px] font-bold rounded", filterMode === 'all' ? "bg-blue-600 text-white" : "text-gray-500")}>ALL</button>
                            </Tooltip>
                            <Tooltip content="Filter: Priority" position="bottom" className="flex-1">
                                <button onClick={() => setFilterMode('priority')} className={clsx("w-full py-1 text-[9px] font-bold rounded", filterMode === 'priority' ? "bg-amber-500 text-white" : "text-gray-500")}>PRIORITY</button>
                            </Tooltip>
                        </div>

                        {sortedTacticalList.map((agent: Agent) => (
                            <TacticalItem key={`tactical-${agent.id}`} agent={agent} />
                        ))}
                    </div>
                )}
            </div>
        </Draggable>
    );
};