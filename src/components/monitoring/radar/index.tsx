// src/components/monitoring/radar/index.tsx
import React, { Suspense, useCallback, useMemo, useEffect } from 'react';
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

// 3D 에셋 지연 로딩 (Lazy Loading) 적용
const AgentDrone = React.lazy(() => import('@/components/monitoring/radar/AgentDrone').then(m => ({ default: m.AgentDrone })));
const RadarBackground = React.lazy(() => import('@/components/monitoring/radar/RadarBackground').then(m => ({ default: m.RadarBackground })));
const CentralHub = React.lazy(() => import('@/components/monitoring/radar/CentralHub').then(m => ({ default: m.CentralHub })));
const AgentDetailPopup = React.lazy(() => import('@/components/monitoring/radar/AgentDetailPopup').then(m => ({ default: m.AgentDetailPopup })));
const CameraController = React.lazy(() => import('@/components/monitoring/radar/CameraController').then(m => ({ default: m.CameraController })));

// Scene Cleanup Component to prevent WebGL memory leaks
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
            // WebGL 렌더러의 모든 내부 리소스 정리 (메모리 누수 방지)
            // gl.dispose(); // R3F가 자체적으로 WebGL context를 관리하므로 수동 dispose 시 HMR(Hot Module Replacement) 중 하얀 화면 발생 위험
            
            // 대신, Scene 내부의 모든 mesh 자원을 순회하며 확실하게 해제
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

// Fallback UI for a crashed individual AgentDrone
const AgentDroneFallback = ({ agentId, isDark }: { agentId: string, isDark: boolean }) => {
    // Determine static position based on agentId to keep the fallback in place
    // Extracting numbers from UUID to simulate position deterministic behavior
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
            className="w-full h-full relative overflow-hidden transition-colors duration-500" 
            style={{ backgroundColor: isDark ? "#050505" : "#f8fafc" }}
            onContextMenu={(e) => e.preventDefault()} // 브라우저 기본 우클릭 메뉴 방지
        >
            <Canvas 
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
                                    p => p.targetId === agent.id || p.targetId === agent.uuid || p.targetId === agent.displayId
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
            
            {/* 고정된 UI 오버레이: 카메라 트래킹을 하지 않으므로 3D 공간을 벗어나 2D DOM에 렌더링 */}
            {selectedAgentId && agents.find(a => a.id === selectedAgentId || a.uuid === selectedAgentId || a.displayId === selectedAgentId) && (
                <div className="absolute inset-0 z-50 pointer-events-none w-full h-full">
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
                </div>
            )}
            
            {/* A11yAnnouncer는 React 18 Strict Mode 및 HMR 환경에서 "Cannot update an unmounted root" 에러를 유발하므로 제거 또는 대체 (기능상 불필요) */}
            {/* <A11yAnnouncer /> */}
        </div>
    );
};