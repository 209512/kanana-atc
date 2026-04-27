import React from 'react';
import { useATCStore } from '@/store/useATCStore';

export const HandoverOverlay: React.FC<{ reason: string, targetId: string }> = ({ reason, targetId }) => {
  const resetHandover = useATCStore(s => s.resetHandover);
  const agents = useATCStore(s => s.agents);
  const targetName = agents.find(a => a.uuid === targetId)?.displayName || targetId;

  return (
    <div className="absolute inset-0 z-[100] bg-red-950/60 backdrop-blur-xl flex items-center justify-center border-4 border-red-600 animate-pulse">
      <div className="text-center p-10 bg-black border-2 border-red-500 shadow-[0_0_100px_rgba(220,38,38,0.8)] max-w-lg">
        <div className="mb-6 inline-block p-4 rounded-full bg-red-600/20 border-2 border-red-500">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-3xl font-black text-red-500 mb-2 tracking-tighter">AI_CONTROL_ABORTED</h2>
        <p className="text-red-200/80 mb-6 font-mono text-sm leading-relaxed">{reason}</p>
        
        <div className="p-5 bg-red-900/30 border border-red-500/40 text-left mb-8">
          <p className="text-[10px] text-red-400 font-bold mb-2 uppercase tracking-widest">Immediate Action Required</p>
          <p className="text-white text-base">System load for agent <span className="text-red-400 font-bold">[{targetName}]</span> has exceeded critical thresholds. Please switch to manual control immediately.</p>
        </div>

        <button 
          onClick={resetHandover}
          className="w-full py-4 bg-red-600 hover:bg-white hover:text-red-600 text-white font-black text-lg transition-all duration-300 shadow-lg active:scale-95"
        >
          I UNDERSTAND, TAKE CONTROL
        </button>
      </div>
    </div>
  );
};