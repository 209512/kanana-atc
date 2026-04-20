// src/components/monitoring/queue/QueueAgentRow.tsx
import React, { memo } from 'react';
import clsx from 'clsx';
import { Activity, Star, Zap } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { getAgentCardStyle, getAgentTextStyle } from '@/utils/agentStyles';
import { Agent, ATCState } from '@/contexts/atcTypes';

interface AgentRowProps {
  agent: Agent;
  index: number;
  type: 'master' | 'priority' | 'queue';
  isDark: boolean;
  state: ATCState;
  aiProposed: boolean;
}

export const AgentRow = memo(({ 
  agent, 
  index, 
  type, 
  isDark, 
  state, 
  aiProposed 
}: AgentRowProps) => {
  const isMaster = type === 'master';
  const isPriority = type === 'priority';

  return (
    <div className={clsx(
      "flex items-center justify-between border rounded-sm transition-all duration-200",
      isMaster ? "p-2" : "p-1.5",
      getAgentCardStyle({
        isForced: state.forcedCandidate === agent.id,
        isLocked: isMaster,
        isPaused: agent.status === 'paused',
        isPriority: isPriority || isMaster,
        isSelected: false,
        isDark,
        overrideSignal: state.overrideSignal,
        globalStop: state.globalStop,
        isAiProposed: aiProposed
      })
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {aiProposed ? (
          <Activity size={10} className="text-sky-400 animate-pulse fill-current shrink-0" />
        ) : (
          isMaster ? (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          ) : (
            <span className="opacity-40 text-[8px] shrink-0">
              {type === 'priority' ? 'P' : 'Q'}-{index + 1}
            </span>
          )
        )}
        
        <span className={clsx(
          "font-mono truncate max-w-[120px]", 
          isMaster && "text-emerald-500 font-bold",
          getAgentTextStyle({
            isForced: (state as any).forcedCandidate === agent.id,
            isLocked: isMaster,
            isDark,
            overrideSignal: (state as any).overrideSignal
          })
        )}>
          {agent.displayId || agent.id}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {aiProposed && <div className="w-1 h-1 rounded-full bg-sky-500 animate-ping" />}
        
        {isMaster ? (
          <Tooltip content="System Lock Active" position="left">
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold cursor-default">
              LOCK_HELD
            </span>
          </Tooltip>
        ) : (
          <>
            {isPriority && <Star size={10} className="text-yellow-500 fill-current" />}
            {agent.id === state.forcedCandidate && (
              <Zap size={10} className="text-purple-500 animate-pulse" />
            )}
          </>
        )}
      </div>
    </div>
  );
});

AgentRow.displayName = 'AgentRow';