import React, { useEffect, useState, Suspense } from 'react';
import clsx from 'clsx';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { useUIStore } from '@/store/useUIStore';
import { Dashboard } from '@/components/layout/Dashboard';
import { SidebarContainer } from '@/components/layout/SidebarContainer';
import { WifiOff } from 'lucide-react';
import { ocrService } from '@/utils/ocrService';
import { useATCStore } from '@/store/useATCStore';
import { KananaKeyModal } from '@/components/common/KananaKeyModal';

export const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-[#05090a] text-gray-300 font-mono p-8">
      <h2 className="text-red-500 text-xl font-bold mb-4">[ATC_SYSTEM_FAILURE]</h2>
      <pre className="bg-black/50 p-4 rounded text-sm text-red-400 max-w-2xl overflow-auto border border-red-500/20 mb-6">
        {(error as any)?.message || "Unknown Error"}
      </pre>
      <button 
        onClick={() => {
          
          useATCStore.setState({ 
            isAiMode: false, 
            isAiAutoMode: false, 
            agents: [], 
            state: { 
              logs: [], 
              priorityAgents: [], 
              globalStop: false, 
              forcedCandidate: null, 
              overrideSignal: false, 
              collisionCount: 0, 
              activeAgentCount: 0, 
              latency: 12, 
              trafficIntensity: 2
            } as any, 
            pendingProposals: new Map() 
          });
          resetErrorBoundary();
        }}
        className="px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 rounded transition-all font-bold"
      >
        SYSTEM REBOOT
      </button>
    </div>
  );
};

import { useOfflineArchive } from '@/hooks/system/useOfflineArchive';

const App = () => {
  const { isDark } = useUIStore();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isStarted, setIsStarted] = useState(false);
  const openKananaKeyModal = useUIStore(s => s.openKananaKeyModal);
  const riskLevel = useATCStore(s => s.riskScore || 0);

  useOfflineArchive(); 

  useEffect(() => {
    
    useATCStore.getState().initAuditLogs?.();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // NOTE: Pre-fetch OCR model in background
    setTimeout(() => {
      ocrService.init().catch(e => console.error('Failed to pre-fetch OCR:', e));
    }, 3000); // 3 seconds delay to avoid blocking initial critical UI rendering

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isStarted && !isOffline) {
    return (
      <div className="h-screen w-screen bg-[#05090a] flex flex-col items-center justify-center font-mono text-cyan-500 z-[9999] relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20 pointer-events-none" />
        <h1 className="text-4xl md:text-5xl font-bold mb-8 tracking-[0.2em] animate-pulse drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] text-center">
          KANANA ATC SYSTEM
        </h1>
        <p className="text-sm md:text-base text-cyan-400/70 mb-8 max-w-lg text-center px-4 leading-relaxed">
          AUTHORIZED PERSONNEL ONLY.<br />
          INITIATE CONNECTION TO SYNCHRONIZE GLOBAL RADAR.
        </p>

        <div className="flex flex-col gap-4 w-full max-w-md px-6 z-10">
          <button
            onClick={() => setIsStarted(true)}
            className="w-full px-6 py-4 bg-cyan-500/10 border-2 border-cyan-500 hover:bg-cyan-500 hover:text-[#05090a] transition-all duration-300 text-sm md:text-base font-bold tracking-wider relative group overflow-hidden"
          >
            <span className="relative z-10">SIMULATION MODE</span>
            <div className="absolute inset-0 h-full w-0 bg-cyan-500 transition-all duration-300 ease-out group-hover:w-full z-0" />
          </button>
          <button
            onClick={() => {
              setIsStarted(true);
              queueMicrotask(() => openKananaKeyModal());
            }}
            className="w-full px-6 py-4 bg-cyan-500/10 border-2 border-cyan-500 hover:bg-cyan-500 hover:text-[#05090a] transition-all duration-300 text-sm md:text-base font-bold tracking-wider relative group overflow-hidden"
          >
            <span className="relative z-10">CONNECT WITH AI</span>
            <div className="absolute inset-0 h-full w-0 bg-cyan-500 transition-all duration-300 ease-out group-hover:w-full z-0" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <KananaKeyModal />
      <div className={clsx(
        "h-screen w-screen font-sans relative overflow-hidden select-none", 
        isDark ? "bg-[#05090a] text-gray-300" : "bg-[#f1f5f9] text-slate-800",
        riskLevel > 85 && "emergency-pulse" 
      )}>
        {/* Offline Banner */}
        {isOffline && (
          <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-xs font-bold py-1.5 flex items-center justify-center gap-2 z-[9999] shadow-lg animate-pulse">
            <WifiOff size={14} />
            <span>[NETWORK DISCONNECTED] System is operating in offline mode. Live streams may be delayed or unavailable.</span>
          </div>
        )}

        {/* 1. Main View */}
        <div className="absolute inset-0 bg-[#050505]">
          <Dashboard />
        </div>
        
        {/* 2. Right Sidebar */}
        <div className="absolute top-0 right-0 bottom-0 z-50 h-full pointer-events-none">
          <div className="pointer-events-auto h-full shadow-2xl">
            <SidebarContainer />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default function AppWrapper() {
  return (
    <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center bg-black text-white font-mono text-xs animate-pulse">LOADING SYSTEM...</div>}>
      <App />
    </Suspense>
  );
}
