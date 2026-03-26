// src/components/monitoring/queue/QueueDisplay.tsx
import React, { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import clsx from 'clsx';
import { Layers, ChevronDown, Zap, Activity, User, Star } from 'lucide-react';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { useCategorizedAgents } from '@/hooks/agent/useCategorizedAgents';
import { Tooltip } from '@/components/common/Tooltip'; 
import { getAgentCardStyle, getAgentTextStyle } from '@/utils/agentStyles';
import { Agent } from '@/contexts/atcTypes';

export const QueueDisplay = () => {
    const { state } = useATC();
    const { isDark } = useUI();
    const { priorityAgents = [], queueAgents = [], masterAgent = null } = useCategorizedAgents();
    const [isOpen, setIsOpen] = useState(true);
    const nodeRef = useRef<HTMLDivElement>(null);

    return (
        <Draggable nodeRef={nodeRef} handle=".queue-handle" bounds="body">
            <div ref={nodeRef} className={clsx("fixed w-72 rounded-xl border shadow-2xl backdrop-blur-md z-40 flex flex-col overflow-hidden transition-[height] duration-300 pointer-events-auto",
                    isDark ? "bg-[#0d1117]/90 border-gray-800 text-gray-300" : "bg-slate-50/80 border-slate-200/40 text-slate-800",
                    isOpen ? "h-[500px]" : "h-10")} 
                style={{ left: 20, top: 20 }}
            >
                
                <div className={clsx("p-2 border-b flex justify-between items-center queue-handle cursor-move h-10 shrink-0 select-none", 
                    isDark ? "bg-gray-800/40 border-gray-800" : "bg-white/60 border-slate-200/40")}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] font-mono">
                        <Layers size={14} className="text-blue-500" /> 
                        <Tooltip content="Sector Traffic Flow" position="bottom-right">
                            <span>Sector_Queue</span>
                        </Tooltip>
                    </div>
                    <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-white/10 rounded transition-colors">
                        <ChevronDown size={14} className={clsx("transition-transform duration-300", !isOpen && "rotate-180")} />
                    </button>
                </div>

                <div className={clsx("p-3 space-y-4 overflow-y-auto custom-scrollbar font-mono text-[11px]", !isOpen && "hidden")}>
                    <section>
                        <Tooltip content="Active Controller Node" position="right">
                            <div className="text-[9px] uppercase opacity-50 mb-1.5 flex items-center gap-1 font-bold">
                                <Activity size={10} /> Master_Node
                            </div>
                        </Tooltip>
                        {masterAgent ? (
                            <div className={clsx("flex items-center justify-between p-2 border rounded-sm", 
                                getAgentCardStyle({
                                    isForced: state.forcedCandidate === masterAgent.id, 
                                    isLocked: true, 
                                    isPaused: false, 
                                    isPriority: true, 
                                    isSelected: false, 
                                    isDark, 
                                    overrideSignal: state.overrideSignal, 
                                    globalStop: state.globalStop
                                }))}>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="font-bold text-emerald-500">{masterAgent.displayId || masterAgent.id}</span>
                                </div>
                                <Tooltip content="System Lock Active" position="left">
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold cursor-default">LOCK_HELD</span>
                                </Tooltip>
                            </div>
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
                            {priorityAgents.map((agent: Agent, idx: number) => (
                                <div key={agent.id} className={clsx("flex items-center justify-between p-1.5 border rounded-sm", 
                                    getAgentCardStyle({
                                        isForced: agent.id === state.forcedCandidate, 
                                        isLocked: false, 
                                        isPaused: agent.status === 'paused', 
                                        isPriority: true, 
                                        isSelected: false, 
                                        isDark, 
                                        overrideSignal: state.overrideSignal, 
                                        globalStop: state.globalStop
                                    }))}>
                                    <div className="flex items-center gap-2">
                                        <span className="opacity-40 text-[8px]">P-{idx+1}</span>
                                        <span className={getAgentTextStyle({
                                            isForced: agent.id === state.forcedCandidate, 
                                            isLocked: false, 
                                            isDark, 
                                            overrideSignal: state.overrideSignal
                                        })}>{agent.displayId || agent.id}</span>
                                    </div>
                                    <Star size={10} className="text-yellow-500 fill-current" />
                                </div>
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
                                queueAgents.map((agent: Agent, idx: number) => (
                                    <div key={agent.id} className={clsx("flex items-center justify-between p-1.5 border rounded-sm", 
                                        getAgentCardStyle({
                                            isForced: agent.id === state.forcedCandidate, 
                                            isLocked: false, 
                                            isPaused: agent.status === 'paused', 
                                            isPriority: false, 
                                            isSelected: false, 
                                            isDark, 
                                            overrideSignal: state.overrideSignal, 
                                            globalStop: state.globalStop
                                        }))}>
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-40 text-[8px]">Q-{idx+1}</span>
                                            <span className={getAgentTextStyle({
                                                isForced: agent.id === state.forcedCandidate, 
                                                isLocked: false, 
                                                isDark, 
                                                overrideSignal: state.overrideSignal
                                            })}>{agent.displayId || agent.id}</span>
                                        </div>
                                        {agent.id === state.forcedCandidate && <Zap size={10} className="text-purple-500 animate-pulse" />}
                                    </div>
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