import React, { useState } from 'react';
import { X, Pause, Activity, Cpu, Database, Edit2, Save } from 'lucide-react';
import Draggable from 'react-draggable'; 
import clsx from 'clsx';
import { Agent } from '@/contexts/atcTypes';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { useAgentLogic } from '@/hooks/agent/useAgentLogic';
import { useTacticalActions } from '@/hooks/agent/useTacticalActions';
import { AgentActionButtons } from '@/components/common/AgentActionButtons';
import { LOG_LEVELS } from '@/utils/logStyles';
import { RADAR_CONFIG } from './radarConfig';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';
import { AgentMetrics } from '@/components/agent';

interface AgentDetailPopupProps {
    agent: Agent | undefined;
    onClose: () => void;
    isDark: boolean;
    onTerminate?: (id: string) => void;
    onTogglePriority?: (id: string, enable: boolean) => void;
    onTransferLock?: (id: string) => void;
    onTogglePause?: (id: string, isPaused: boolean) => void;
    isCompact?: boolean;
}

export const AgentDetailPopup = ({ 
    agent, onClose, isDark, 
    isCompact = false
}: AgentDetailPopupProps) => {
    const state = useATCStore(s => s.state);
    const { onTogglePause, onTransferLock, togglePriority, terminateAgent } = useTacticalActions();
    const { isPaused, isForced, statusLabel, isLocked } = useAgentLogic(agent as Agent, state);
    const { updateAgentConfig } = useAgentMutations();
    const sidebarWidth = useUIStore(s => s.sidebarWidth);
    const isSidebarCollapsed = useUIStore(s => s.isSidebarCollapsed);
    
    const [isVisible, setIsVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editPersona, setEditPersona] = useState('');

    const [isDragging, setIsDragging] = useState(false);
    const nodeRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setIsVisible(true); 
    }, [agent?.id]);

    React.useEffect(() => {
        if (agent) {
            setEditPersona(agent.persona || agent.systemPrompt || '');
        }
    }, [agent?.persona, agent?.systemPrompt]);

    if (!agent || !isVisible) return null;

    const handleSave = () => {
        if (agent) {
            updateAgentConfig.mutate({ uuid: agent.id, config: { persona: editPersona } });
            setIsEditing(false);
        }
    };

    const actualSidebarWidth = isSidebarCollapsed ? 64 : sidebarWidth;

    return (
        <Draggable nodeRef={nodeRef} bounds="parent" handle=".drag-handle" onStart={() => setIsDragging(true)} onStop={() => setIsDragging(false)}>
            <div 
                ref={nodeRef}
                className={clsx(
                    "absolute z-[100] rounded-lg border shadow-2xl backdrop-blur-xl select-none",
                    "pointer-events-auto flex flex-col",
                    !isDragging && "transition-[transform,filter,box-shadow,opacity] duration-300",
                    isCompact ? "w-56 scale-90 origin-top-right" : "w-64",
                    isForced ? "ring-2 ring-purple-500 bg-purple-900/20" : 
                    (isDark ? "bg-[#0d1117]/95 border-gray-700 text-gray-300" : "bg-white/95 border-slate-300 text-slate-700")
                )}
                style={{ 
                    right: typeof window !== 'undefined' && window.innerWidth < 768 ? '16px' : (isCompact ? '80px' : `calc(${actualSidebarWidth}px + 80px)`), 
                    top: '48px',
                    maxWidth: 'calc(100vw - 32px)' // Ensure it never exceeds screen width
                }}
            >
                <div className="drag-handle flex justify-between items-center p-4 pb-2 cursor-move border-b border-gray-500/20">
                    <div className="flex items-center gap-2 overflow-hidden w-full max-w-[200px]">
                        <Activity size={14} className="shrink-0" style={{ color: isLocked ? LOG_LEVELS.success.color : LOG_LEVELS.info.color }} />
                        <span className="font-black text-xs font-mono tracking-tighter truncate">
                            {agent.displayId || agent.id}
                        </span>
                        {(agent as any).provider === 'gemini' && (
                            (agent as any).state?.isTactical ? (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/50 rounded animate-pulse font-bold">
                                    TACTICAL
                                </span>
                            ) : (
                                <span className="ml-1 text-[10px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                    AI
                                </span>
                            )
                        )}
                        {isPaused && <Pause size={10} className="animate-pulse shrink-0" style={{ color: LOG_LEVELS.system.color }} />}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onClose(); }} 
                        className="hover:text-red-500 transition-colors ml-2 shrink-0 p-1 flex items-center justify-center cursor-pointer rounded-md hover:bg-gray-500/20"
                        aria-label="Close details"
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 pt-2">
                    <div className="mb-3">
                        <AgentMetrics isDark={isDark} agent={agent} />
                    </div>

            <div className="space-y-1.5 text-[10px] font-mono mb-4">
                <div className="flex justify-between items-center">
                    <span className="opacity-50 flex items-center gap-1"><Cpu size={10}/> STATUS</span> 
                    <span 
                        className="font-bold px-1 rounded" 
                        style={{ 
                            color: isPaused ? LOG_LEVELS.system.color : LOG_LEVELS.success.color,
                            backgroundColor: isPaused ? `${LOG_LEVELS.system.color}1A` : `${LOG_LEVELS.success.color}1A`
                        }}
                    >
                        {statusLabel}
                    </span>
                </div>

                {!isCompact && (
                    <>
                        <div className="flex justify-between items-center mt-3">
                            <span className="opacity-50 flex items-center gap-1"><Database size={10}/> PROVIDER</span> 
                            <span className="text-blue-400 font-bold uppercase">{(agent as any).provider || 'MOCK_API'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="opacity-50">MODEL_ID</span> 
                            <span className="text-gray-400 truncate max-w-[110px]">{agent.model || 'DEFAULT'}</span>
                        </div>

                        {(agent as any).state?.temp !== undefined && (
                            <div className="flex justify-between items-center border-t border-gray-500/20 pt-1 mt-1">
                                <span className="opacity-50">Temp</span>
                                <span>{(agent as any).state.temp}°C</span>
                            </div>
                        )}
                        {(agent as any).state?.humidity !== undefined && (
                            <div className="flex justify-between items-center">
                                <span className="opacity-50">Humidity</span>
                                <span>{(agent as any).state.humidity}%</span>
                            </div>
                        )}

                        <div className="flex flex-col mt-2 p-1.5 bg-black/20 rounded">
                            <div className="flex justify-between items-center mb-1">
                                <span className="opacity-50">PERSONA/ROLE</span>
                                <button 
                                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                    className="opacity-70 hover:opacity-100 transition-opacity p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-gray-500/20"
                                    aria-label={isEditing ? 'Save Persona' : 'Edit Persona'}
                                >
                                    {isEditing ? <Save size={14} className="text-emerald-400" /> : <Edit2 size={14} />}
                                </button>
                            </div>
                            {isEditing ? (
                                <textarea 
                                    className={clsx(
                                        "w-full h-20 text-[11px] p-2 rounded resize-none outline-none focus:ring-1 focus:ring-blue-500 custom-scrollbar",
                                        isDark ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"
                                    )}
                                    value={editPersona}
                                    onChange={(e) => setEditPersona(e.target.value)}
                                    aria-label="Persona content input"
                                />
                            ) : (
                                <span className="text-gray-300 break-words whitespace-pre-wrap leading-tight text-[11px] max-h-24 overflow-y-auto custom-scrollbar p-1">
                                    {agent.persona || agent.systemPrompt || 'No persona assigned'}
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>
            
                    <div className="pt-3 border-t border-gray-500/20 mt-auto flex justify-end w-full">
                        <AgentActionButtons 
                            agent={agent} 
                            state={state}
                            onTogglePriority={togglePriority}
                            onTogglePause={onTogglePause}
                            onTerminate={terminateAgent}
                            onTransferLock={onTransferLock}
                            layout="compact"
                            showLabels={false}
                            tooltipPosition="top"
                        />
                    </div>
                </div>
            </div>
        </Draggable>
    );
};
