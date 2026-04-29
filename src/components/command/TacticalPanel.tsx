import React, { useState, useRef, useMemo, useEffect } from 'react';
import Draggable from 'react-draggable';
import clsx from 'clsx';
import { ChevronDown, Radio, Play, Pause, X } from 'lucide-react';
import { TacticalItem } from '@/components/command/TacticalItem';
import { useTacticalActions } from '@/hooks/agent/useTacticalActions';
import { useCategorizedAgents } from '@/hooks/agent/useCategorizedAgents';
import { Agent } from '@/contexts/atcTypes';
import { Tooltip } from '@/components/common/Tooltip';
import { AIControlGroup } from '@/components/common/AIControlGroup';
import { useUIStore } from '@/store/useUIStore';

export const TacticalPanel = () => {
    const { isDark, sidebarWidth, globalStop, toggleGlobalStop, agents, state } = useTacticalActions();
    const { priorityAgents } = useCategorizedAgents();
    const [isOpen, setIsOpen] = useState(true);
    const [filterMode, setFilterMode] = useState<'all' | 'priority'>('all');
    const nodeRef = useRef(null);
    const isTacticalPanelOpen = useUIStore(s => s.isTacticalPanelOpen);
    const setTacticalPanelOpen = useUIStore(s => s.setTacticalPanelOpen);

    
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const safeSidebarWidth = typeof sidebarWidth === 'number' && !isNaN(sidebarWidth) ? sidebarWidth : 280;

    const activeCount = useMemo(() => {
        return agents.filter((a: Agent) => String(a.status).toLowerCase() !== 'paused' && !globalStop).length;
    }, [agents, globalStop]);

    const sortedTacticalList = useMemo(() => {
        const proposedIds = new Set(Array.from(state?.pendingProposals?.values() || []).map(p => p.targetId));
        const baseList = filterMode === 'priority' ? priorityAgents : agents;
        return [...baseList].sort((a, b) => {
            const idA = a.uuid || a.id;
            const idB = b.uuid || b.id;
            
            if (proposedIds.has(idA) && !proposedIds.has(idB)) return -1;
            if (!proposedIds.has(idA) && proposedIds.has(idB)) return 1;
            
            return (a.displayId || a.id).localeCompare(b.displayId || b.id, undefined, { numeric: true });
        });
    }, [priorityAgents, filterMode, agents, state?.pendingProposals]);

    if (!isTacticalPanelOpen) return null;

    return (
        <Draggable key={windowWidth} nodeRef={nodeRef} handle=".tactical-handle" bounds="body" disabled={isMobile}>
            <div ref={nodeRef} 
                className={clsx(
                    "fixed z-50 flex flex-col overflow-hidden pointer-events-auto transition-[height,border,box-shadow,background-color] duration-300",
                    isMobile 
                        ? "!top-[72px] !bottom-auto !left-2 !right-2 !w-auto !rounded-2xl ![transform:none]" 
                        : "top-20 w-80 rounded-xl border shadow-2xl backdrop-blur-md",
                    isDark ? "bg-[#0d1117]/90 border-gray-800 text-gray-300" : "bg-slate-50/80 border-slate-200/40 text-slate-800",
                    isOpen ? (isMobile ? "h-[35vh]" : "max-h-[600px]") : "h-[42px]"
                )}
                style={!isMobile ? { right: safeSidebarWidth + 20 } : undefined}>
                
                <div className={clsx("p-3 border-b flex justify-between items-center tactical-handle cursor-move select-none shrink-0 tactical-panel-container", 
                    isDark ? "bg-gray-800/20 border-gray-800" : "bg-white/40 border-slate-200/40")}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] font-mono">
                        <Radio size={14} className="text-blue-500 animate-pulse" />
                        <Tooltip content="Tactical Control & Monitoring Center" position="bottom">
                            <span>Tactical Command</span>
                        </Tooltip>
                    </div>
                    <div className="flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-white/10 rounded transition">
                            <ChevronDown size={14} className={clsx(!isOpen && "rotate-180")} />
                        </button>
                        <button onClick={() => setTacticalPanelOpen(false)} className="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded transition">
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {isOpen && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 pb-2">
                        <div className="flex items-stretch gap-1 mb-2 h-11 shrink-0">
                            <Tooltip content={globalStop ? "Resume All" : "Halt All"} position="bottom" className="flex-1">
                                <button onClick={toggleGlobalStop}
                                    className={clsx("w-full h-full rounded-lg flex flex-col items-center justify-center border transition-all outline-none",
                                        globalStop ? "bg-red-500/20 border-red-500/50 text-red-500 animate-pulse" : (isDark ? "bg-zinc-800/50 border-white/5 text-zinc-500" : "bg-white border-slate-200 text-slate-400 shadow-sm")
                                    )}>
                                    {globalStop ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                    <span className="text-[7px] font-black uppercase tracking-tighter mt-1 leading-none">{globalStop ? "RESUME" : "HALT ALL"}</span>
                                </button>
                            </Tooltip>
                            <AIControlGroup variant="tactical" />
                            <Tooltip content={`Active: ${activeCount} / Total: ${agents.length}`} position="bottom" className="flex-1">
                                <div className={clsx("h-full rounded-lg border flex flex-col items-center justify-center font-mono shadow-sm",
                                    isDark ? "bg-black/40 border-zinc-800" : "bg-white border-slate-200")}>
                                    <span className="text-[14px] font-black text-blue-500 leading-none">{activeCount}</span>
                                    <span className="text-[7px] text-zinc-500 mt-0.5 tracking-tighter uppercase leading-none">/ {agents.length} nodes</span>
                                </div>
                            </Tooltip>
                        </div>

                        <div className="flex p-0.5 rounded bg-black/10 border border-gray-500/10 mb-2">
                            <Tooltip content="Show all detected nodes" position="bottom" className="flex-1">
                                <button onClick={() => setFilterMode('all')} 
                                    className={clsx("w-full py-1 text-[9px] font-bold rounded transition-colors", 
                                    filterMode === 'all' ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-400")}>
                                    ALL
                                </button>
                            </Tooltip>
                            <Tooltip content="Show high-priority tasks only" position="bottom" className="flex-1">
                                <button onClick={() => setFilterMode('priority')} 
                                    className={clsx("w-full py-1 text-[9px] font-bold rounded transition-colors", 
                                    filterMode === 'priority' ? "bg-amber-500 text-white" : "text-gray-500 hover:text-gray-400")}>
                                    PRIORITY
                                </button>
                            </Tooltip>
                        </div>

                        {sortedTacticalList.map((agent: Agent) => (
                            <TacticalItem key={`tactical-${agent.uuid || agent.id}`} agent={agent} state={state} />
                        ))}
                    </div>
                )}
            </div>
        </Draggable>
    );
};
