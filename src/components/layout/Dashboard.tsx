// src/components/layout/Dashboard.tsx
import React, { Suspense, lazy } from 'react';
import { ControlTower } from '@/components/layout/ControlTower';
import { ProposalBanner } from '@/components/command/ProposalBanner';
import { CommandCenter } from '@/components/command/CommandCenter';
import { MousePointer2, Move, ZoomIn } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';

import { DebugPanel } from '@/components/common/DebugPanel';

const Radar = lazy(() => import('@/components/monitoring/radar').then(module => ({ default: module.Radar })));

export const Dashboard = () => {
  const { t } = useTranslation();
  const overrideSignal = useATCStore(s => s.state.overrideSignal);
  const latency = useATCStore(s => s.state.latency);
  const isDark = useUIStore(s => s.isDark);
  const sidebarWidth = useUIStore(s => s.sidebarWidth);
  const isSidebarCollapsed = useUIStore(s => s.isSidebarCollapsed);
  const isVisualHapticActive = useUIStore(s => s.isVisualHapticActive);

  return (
    <main id="atc-dashboard" className={clsx(
        "relative w-full h-full overflow-hidden transition-colors duration-500",
        isDark ? "bg-[#050505]" : "bg-slate-100",
        isVisualHapticActive && "shadow-[inset_0_0_150px_rgba(239,68,68,0.4)] border-4 border-red-500/50"
    )}>
      {/* 1. 최하단 배경: 레이더 (Z-0) */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="w-full h-full bg-[#050505] animate-pulse"></div>}>
          <Radar isMainView={true} /> 
        </Suspense>
      </div>

      {/* 2. 시스템 HUD (Z-10) */}
      <div className="absolute top-4 left-6 z-10 pointer-events-none select-none opacity-30">
        <h1 className={clsx("text-4xl font-black tracking-tighter uppercase", isDark ? "text-white" : "text-slate-900")}>
          KANANA-ATC // <span className="text-red-500">TRAFFIC</span>
        </h1>
        <div className="flex items-center gap-3 mt-1 font-mono text-[10px]">
          <span className="font-bold">{t('dashboard.system', 'System:')} {overrideSignal ? t('dashboard.override', 'Override') : t('dashboard.nominal', 'Nominal')}</span>
          <span>{t('dashboard.lat', 'LAT:')} {latency}ms</span>
        </div>
      </div>

      {/* 3. 모니터링 창들 (Z-30): TerminalLog, TacticalPanel 등 */}
      <ControlTower />

      {/* 4. 인터랙티브 UI 레이어 (Z-40): 가이드 및 입력창 */}
      <div 
        className="absolute inset-y-0 left-0 z-40 transition-all duration-300 pointer-events-none"
        style={{ right: `${isSidebarCollapsed ? 64 : sidebarWidth}px` }}
      >
        {/* 우측 상단 조작 가이드 */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 transition-all duration-300">
            <div className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md text-[9px] font-mono font-bold transition-all pointer-events-auto", 
                isDark ? "bg-black/40 border-white/10 text-white/60" : "bg-white/60 border-black/5 text-black/60"
            )}>
                <div className="flex items-center gap-1.5 border-r border-current pr-2">
                    <MousePointer2 size={10} className="text-blue-500" />
                    <span>{t('dashboard.lclick', 'L-CLICK: SELECT')}</span>
                </div>
                <div className="flex items-center gap-1.5 border-r border-current pr-2">
                    <ZoomIn size={10} className="text-emerald-500" />
                    <span>{t('dashboard.scroll', 'SCROLL: ZOOM')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Move size={10} className="text-purple-500" />
                    <span>{t('dashboard.rclick', 'R-CLICK: PAN')}</span>
                </div>
            </div>
        </div>

        {/* 중앙 하단: 배너 및 커맨드센터 */}
        <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-4 transition-all duration-300 w-full max-w-2xl mx-auto px-4">
           <div className="pointer-events-auto">
             <ProposalBanner />
           </div>
           <div className="w-full flex justify-center pointer-events-auto">
             <CommandCenter />
           </div>
        </div>
      </div>

      {/* 5. 디버그 패널 (숨겨진 기능) */}
      <DebugPanel />
    </main>
  );
};