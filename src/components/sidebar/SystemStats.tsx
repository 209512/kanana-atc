import React, { useState, useMemo, useRef, useEffect, Suspense, lazy } from 'react'; 
import clsx from 'clsx';
import { Cpu, Radio, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '@/components/common/Tooltip';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';

const Radar = lazy(() => import('@/components/monitoring/radar').then(module => ({ default: module.Radar })));

export const SystemStats = () => {
    const state = useATCStore(s => s.state);
    const playClick = useATCStore(s => s.playClick);
    const playAlert = useATCStore(s => s.playAlert);
    
    const { scaleAgents } = useAgentMutations();

    const isDark = useUIStore(s => s.isDark);
    const viewMode = useUIStore(s => s.viewMode);
    const setViewMode = useUIStore(s => s.setViewMode);
    const [isBouncing, setIsBouncing] = useState(false);
    const bounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (bounceTimer.current) clearTimeout(bounceTimer.current);
        };
    }, []);

    const priorityAgentsCount = useMemo(() => (state.priorityAgents || []).length, [state.priorityAgents]);
    const minRequired = Math.max(1, priorityAgentsCount);
    const currentValue = useATCStore(s => s.agents).length || 1;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        if (val < minRequired) {
            setIsBouncing(true);
            playAlert?.();
            scaleAgents.mutate(minRequired);
            if (bounceTimer.current) clearTimeout(bounceTimer.current);
            bounceTimer.current = setTimeout(() => setIsBouncing(false), 300);
        } else {
            scaleAgents.mutate(val);
        }
    };

    const toggleView = () => {
        playClick?.();
        setViewMode((prev) => prev === 'attached' ? 'detached' : 'attached');
    };

    return (
        <div className="space-y-6 min-w-0 select-none overflow-hidden">
            <div className="space-y-3 min-w-0 flex flex-col h-[74px]">
                <div className={clsx(
                    "flex items-center gap-2 px-1 h-4 whitespace-nowrap",
                    isDark ? "text-gray-500" : "text-slate-400"
                )}>
                    <Cpu size={12} className="shrink-0" />
            
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] shrink-0">
                        <Tooltip content="Traffic Capacity Management" position="bottom">Congestion</Tooltip>
                    </div>

                    <div className="flex-1" />
                    <AnimatePresence>
                        {currentValue <= minRequired && priorityAgentsCount > 0 && (
                            <motion.span 
                                initial={{ opacity: 0, x: 5 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0 }}
                                className="text-[9px] text-amber-500 font-bold flex items-center gap-1 shrink-0"
                            >
                                <AlertTriangle size={10} /> PRIORITY_RESERVED
                            </motion.span>
                        )}
                    </AnimatePresence>
                    
                    <div className="shrink-0">
                        <Tooltip content={`Active Slots: ${currentValue}`} position="bottom-left">
                            <span className={clsx(
                                "text-xs font-mono font-bold cursor-default", 
                                isDark ? "text-blue-400" : "text-blue-600"
                            )}>
                                {currentValue} / 20
                            </span>
                        </Tooltip>
                    </div>
                </div>

                <div className="px-1 flex flex-col justify-center grow">
                    <motion.div animate={isBouncing ? { x: [0, -4, 4, -2, 2, 0] } : {}} className="w-full">
                        <input 
                            type="range" min="1" max="20" step="1"
                            value={currentValue}
                            onChange={handleSliderChange}
                            className={clsx(
                                "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all",
                                isDark ? "bg-gray-800" : "bg-gray-200"
                            )}
                        />
                    </motion.div>
                    <div className={clsx("flex justify-between text-[8px] font-mono mt-1 opacity-50 shrink-0 whitespace-nowrap", isDark ? "text-gray-400" : "text-slate-500")}>
                        <span>MIN: 1</span>
                        <span>MAX: 20</span>
                    </div>
                </div>
            </div>

            <div className="space-y-3 min-w-0 flex flex-col">
                <div className="flex justify-between items-center min-w-0 px-1 h-5 overflow-hidden">
                    <label className={clsx("text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 min-w-0 shrink-0 whitespace-nowrap", isDark ? "text-gray-500" : "text-slate-400")}>
                        <Radio size={12} className="shrink-0" />
                        <Tooltip content="Mini-Radar Monitoring" position="bottom">Sector_Scan</Tooltip>
                    </label>
                    <Tooltip content={viewMode === 'attached' ? "Expand to Main View" : "Dock to Sidebar"} position="bottom-left">
                        <button onClick={toggleView} className={clsx("text-[9px] px-2 py-0.5 rounded border transition-all font-bold tracking-tighter shrink-0 ml-2", viewMode === 'detached' ? "bg-blue-500 text-white border-blue-600 shadow-sm" : (isDark ? "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"))}>
                            {viewMode === 'attached' ? 'DETACH' : 'ATTACH'}
                        </button>
                    </Tooltip>
                </div>
                <div className={clsx("h-48 rounded-lg overflow-hidden border relative transition-all duration-500 shrink-0", isDark ? "border-gray-800 bg-black/40" : "border-slate-200 bg-slate-100/50")}>
                    {viewMode === 'attached' ? (
                        <Suspense fallback={<div className="w-full h-full bg-black/40 flex items-center justify-center text-[10px] text-white/50 font-mono">LOADING_RADAR...</div>}>
                            <Radar compact={true} key="sidebar-radar" />
                        </Suspense>
                    ) : (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                            <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Externalized</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
