// src/components/layout/Dashboard.tsx
import React from 'react';
import { Radar } from '@/components/monitoring/radar';
import { ControlTower } from '@/components/layout/ControlTower';
import clsx from 'clsx';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';

export const Dashboard = () => {
  const { state } = useATC();
  const { isDark, viewMode } = useUI();

  return (
    <main className={clsx(
        "flex-1 min-w-0 relative flex flex-col h-full overflow-hidden transition-colors duration-500",
        isDark ? "bg-[#050505]" : "bg-slate-100"
    )}>
      {/* 상단 시스템 정보 */}
      <div className="absolute top-4 left-6 z-10 pointer-events-none select-none">
        <h1 className={clsx("text-4xl font-black tracking-tighter uppercase transition-colors duration-500", 
          isDark ? "text-white/30" : "text-slate-900/30"
        )}>
          ATC // <span className="text-red-500">TRAFFIC</span>
        </h1>
        <div className="flex items-center gap-3 mt-1 opacity-60 font-mono text-[10px]">
          <span className={clsx("w-2 h-2 rounded-full animate-pulse", 
            state.overrideSignal ? "bg-red-500" : "bg-emerald-500"
          )}></span>
          <span className="font-bold uppercase">System: {state.overrideSignal ? "Override Active" : "Nominal"}</span>
          <span className="opacity-30">|</span>
          <span>LAT: {state.latency}ms</span>
        </div>
      </div>

      {/* 레이더 캔버스 영역 */}
      <div className="flex-1 w-full h-full relative z-[1]">
        {viewMode === 'detached' && (
          <div className={clsx(
            "absolute inset-0 transition-opacity duration-500 pointer-events-auto",
            "opacity-100"
          )}>
            <Radar isMainView={true} key={isDark ? 'dark-radar' : 'light-radar'} /> 
          </div>
        )}

        {/* 대기 모드 오버레이: attached 모드일 때만 활성화 */}
        {viewMode === 'attached' && (
          <div className={clsx(
            "absolute inset-0 flex flex-col items-center justify-center font-mono transition-all duration-500 bg-black/60 backdrop-blur-sm z-20",
            "opacity-100"
          )}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-blue-400 font-bold tracking-[0.2em] animate-pulse uppercase">Radar Data Externalized</span>
            </div>
          </div>
        )}
      </div>

      {/* 전역 HUD */}
      <ControlTower />
    </main>
  );
};