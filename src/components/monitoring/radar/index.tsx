// src/components/monitoring/radar/index.tsx
import React, { Suspense, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { MousePointer2, Move, ZoomIn } from 'lucide-react';
import clsx from 'clsx';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { UIContext } from '@/contexts/UIProvider'; 
import { AgentDrone } from '@/components/monitoring/radar/AgentDrone';
import { RadarBackground } from '@/components/monitoring/radar/RadarBackground';
import { CentralHub } from '@/components/monitoring/radar/CentralHub';
import { CameraController } from '@/components/monitoring/radar/CameraController';
import { Agent } from '@/contexts/atcTypes';

export const Radar: React.FC<{ compact?: boolean; isMainView?: boolean }> = ({ compact = false, isMainView = false }) => {
    const { agents, state, isAiMode } = useATC();
    const uiValues = useUI();
    const { isDark, selectedAgentId, setSelectedAgentId } = uiValues;

    const selectedAgent = useMemo(() => 
        agents.find((a: Agent) => a.id === selectedAgentId), 
    [agents, selectedAgentId]);

    const isGloballyStopped = !!state?.globalStop;
    const handleCreated = useCallback(({ gl }: any) => {
        gl.domElement.addEventListener('webglcontextlost', (event: any) => {
            event.preventDefault();
            console.warn("[ATC_SYSTEM] WebGL Context Lost. Attempting auto-recovery...");
        }, false);
    }, []);

    const targetPos = useMemo(() => {
        if (!selectedAgent) return null;
        return selectedAgent.position as [number, number, number];
    }, [selectedAgent]);

    return (
        <div 
            className="w-full h-full relative overflow-hidden transition-colors duration-500" 
            style={{ backgroundColor: isDark ? "#050505" : "#f8fafc" }}
        >
            {!compact && (
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md text-[9px] font-mono font-bold transition-all duration-300", 
                        isDark ? "bg-black/40 border-white/10 text-white/60" : "bg-white/60 border-black/5 text-black/60"
                    )}>
                        <div className="flex items-center gap-1.5 border-r border-current pr-2">
                            <MousePointer2 size={10} className="text-blue-500" />
                            <span>L-CLICK: SELECT</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-r border-current pr-2">
                            <ZoomIn size={10} className="text-emerald-500" />
                            <span>SCROLL: ZOOM</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Move size={10} className="text-purple-500" />
                            <span>R-CLICK: PAN</span>
                        </div>
                    </div>
                </div>
            )}

            <Canvas 
                shadows 
                onCreated={handleCreated}
                gl={{ 
                    antialias: false,
                    alpha: true,
                    powerPreference: "high-performance",
                    preserveDrawingBuffer: false,
                    stencil: false
                }} 
                dpr={1}
                onPointerMissed={(e) => { if (e.button === 0) setSelectedAgentId(null); }}
            >
                <UIContext.Provider value={uiValues}>
                    <PerspectiveCamera makeDefault position={[12, 12, 12]} fov={isMainView ? 45 : 60} />
                    <OrbitControls makeDefault enableZoom={true} enablePan={true} maxDistance={60} minDistance={3} enableDamping={true} dampingFactor={0.08} />

                    <CameraController targetPosition={targetPos} />

                    <ambientLight intensity={isDark ? 0.4 : 0.8} />
                    <pointLight position={[10, 15, 10]} intensity={1.5} />

                    <Suspense fallback={null}>
                        <RadarBackground isDark={isDark} />
                        <CentralHub 
                            isLocked={!!state?.holder} 
                            isOverride={!!state?.overrideSignal} 
                            holder={state?.holder || null} 
                            isDark={isDark} 
                            agents={agents}
                            isAiMode={isAiMode}
                        />
                            
                        {agents.map((agent: Agent) => (
                            <AgentDrone
                                key={agent.id}
                                id={agent.id}
                                position={agent.position as [number, number, number]}
                                isLocked={state?.holder === agent.id}
                                isOverride={!!state?.overrideSignal}
                                color={agent.color || '#3b82f6'}
                                onClick={(id) => setSelectedAgentId(id)}
                                isPaused={agent.status === 'paused' || agent.isPaused === true || !!state?.globalStop}
                                isPriority={!!agent.priority}
                            />
                        ))}
                    </Suspense>
                </UIContext.Provider>
            </Canvas>
        </div>
    );
};