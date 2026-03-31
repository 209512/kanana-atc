// src/components/monitoring/terminal/TerminalFilterBar.tsx
import React, { useRef } from 'react';
import clsx from 'clsx';
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { LOG_FILTER_CONFIG } from './terminalConfigs';

interface FilterBarProps {
  isDark: boolean;
  filter: string;
  excludedTypes: string[];
  onFilterClick: (val: string) => void;
  onFilterDoubleClick: (val: string) => void;
}

export const TerminalFilterBar = ({ isDark, filter, excludedTypes, onFilterClick, onFilterDoubleClick }: FilterBarProps) => {
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleAction = (val: string, type: 'single' | 'double') => {
    if (type === 'double') {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      onFilterDoubleClick(val);
    } else {
      if (clickTimer.current) return;
      clickTimer.current = setTimeout(() => {
        onFilterClick(val);
        clickTimer.current = null;
      }, 150); 
    }
  };

  return (
    <div className={clsx(
      "w-10 flex flex-col items-center py-2 shrink-0 overflow-hidden",
      isDark ? "bg-black/20" : "bg-slate-100"
    )}>
      <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-3">
        <Tooltip 
          content={
            <div className="text-left leading-relaxed">
              Double-click to Blacklist(Except ALL).
              <br />
              Right-click or Drag logs to Copy.
            </div>
          } 
          position="right">
          <Info size={10} className={clsx("mb-1 cursor-help shrink-0", isDark ? "opacity-40" : "opacity-60 text-slate-500")} />
        </Tooltip>

        {LOG_FILTER_CONFIG.map(cfg => {
          if (['insight', 'proposal', 'exec'].includes(cfg.value)) return null;

          const isExcluded = excludedTypes.includes(cfg.value);
          const isActive = filter === cfg.value;
          
          return (
            <Tooltip key={cfg.value} content={`Filter: ${cfg.label}`} position="right">
              <button 
                onClick={() => handleAction(cfg.value, 'single')} 
                onDoubleClick={() => handleAction(cfg.value, 'double')}
                className={clsx(
                  "text-[9px] font-bold w-7 h-7 flex items-center justify-center rounded transition-all relative shrink-0 overflow-hidden", 
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                    : isDark ? "text-gray-500 hover:bg-white/10" : "text-slate-500 hover:bg-slate-200",
                  isExcluded && "opacity-40 grayscale"
                )}>
                <span className={clsx("relative z-10", isExcluded && "text-red-400")}>{cfg.shortcut}</span>
                {isExcluded && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line 
                      x1="10" y1="90" x2="90" y2="10" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      className="text-red-500"
                    />
                  </svg>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};