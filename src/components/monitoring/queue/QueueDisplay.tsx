// src/components/monitoring/queue/QueueDisplay.tsx
import React, { useRef, useState, useMemo } from 'react';
import Draggable from 'react-draggable';
import clsx from 'clsx';
import { Layers, ChevronDown, Activity, User, Star } from 'lucide-react';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { useCategorizedAgents } from '@/hooks/agent/useCategorizedAgents';
import { Tooltip } from '@/components/common/Tooltip';
import { AgentRow } from './QueueAgentRow';

export const QueueDisplay = () => {
    const { state } = useATC();
    const { isDark } = useUI();
    const { priorityAgents = [], queueAgents = [], masterAgent = null } = useCategorizedAgents();
    const [isOpen, setIsOpen] = useState(true);
    const nodeRef = useRef<HTMLDivElement>(null);

    const targetIds = useMemo(() => 
        new Set(state?.pendingProposals?.map(p => p.targetId) || []),
        [state?.pendingProposals]
    );

    const isAiMode = state?.overrideSignal || targetIds.size > 0;

    return (
        <Draggable nodeRef={nodeRef} handle=".queue-handle" bounds="body">
            <div 
                ref={nodeRef} 
                className={clsx(
                    "fixed w-72 rounded-xl border shadow-2xl backdrop-blur-md z-40 flex flex-col overflow-hidden pointer-events-auto",
                    "transition-[height,border,box-shadow,background-color] duration-300",
                    isDark ? "bg-[#0d1117]/90 border-gray-800 text-gray-300" : "bg-slate-50/80 border-slate-200/40 text-slate-800",
                    isOpen ? "h-[500px]" : "h-10",
                    isAiMode && (isDark ? "shadow-[0_0_20px_rgba(56,189,248,0.2)] border-sky-500/50" : "shadow-[0_0_20px_rgba(14,165,233,0.15)] border-sky-400/40")
                )} 
                style={{ left: 20, top: 20 }}
            >
                {/* Header */}
                <div className={clsx(
                    "p-2 border-b flex justify-between items-center queue-handle cursor-move h-10 shrink-0 select-none", 
                    isDark ? "bg-gray-800/40 border-gray-800" : "bg-white/60 border-slate-200/40"
                )}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] font-mono pointer-events-auto">
                        <Layers size={14} className={clsx("transition-colors", isAiMode ? "text-sky-400" : "text-blue-500")} /> 
                        <Tooltip content="Sector Traffic Flow" position="bottom">
                            <span>Sector_Queue</span>
                        </Tooltip>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }} 
                        className="p-1 hover:bg-white/10 rounded transition-colors relative z-10"
                    >
                        <ChevronDown size={14} className={clsx("transition-transform duration-300", !isOpen && "rotate-180")} />
                    </button>
                </div>

                {/* Content Area */}
                <div className={clsx("p-3 space-y-5 overflow-y-auto custom-scrollbar font-mono text-[11px]", !isOpen && "hidden")}>
                    <section>
                        <Tooltip content="Active Controller Node" position="right">
                            <div className="text-[9px] uppercase opacity-50 mb-1.5 flex items-center gap-1 font-bold">
                                <Activity size={10} /> Master_Node
                            </div>
                        </Tooltip>
                        {masterAgent ? (
                            <AgentRow 
                                agent={masterAgent} index={0} type="master" 
                                isDark={isDark} state={state} aiProposed={targetIds.has(masterAgent.id)} 
                            />
                        ) : (
                            <div className="p-3 text-center opacity-30 italic border border-dashed rounded text-[10px]">Standby_Mode</div>
                        )}
                    </section>

                    <section>
                        <Tooltip content="Priority Execution Queue" position="right">
                            <div className="text-[9px] text-yellow-500 uppercase mb-1.5 flex items-center gap-1 font-bold">
                                <Star size={10} fill="currentColor" /> Priority_Stack ({priorityAgents.length})
                            </div>
                        </Tooltip>
                        <div className="space-y-1">
                            {priorityAgents.map((agent, idx) => (
                                <AgentRow 
                                    key={agent.id} agent={agent} index={idx} type="priority" 
                                    isDark={isDark} state={state} aiProposed={targetIds.has(agent.id)} 
                                />
                            ))}
                        </div>
                    </section>

                    <section>
                        <Tooltip content="Standard Traffic Rotation" position="right">
                            <div className="text-[9px] uppercase opacity-50 mb-1.5 flex items-center gap-1 font-bold">
                                <User size={10} /> Active_Traffic ({queueAgents.length})
                            </div>
                        </Tooltip>
                        <div className="space-y-1">
                            {queueAgents.length > 0 ? (
                                queueAgents.map((agent, idx) => (
                                    <AgentRow 
                                        key={agent.id} agent={agent} index={idx} type="queue" 
                                        isDark={isDark} state={state} aiProposed={targetIds.has(agent.id)} 
                                    />
                                ))
                            ) : (
                                <div className="text-[9px] opacity-20 py-4 text-center border border-dashed rounded">No waiting traffic</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </Draggable>
    );
};