// src/components/sidebar/SidebarControlPanel.tsx
import React from 'react';
import clsx from 'clsx';
import { Unlock, Lock } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { AIControlGroup } from '@/components/command/AIControlGroup';

export const SidebarControlPanel = () => {
    const { state, triggerOverride, releaseLock } = useATC();
    const { isDark } = useUI();
    const [isOverrideLoading, setIsOverrideLoading] = React.useState(false);
    
    const isHuman = (state.holder && state.holder.includes('Human')) || state.overrideSignal;

    const handleOverride = async () => {
        if (isOverrideLoading || isHuman) return;
        setIsOverrideLoading(true);
        try {
            await triggerOverride();
        } finally {
            setIsOverrideLoading(false);
        }
    };

    return (
        <div className={clsx(
            "p-2 border-b z-20 relative shrink-0 flex gap-1.5 h-20 items-center",
            isDark ? "border-gray-800 bg-gray-900/50" : "border-slate-200 bg-slate-50/50"
        )}>
            <AIControlGroup variant="sidebar" />
            
            {/* EMERGENCY TAKEOVER */}
            <div className="flex-1 h-[60px]">
                <Tooltip content={isHuman ? "Release Control" : "Force Takeover"} position="bottom" className="w-full h-full">
                    <button onClick={isHuman ? releaseLock : handleOverride} disabled={isOverrideLoading}
                        className={clsx(
                            "w-full h-full rounded-lg font-bold text-[10px] flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 uppercase border",
                            isHuman ? "bg-emerald-500 border-emerald-400 text-white" : "bg-red-500 border-red-400 text-white",
                            isOverrideLoading && "opacity-50 cursor-wait"
                        )}>
                        {isOverrideLoading ? (
                             <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            isHuman ? <Unlock size={14} /> : <Lock size={14} />
                        )}
                        <span className="tracking-tighter">{isHuman ? "Release" : "Takeover"}</span>
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};