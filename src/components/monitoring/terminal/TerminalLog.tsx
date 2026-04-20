// src/components/monitoring/terminal/TerminalLog.tsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Draggable from 'react-draggable';
import clsx from 'clsx';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { LogItem } from '@/components/common/LogItem';
import { matchLogType, THEME_COLORS } from './terminalConfigs';
import { useTerminalScroll } from '@/hooks/system/useTerminalScroll';
import { useCommandCenter } from '@/hooks/system/useCommandCenter';
import { TerminalHeader } from './TerminalHeader';
import { TerminalFilterBar } from './TerminalFilterBar';
import { ATC_CONFIG } from '@/constants/atcConfig';

export const TerminalLog = () => {
  const logs = useATCStore(s => s.state.logs);
  const agents = useATCStore(s => s.agents);
  const isAdminMuted = useATCStore(s => s.isAdminMuted);
  const toggleAdminMute = useATCStore(s => s.toggleAdminMute);
  const isAiMode = useATCStore(s => s.isAiMode);

  // 윈도우 사이즈 변경 시 Draggable position 리셋을 위해 key 변경용 state 추가
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
      const handleResizeWindow = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResizeWindow);
      return () => window.removeEventListener('resize', handleResizeWindow);
  }, []);
  
  const isDark = useUIStore(s => s.isDark);
  const sidebarWidth = useUIStore(s => s.sidebarWidth);
  const isTerminalOpen = useUIStore(s => s.isTerminalOpen);
  const { streamingText } = useCommandCenter();
  
  const [filter, setFilter] = useState('ALL');
  const [excludedTypes, setExcludedTypes] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 520, height: 260 });

  const nodeRef = useRef<HTMLDivElement>(null);

  const [isResizing, setIsResizing] = useState(false);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    setDimensions({
      width: Math.max(230, e.clientX - rect.left),
      height: Math.max(140, e.clientY - rect.top)
    });
  }, []);

  useEffect(() => {
    const stopResizing = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'default';
    };
  }, [isResizing, handleResize]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'nwse-resize';
  };

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {
      'USER': 'USER',
      'SYSTEM': 'SYSTEM',
      'ADMIN': 'ADMIN'
    };
    agents.forEach(a => {
      if (a.uuid) {
        map[a.uuid] = a.displayName || a.id;
      }
    });
    return map;
  }, [agents]);

  const filteredLogs = useMemo(() => {
    const baseFiltered = filter === 'ALL' ? (logs || []) : (logs || []).filter(l => matchLogType(l.type as string, filter));

    let results = baseFiltered;
    if (excludedTypes.length > 0) {
      results = baseFiltered.filter(l => {
        const isExcluded = excludedTypes.some(v => matchLogType(l.type as string, v));
        const isCurrentFilter = filter !== 'ALL' && matchLogType(l.type as string, filter);
        return isCurrentFilter || !isExcluded;
      });
    }
    
    // Memoize the UUID replacements to avoid expensive string operations on every render
    return results.slice(-ATC_CONFIG.LOGS.MAX_DISPLAY).map(log => {
      let cleanMessage = log.message;
      Object.entries(agentNameMap).forEach(([uuid, name]) => {
        if (uuid && uuid !== 'SYSTEM' && uuid !== 'USER' && uuid !== 'ADMIN') {
          cleanMessage = cleanMessage.split(uuid).join(name);
        }
      });
      return { ...log, cleanMessage };
    });
  }, [logs, filter, excludedTypes, agentNameMap]);

  const lastLogId = filteredLogs.length > 0 ? filteredLogs[filteredLogs.length - 1].id : null;
  const { scrollRef, autoScroll, setAutoScroll, handleScroll } = useTerminalScroll(lastLogId, isCollapsed, streamingText);

  const currentTheme = (isAiMode || filter === 'insight') ? THEME_COLORS.insight : 
                       filter === 'proposal' ? THEME_COLORS.proposal : 
                       filter === 'exec' ? THEME_COLORS.exec : null;

  if (!isTerminalOpen) return null;

  return (
    <Draggable key={windowWidth} nodeRef={nodeRef} handle=".handle" bounds="body" disabled={windowWidth < 768}>
      <div 
        ref={nodeRef} 
        className={clsx(
          "fixed z-50 flex flex-col font-mono pointer-events-auto touch-none transition-[width,height,filter,box-shadow]",
          windowWidth < 768 && "!bottom-[120px] !top-auto !left-2 !right-2 !w-auto !rounded-2xl ![transform:none]"
        )}
        style={
          windowWidth < 768 ? {
            height: isCollapsed ? '40px' : '35vh',
            filter: currentTheme ? `drop-shadow(0 0 15px ${currentTheme.glow})` : 'none'
          } : { 
            left: `calc(100vw - ${sidebarWidth + 560}px)`, 
            top: 'calc(100vh - 320px)',
            width: isCollapsed ? '240px' : `${dimensions.width}px`,
            height: isCollapsed ? '40px' : `${dimensions.height}px`,
            filter: currentTheme ? `drop-shadow(0 0 15px ${currentTheme.glow})` : 'none'
          }
        }
      >
        <div className={clsx(
          "relative h-full w-full border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden terminal-log-container",
          windowWidth < 768 ? "rounded-2xl" : "rounded-lg",
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
                style={{ overflowAnchor: 'none' }}
              >
                <div className="flex flex-col w-full min-h-full">
                  {filteredLogs.map((log) => (
                    <LogItem 
                      key={log.id} log={log} isDark={isDark} 
                      displayMessage={
                          log.agentId && log.agentId !== 'SYSTEM' && log.agentName
                            ? `[${log.agentName}] ${log.cleanMessage}`
                            : log.cleanMessage
                      }
                    />
                  ))}
                  
                  {streamingText && (
                    <LogItem 
                      key="streaming-log"
                      log={{ id: 'streaming-log', type: 'insight', timestamp: 0, message: streamingText }}
                      isDark={isDark}
                      displayMessage={streamingText}
                    />
                  )}
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