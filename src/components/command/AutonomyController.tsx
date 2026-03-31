// src/components/command/AutonomyController.tsx
import { useATC } from '@/hooks/system/useATC';

export const AutonomyController: React.FC = () => {
  const { state, autonomyLevel, riskScore } = useATC();

  return (
    <div className="p-4 bg-black/60 border-b border-blue-500/20 backdrop-blur-md">
      <div className="flex justify-between items-end mb-3 font-mono">
        <div>
          <p className="text-[10px] text-blue-400/60 uppercase tracking-widest">Control Mode</p>
          <h2 className={`text-lg font-bold ${autonomyLevel > 80 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
            {autonomyLevel > 80 ? '⚠️ AI_EMERGENCY' : '🛡️ HUMAN_ASSIST'}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500">SYSTEM_RISK</p>
          <p className="text-xl font-black text-white">{riskScore}%</p>
        </div>
      </div>

      <div className="relative h-2 w-full bg-gray-900 rounded-full">
        <div 
          className={`absolute h-full transition-all duration-500 rounded-full ${
            autonomyLevel > 80 ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-blue-600'
          }`}
          style={{ width: `${autonomyLevel}%` }}
        />
        {/* 임계점 마커 */}
        <div className="absolute left-[80%] top-0 h-full w-0.5 bg-white/20" />
      </div>

      {state.handoverTarget && (
        <div className="mt-3 p-2 bg-red-900/30 border border-red-500/50 rounded animate-bounce">
          <p className="text-[10px] text-red-200 font-bold">🚨 AI FAIL_SAFE: MANUAL OVERRIDE REQUIRED</p>
        </div>
      )}
    </div>
  );
};