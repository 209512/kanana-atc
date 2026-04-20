// src/components/command/ProposalBanner.tsx
import React from 'react';
import { useATCStore } from '@/store/useATCStore';
import { AlertTriangle, Check, X, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '@/store/useUIStore';
import { THEME_COLORS } from '@/components/monitoring/terminal/terminalConfigs';

export const ProposalBanner = () => {
    const isDark = useUIStore(s => s.isDark);
    const { pendingProposals, approveProposals, rejectProposals, agents } = useATCStore();

    if (!pendingProposals || pendingProposals.size === 0) return null;
    
    const primaryProposal = Array.from(pendingProposals.values())[0];
    const theme = THEME_COLORS.proposal;

    const targetAgent = agents?.find(a => {
        const searchId = primaryProposal.targetId?.trim().toUpperCase();
        return a.uuid.toUpperCase() === searchId || 
              (a.displayName && a.displayName.toUpperCase() === searchId) ||
              a.id.toUpperCase() === searchId;
    });

    const displayName = primaryProposal.targetId === 'SYSTEM' 
        ? '🚨 SYSTEM_GLOBAL' 
        : (targetAgent?.displayName || primaryProposal.targetId);
    
    return (
        <div data-testid="proposal-banner" className="w-[450px] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div 
                className={clsx(
                    "border rounded-xl overflow-hidden backdrop-blur-md transition-all duration-300",
                    isDark ? "bg-zinc-900/95" : "bg-white/95",
                    theme.border 
                )}
                style={{ boxShadow: `0 0 30px ${theme.glow}` }} 
            >
                {/* 헤더 섹션 */}
                <div className={clsx(
                    "px-4 py-2 border-b flex items-center justify-between",
                    theme.bg,
                    isDark ? "border-white/10" : "border-black/5"
                )}>
                    <div className={clsx("flex items-center gap-2", theme.base)}>
                        <Zap size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black tracking-widest uppercase">AI Strategic Proposal</span>
                    </div>
                </div>

                {/* 본문 섹션 */}
                <div className="p-4 flex gap-4">
                    <div className={clsx(
                        "rounded-lg p-3 flex items-center justify-center shrink-0",
                        theme.bg
                    )}>
                        <AlertTriangle className={theme.base} size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className={clsx(
                            "text-xs font-bold mb-1",
                            isDark ? "text-white" : "text-slate-900"
                        )}>
                            {primaryProposal.action} REQUEST: 
                            <span className={clsx("font-black ml-1 uppercase", theme.base)}>{displayName}</span>
                        </h4>
                        <p className={clsx(
                            "text-[10px] leading-relaxed italic",
                            isDark ? "text-zinc-400" : "text-slate-500"
                        )}>
                            "{primaryProposal.reason}"
                        </p>
                    </div>
                </div>

                {/* 액션 버튼 */}
                <div className={clsx("grid grid-cols-2 border-t", isDark ? "border-white/5" : "border-slate-100")}>
                    <button data-testid="proposal-ignore-btn" onClick={rejectProposals} className="py-3 text-[11px] font-bold text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-colors flex items-center justify-center gap-2">
                        <X size={14} /> IGNORE
                    </button>
                    <button data-testid="proposal-authorize-btn" onClick={approveProposals} className={clsx(
                        "py-3 text-[11px] font-bold transition-colors flex items-center justify-center gap-2 border-l",
                        theme.base,
                        isDark ? "border-white/5 hover:bg-white/5" : "border-slate-100 hover:bg-black/5"
                    )}>
                        <Check size={14} /> AUTHORIZE EXECUTION
                    </button>
                </div>
            </div>
        </div>
    );
};