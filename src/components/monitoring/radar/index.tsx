import React, { Suspense, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { Agent } from '@/contexts/atcTypes';
import { RADAR_CONFIG } from './radarConfig';
import { logger } from '@/utils/logger';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

import { createPortal } from 'react-dom';

const AgentDrone = React.lazy(() => import('@/components/monitoring/radar/AgentDrone').then(m => ({ default: m.AgentDrone })));
const RadarBackground = React.lazy(() => import('@/components/monitoring/radar/RadarBackground').then(m => ({ default: m.RadarBackground })));
const CentralHub = React.lazy(() => import('@/components/monitoring/radar/CentralHub').then(m => ({ default: m.CentralHub })));
const AgentDetailPopup = React.lazy(() => import('@/components/monitoring/radar/AgentDetailPopup').then(m => ({ default: m.AgentDetailPopup })));
const CameraController = React.lazy(() => import('@/components/monitoring/radar/CameraController').then(m => ({ default: m.CameraController })));
const SceneCleanup = ({ isDark }: { isDark: boolean }) => {
    const { scene, gl } = useThree();
    
    useEffect(() => {
        gl.setClearColor(isDark ? '#050505' : '#f1f5f9');
        const onContextLost = (e: Event) => {
            e.preventDefault();
            logger.warn("[ATC_SYSTEM] WebGL Context Lost.");
        };
        gl.domElement.addEventListener('webglcontextlost', onContextLost, false);
        
        return () => {
            gl.domElement.removeEventListener('webglcontextlost', onContextLost);
            
            
            
            
            scene.traverse((object: any) => {
                if (!object.isMesh) return;
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((mat: any) => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
                if (object.texture) {
                    object.texture.dispose();
                }
            });
        };
    }, [gl, scene, isDark]);
    
    return null;
};
const AgentDroneFallback = ({ agentId, isDark }: { agentId: string, isDark: boolean }) => {
    const seed = parseInt(agentId.replace(/[^0-9]/g, '').slice(0, 4) || '1') || 1;
    const radius = 5 + (seed % 3) * 2.8;
    const angle = seed * (Math.PI * 2 / 5);
    const targetX = Math.cos(angle) * radius;
    const targetY = 0;
    const targetZ = Math.sin(angle) * radius;

    return (
        <mesh position={[targetX, targetY, targetZ]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color={isDark ? '#ff0000' : '#dc2626'} wireframe />
        </mesh>
    );
};

export const Radar: React.FC<{ compact?: boolean; isMainView?: boolean }> = ({ compact = false, isMainView = false }) => {
    const agents = useATCStore(s => s.agents);
    const holder = useATCStore(s => s.state.holder);
    const overrideSignal = useATCStore(s => s.state.overrideSignal);
    const globalStop = useATCStore(s => s.state.globalStop);
    const forcedCandidate = useATCStore(s => s.state.forcedCandidate);
    const pendingProposals = useATCStore(s => s.state.pendingProposals);
    const isAiMode = useATCStore(s => s.isAiMode);
    const isAdminMuted = useATCStore(s => s.isAdminMuted);
    
    const { togglePause, togglePriority, transferLock, terminateAgent } = useAgentMutations();
    
    const actions = useMemo(() => ({
        togglePause: (uuid: string) => togglePause.mutate(uuid),
        togglePriority: (uuid: string) => togglePriority.mutate(uuid),
        transferLock: (uuid: string) => transferLock.mutate(uuid),
        terminateAgent: (uuid: string) => terminateAgent.mutate(uuid),
    }), [togglePause, togglePriority, transferLock, terminateAgent]);

    const isDark = useUIStore(s => s.isDark);
    const selectedAgentId = useUIStore(s => s.selectedAgentId);
    const setSelectedAgentId = useUIStore(s => s.setSelectedAgentId);
    const viewMode = useUIStore(s => s.viewMode);
    
    const { reset } = useQueryErrorResetBoundary();

    if (isMainView && viewMode === 'attached') return null;
    if (compact && viewMode !== 'attached') return null;

    return (
        <div 
            className="w-full h-full relative overflow-hidden transition-colors duration-500 radar-canvas" 
            style={{ backgroundColor: isDark ? "#050505" : "#f8fafc" }}
            onContextMenu={(e) => e.preventDefault()} 
        >
            <Canvas 
                className="radar-canvas"
                gl={{ 
                    antialias: false, 
                    powerPreference: "high-performance", 
                    alpha: false, // Performance optimization
                    preserveDrawingBuffer: true, // Required for html2canvas to capture WebGL context
                    stencil: false,
                    depth: true
                }} 
                dpr={[1, Math.min(2, window.devicePixelRatio || 1)]} // Limit DPR for performance
                onPointerMissed={(e) => { if (e.button === 0) setSelectedAgentId(null); }}
            >
                <SceneCleanup isDark={isDark} />
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
                    mouseButtons={{
                        LEFT: THREE.MOUSE.ROTATE,
                        MIDDLE: THREE.MOUSE.DOLLY,
                        RIGHT: THREE.MOUSE.PAN
                    }}
                />

                <CameraController />
                <ambientLight intensity={isDark ? 0.4 : 0.8} />
                <pointLight position={[10, 15, 10]} intensity={1.5} />

                <Suspense fallback={null}>
                    <RadarBackground isDark={isDark} />
                    <CentralHub 
                        isLocked={!!holder} 
                        isOverride={!!overrideSignal} 
                        holder={holder || null} 
                        isDark={isDark} 
                        agents={agents}
                        isAiMode={isAiMode}
                    />
                        
                    {agents.map((agent: Agent) => (
                        <ErrorBoundary 
                            key={agent.id} 
                            fallback={<AgentDroneFallback agentId={agent.id} isDark={isDark} />}
                            onReset={reset}
                        >
                            <AgentDrone
                                agent={agent}
                                isLocked={holder === agent.id}
                                isOverride={!!overrideSignal}
                                isGlobalStopped={!!globalStop}
                                isForced={forcedCandidate === agent.id}
                                isAiProposed={Array.from(pendingProposals?.values() || []).some(
                                    p => p.targetId === agent.id || p.targetId === agent.uuid || p.targetId === agent.displayId || p.targetId === (agent.name || '').toUpperCase() || p.targetId === (agent.displayName || '').toUpperCase()
                                )}
                                isAdminMuted={isAdminMuted}
                                onClick={setSelectedAgentId}
                                compact={compact}
                                actions={actions}
                            />
                        </ErrorBoundary>
                    ))}
                </Suspense>
            </Canvas>
            
            {/* NOTE: Portal overlay (Canvas z-index) */}
            {selectedAgentId && agents.find(a => a.id === selectedAgentId || a.uuid === selectedAgentId || a.displayId === selectedAgentId) && (
                typeof document !== 'undefined' ? createPortal(
                    <div className="absolute inset-0 z-[100] pointer-events-none w-full h-full overflow-hidden">
                        <Suspense fallback={null}>
                            <AgentDetailPopup 
                                agent={agents.find(a => a.id === selectedAgentId || a.uuid === selectedAgentId || a.displayId === selectedAgentId)} 
                                onClose={() => setSelectedAgentId(null)} 
                                isDark={isDark}
                                isCompact={compact}
                                onTerminate={actions.terminateAgent}
                                onTogglePriority={actions.togglePriority}
                                onTransferLock={actions.transferLock}
                                onTogglePause={actions.togglePause}
                            />
                        </Suspense>
                    </div>,
                    document.getElementById('atc-dashboard') || document.body
                ) : null
            )}
            
            {/* TODO: re-enable A11yAnnouncer (StrictMode/HMR root unmount) */}
        </div>
    );
};
