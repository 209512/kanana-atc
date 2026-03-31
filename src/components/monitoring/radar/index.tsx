// src/components/monitoring/radar/index.tsx
import React, { Suspense, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useATC } from '@/hooks/system/useATC';
import { useUI } from '@/hooks/system/useUI';
import { UIContext } from '@/contexts/UIProvider'; 
import { AgentDrone } from '@/components/monitoring/radar/AgentDrone';
import { RadarBackground } from '@/components/monitoring/radar/RadarBackground';
import { CentralHub } from '@/components/monitoring/radar/CentralHub';
import { CameraController } from '@/components/monitoring/radar/CameraController';
import { Agent } from '@/contexts/atcTypes';
import { RADAR_CONFIG } from './radarConfig';

export const Radar: React.FC<{ compact?: boolean; isMainView?: boolean }> = ({ compact = false, isMainView = false }) => {
    const { agents, state, isAiMode, isAdminMuted, togglePause, togglePriority, transferLock, terminateAgent } = useATC();
    const uiValues = useUI();
    const { isDark, selectedAgentId, setSelectedAgentId, viewMode } = uiValues;

    if (isMainView && viewMode === 'attached') return null;
    if (compact && viewMode !== 'attached') return null;

    const actions = useMemo(() => ({
        togglePause, togglePriority, transferLock, terminateAgent
    }), [togglePause, togglePriority, transferLock, terminateAgent]);

    const selectedAgent = useMemo(() => 
        agents.find((a: Agent) => a.id === selectedAgentId), 
    [agents, selectedAgentId]);

    const targetPos = useMemo(() => {
        if (!selectedAgent) return null;
        return selectedAgent.position as [number, number, number];
    }, [selectedAgent]);

    const handleCreated = useCallback(({ gl }: any) => {
        gl.domElement.addEventListener('webglcontextlost', (e: any) => {
            e.preventDefault();
            console.warn("[ATC_SYSTEM] WebGL Context Lost.");
        }, false);
    }, []);

    return (
        <div 
            className="w-full h-full relative overflow-hidden transition-colors duration-500" 
            style={{ backgroundColor: isDark ? "#050505" : "#f8fafc" }}
        >
            <Canvas 
                onCreated={handleCreated}
                gl={{ antialias: false, powerPreference: "high-performance", alpha: true }} 
                dpr={1}
                onPointerMissed={(e) => { if (e.button === 0) setSelectedAgentId(null); }}
            >
                <UIContext.Provider value={uiValues}>
                    <PerspectiveCamera 
                        makeDefault 
                        position={RADAR_CONFIG.CAMERA.DEFAULT_POS} 
                        fov={isMainView ? RADAR_CONFIG.CAMERA.FOV_MAIN : RADAR_CONFIG.CAMERA.FOV_COMPACT} 
                    />
                    <OrbitControls 
                        makeDefault 
                        maxDistance={RADAR_CONFIG.CAMERA.MAX_DIST} 
                        minDistance={RADAR_CONFIG.CAMERA.MIN_DIST} 
                        enableDamping={true} 
                        dampingFactor={RADAR_CONFIG.CAMERA.DAMPING} 
                    />

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
                                agent={agent}
                                isLocked={state?.holder === agent.id}
                                isOverride={!!state?.overrideSignal}
                                isGlobalStopped={!!state?.globalStop}
                                isForced={state?.forcedCandidate === agent.id}
                                isAiProposed={state?.pendingProposals?.some(p => p.targetId === agent.id) ?? false}
                                isAdminMuted={isAdminMuted}
                                onClick={setSelectedAgentId}
                                compact={compact}
                                actions={actions}
                            />
                        ))}
                    </Suspense>
                </UIContext.Provider>
            </Canvas>
        </div>
    );
};