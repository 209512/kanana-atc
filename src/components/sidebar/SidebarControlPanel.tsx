// src/components/sidebar/SidebarControlPanel.tsx
import React from 'react';
import clsx from 'clsx';
import { Unlock, Lock } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { AIControlGroup } from '@/components/common/AIControlGroup';

export const SidebarControlPanel = () => {
    const holder = useATCStore(s => s.state.holder);
    const overrideSignal = useATCStore(s => s.state.overrideSignal);
    const { triggerOverride, releaseLock } = useAgentMutations();

    const isDark = useUIStore(s => s.isDark);
    const [isOverrideLoading, setIsOverrideLoading] = React.useState(false);
    
    const isHuman = holder === 'USER' || overrideSignal;

    const handleOverride = async () => {
        if (isOverrideLoading || isHuman) return;
        setIsOverrideLoading(true);
        try {
            await triggerOverride.mutateAsync();
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
                    <button onClick={isHuman ? () => releaseLock.mutate() : handleOverride} disabled={isOverrideLoading}
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