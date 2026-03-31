// src/components/monitoring/terminal/TerminalLog.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Draggable from 'react-draggable';
import clsx from 'clsx';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { LogItem } from '@/components/common/LogItem';
import { matchLogType, THEME_COLORS } from './terminalConfigs';
import { useTerminalScroll } from '@/hooks/system/useTerminalScroll';
import { TerminalHeader } from './TerminalHeader';
import { TerminalFilterBar } from './TerminalFilterBar';

export const TerminalLog = () => {
  const { state, agents, isAdminMuted, toggleAdminMute, isAiMode } = useATC();
  const { isDark, sidebarWidth } = useUI();
  
  const [filter, setFilter] = useState('ALL');
  const [excludedTypes, setExcludedTypes] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 520, height: 260 });

  const nodeRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    setDimensions({
      width: Math.max(230, e.clientX - rect.left),
      height: Math.max(140, e.clientY - rect.top)
    });
  }, []);

  const stopResizing = useCallback(() => {
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, [handleResize]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'nwse-resize';
  };

  const filteredLogs = useMemo(() => {
    let logs = state?.logs || [];
    const baseFiltered = filter === 'ALL' ? logs : logs.filter(l => matchLogType(l.type as string, filter));

    if (excludedTypes.length > 0) {
      return baseFiltered.filter(l => {
        const isExcluded = excludedTypes.some(v => matchLogType(l.type as string, v));
        const isCurrentFilter = filter !== 'ALL' && matchLogType(l.type as string, filter);
        return isCurrentFilter || !isExcluded;
      }).slice(-200);
    }
    return baseFiltered.slice(-200);
  }, [state?.logs, filter, excludedTypes]);

  const { scrollRef, autoScroll, setAutoScroll, handleScroll } = useTerminalScroll([filteredLogs.length], isCollapsed);

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {
      'USER': 'USER',
      'SYSTEM': 'SYSTEM',
      'ADMIN': 'ADMIN'
    };
    agents.forEach(a => {
      const name = a.displayName || a.id || 'UNKNOWN';
      if (a.uuid) map[a.uuid] = name;
      if (a.id) map[a.id] = name;
      if (a.displayName) map[a.displayName] = name;
    });
    return map;
  }, [agents]);

  const currentTheme = (isAiMode || filter === 'insight') ? THEME_COLORS.insight : 
                       filter === 'proposal' ? THEME_COLORS.proposal : 
                       filter === 'exec' ? THEME_COLORS.exec : null;

  return (
    <Draggable nodeRef={nodeRef} handle=".handle" bounds="body">
      <div 
        ref={nodeRef} 
        className="fixed z-50 flex flex-col font-mono pointer-events-auto touch-none"
        style={{ 
          left: `calc(100vw - ${sidebarWidth + 560}px)`, 
          top: 'calc(100vh - 320px)',
          width: isCollapsed ? '240px' : `${dimensions.width}px`,
          height: isCollapsed ? '40px' : `${dimensions.height}px`,
          transition: 'width 0s, height 0s, filter 0.3s ease',
          filter: currentTheme ? `drop-shadow(0 0 15px ${currentTheme.glow})` : 'none'
        }}
      >
        <div className={clsx(
          "relative h-full w-full rounded-lg border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden",
          isDark ? "bg-[#0d1117]/95 border-gray-800 text-gray-300" : "bg-white/95 border-slate-300 text-slate-900"
        )}>
          <TerminalHeader 
            isDark={isDark} filter={filter} isAiMode={isAiMode} isCollapsed={isCollapsed}
            autoScroll={autoScroll} isAdminMuted={isAdminMuted}
            setFilter={setFilter} setIsCollapsed={setIsCollapsed} setAutoScroll={setAutoScroll}
            toggleAdminMute={toggleAdminMute} saveLogs={() => {}}
          />

          {!isCollapsed && (
            <div className={clsx(
              "flex flex-1 overflow-hidden relative gap-[1px]",
              isDark ? "bg-white/5" : "bg-slate-200"
            )}>
              <TerminalFilterBar 
                isDark={isDark}
                filter={filter} 
                excludedTypes={excludedTypes}
                onFilterClick={setFilter}
                onFilterDoubleClick={(val) => setExcludedTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
              />

              <div 
                ref={scrollRef} 
                onScroll={handleScroll}
                className={clsx(
                  "flex-1 overflow-y-auto custom-scrollbar select-text transition-none", 
                  isDark ? "bg-[#0d1117]" : "bg-slate-50"
                )}
              >
                <div className="flex flex-col w-full min-h-full">
                  {filteredLogs.map((log) => (
                    <LogItem 
                      key={log.id} log={log} isDark={isDark} 
                      displayMessage={
                          log.agentId && log.agentId !== 'SYSTEM' 
                            ? `[${agentNameMap[log.agentId] || log.agentId}] ${log.message}`
                            : log.message
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="absolute right-0 top-0 w-1 h-full cursor-ew-resize hover:bg-blue-500/20" onMouseDown={startResizing} />
              <div className="absolute left-0 bottom-0 w-full h-1 cursor-ns-resize hover:bg-blue-500/20" onMouseDown={startResizing} />
              <div className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-10 flex items-end justify-end p-0.5" onMouseDown={startResizing}>
                <div className={clsx("w-2 h-2 border-r-2 border-b-2 opacity-30", isDark ? "border-gray-500" : "border-slate-400")} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Draggable>
  );
};