// src/components/monitoring/terminal/TerminalHeader.tsx
import React from 'react';
import clsx from 'clsx';
import { Brain, Lightbulb, Activity, Save, ArrowDownCircle, VolumeX, Volume2, ChevronDown } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { THEME_COLORS } from './terminalConfigs';

interface TerminalHeaderProps {
  isDark: boolean; filter: string; isAiMode: boolean; isCollapsed: boolean; autoScroll: boolean; isAdminMuted: boolean;
  setFilter: (f: string) => void; setIsCollapsed: (c: boolean) => void; setAutoScroll: (a: boolean) => void;
  toggleAdminMute: () => void; saveLogs: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  isDark, filter, isAiMode, isCollapsed, autoScroll, isAdminMuted,
  setFilter, setIsCollapsed, setAutoScroll, toggleAdminMute, saveLogs
}) => {
  const theme = (isAiMode || filter === 'insight') ? THEME_COLORS.insight : 
                filter === 'proposal' ? THEME_COLORS.proposal : 
                filter === 'exec' ? THEME_COLORS.exec : null;

  return (
    <div className={clsx("flex justify-between items-center p-2 border-b handle cursor-move h-10 shrink-0 w-full select-none", isDark ? "bg-gray-800/20 border-gray-800" : "bg-white/40 border-slate-200/40")}>
      <div className="flex items-center gap-3 min-w-0 overflow-hidden shrink">
        <div className="relative flex items-center justify-center p-1 shrink-0">
          <span 
            className={clsx(
              "w-2.5 h-2.5 rounded-full transition-all duration-500", 
              theme ? "animate-pulse" : "bg-blue-500"
            )}
            style={{ 
              backgroundColor: theme ? theme.hex : undefined,
              boxShadow: theme ? `0 0 8px ${theme.hex}` : undefined 
            }}
          ></span>
        </div>
        <Tooltip content={isAiMode ? "AI Controller Active" : "Tactical Operations Stream"} position="bottom">
          <span className={clsx("font-bold tracking-[0.1em] uppercase text-[10px] truncate", theme ? theme.base : "text-current")}>
            {isAiMode ? "AI_AUTOPILOT" : filter === 'insight' ? "AI_ANALYSIS" : filter === 'proposal' ? "AI_PROPOSALS" : filter === 'exec' ? "AI_EXECUTION" : "TERMINAL"}
          </span>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-2">
        {!isCollapsed && (
          <div className="hidden sm:flex items-center gap-1">
            <Tooltip content="AI Insights" position="bottom">
              <button 
                onClick={() => setFilter(filter === 'insight' ? 'ALL' : 'insight')} 
                className={clsx("p-1.5 rounded-md border transition-all", filter === 'insight' ? THEME_COLORS.insight.full : "border-transparent text-gray-500 hover:text-sky-400")}
              >
                <Brain size={13} />
              </button>
            </Tooltip>
            <Tooltip content="AI Proposals" position="bottom">
              <button 
                onClick={() => setFilter(filter === 'proposal' ? 'ALL' : 'proposal')} 
                className={clsx("p-1.5 rounded-md border transition-all", filter === 'proposal' ? THEME_COLORS.proposal.full : "border-transparent text-gray-500 hover:text-amber-400")}
              >
                <Lightbulb size={13} />
              </button>
            </Tooltip>
            <Tooltip content="AI Executions" position="bottom">
              <button 
                onClick={() => setFilter(filter === 'exec' ? 'ALL' : 'exec')} 
                className={clsx("p-1.5 rounded-md border transition-all", filter === 'exec' ? THEME_COLORS.exec.full : "border-transparent text-gray-500 hover:text-indigo-400")}
              >
                <Activity size={13} />
              </button>
            </Tooltip>
            
            <div className="w-[1px] h-3 bg-gray-700/50 mx-0.5" />
            
            <Tooltip content="Save Logs" position="bottom">
              <button onClick={saveLogs} className="p-1.5 rounded hover:bg-white/10 text-gray-500"><Save size={13} /></button>
            </Tooltip>
            <Tooltip content={autoScroll ? "Disable Auto-scroll" : "Enable Auto-scroll"} position="bottom">
              <button onClick={() => setAutoScroll(!autoScroll)} className={clsx("p-1.5 rounded", autoScroll ? "text-green-500" : "text-gray-500")}><ArrowDownCircle size={13} /></button>
            </Tooltip>
            <Tooltip content={isAdminMuted ? "Unmute" : "Mute"} position="bottom">
              <button onClick={toggleAdminMute} className="p-1.5 rounded text-gray-500 hover:bg-white/10">{isAdminMuted ? <VolumeX size={13} className="text-red-500" /> : <Volume2 size={13} />}</button>
            </Tooltip>
          </div>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }} 
          className="p-1.5 rounded hover:bg-white/10 text-current shrink-0"
        >
          <ChevronDown size={15} className={clsx("transition-transform duration-300", isCollapsed && "rotate-180")} />
        </button>
      </div>
    </div>
  );
};