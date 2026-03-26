// src/components/sidebar/SidebarHeader.tsx
import React from 'react';
import clsx from 'clsx';
import { ShieldAlert, Activity, Settings } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';

export const SidebarHeader = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
    const { state } = useATC();
    const { isDark, setIsDark } = useUI();
    const isHuman = state.holder && state.holder.includes('Human');
    
    return (
        <div className={clsx(
            "p-4 border-b flex justify-between items-center transition-colors duration-500 min-w-0 shrink-0",
            isHuman ? "bg-red-500/10 border-red-500/30" : (isDark ? "border-gray-800" : "border-slate-200/40")
        )}>
            <div className="flex items-center gap-3">
                <div className={clsx("p-2 rounded-lg min-w-0", isHuman ? "bg-red-500 text-white animate-pulse" : (isDark ? "bg-gray-800 text-blue-400" : "bg-white text-blue-600 shadow-sm"))}>
                    {isHuman ? <ShieldAlert size={20} /> : <Activity size={20} />}
                </div>
                <div className="min-w-0">
                    <h2 className="font-bold text-sm tracking-wide min-w-0">
                        <Tooltip content="Main Control Panel" position="bottom">
                            TRAFFIC CONTROL
                        </Tooltip>
                    </h2>
                    <div className="flex items-center gap-2 text-[10px] opacity-60 font-mono min-w-0">
                        <span className={clsx("w-1.5 h-1.5 rounded-full", isHuman ? "bg-red-500" : "bg-emerald-500")}></span>
                        {isHuman ? "MANUAL OVERRIDE" : "AUTONOMOUS"}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 min-w-0">
                <Tooltip content="Toggle Theme" position="bottom">
                    <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-md hover:bg-white/10">
                        {isDark ? "🌙" : "☀️"}
                    </button>
                </Tooltip>
                <Tooltip content="System Settings" position="bottom">
                    <button onClick={onOpenSettings} className="p-2 rounded-md hover:bg-blue-500/20">
                        <Settings size={16} />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};