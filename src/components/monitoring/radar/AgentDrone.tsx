// src/components/monitoring/radar/AgentDrone.tsx
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line as DreiLine } from '@react-three/drei';
import * as THREE from 'three';
import { Star, Pause, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useUI } from '@/hooks/system/useUI';
import { useAudio } from '@/hooks/system/useAudio';
import { AgentDetailPopup } from '@/components/monitoring/radar/AgentDetailPopup';
import { LOG_LEVELS } from '@/utils/logStyles';
import { Agent } from '@/contexts/atcTypes';
import { RADAR_CONFIG } from './radarConfig';

interface AgentDroneProps {
    agent: Agent;
    isLocked: boolean;
    isOverride: boolean;
    isGlobalStopped: boolean;
    isForced: boolean;
    isAiProposed: boolean;
    isAdminMuted: boolean;
    onClick: (id: string) => void;
    compact?: boolean;
    actions: {
        togglePause: any;
        togglePriority: any;
        transferLock: any;
        terminateAgent: any;
    };
}

export const AgentDrone = React.memo(({ 
    agent, isLocked, isOverride, isGlobalStopped, isForced, isAiProposed,
    isAdminMuted, onClick, compact = false, actions
}: AgentDroneProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const { selectedAgentId, isDark, setSelectedAgentId } = useUI();
    const { playSuccess } = useAudio(isAdminMuted);

    const isSelected = selectedAgentId === agent.id;
    const isPaused = agent.status === 'paused' || agent.isPaused === true || isGlobalStopped;

    const currentPos = useRef(new THREE.Vector3(...(agent.position as [number, number, number])));
    const targetVec = useRef(new THREE.Vector3(...(agent.position as [number, number, number])));
    const prevLocked = useRef(isLocked);
    const isResuming = useRef(false);

    useEffect(() => {
        if (isLocked && !prevLocked.current) playSuccess();
        prevLocked.current = isLocked;
    }, [isLocked, playSuccess]);

    useEffect(() => {
        if (!isPaused) {
            isResuming.current = true;
            const timer = setTimeout(() => { isResuming.current = false; }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isPaused]);

    useFrame((frameState) => {
        if (!groupRef.current) return;
        targetVec.current.set(agent.position[0], agent.position[1], agent.position[2]);

        if (isPaused) {
            groupRef.current.position.lerp(targetVec.current, RADAR_CONFIG.DRONE.LERP_PAUSED);
        } else {
            const lerpFactor = isResuming.current ? RADAR_CONFIG.DRONE.LERP_RESUMING : RADAR_CONFIG.DRONE.LERP_NORMAL;
            groupRef.current.position.lerp(targetVec.current, lerpFactor);
            groupRef.current.rotation.y += isForced ? RADAR_CONFIG.DRONE.ROTATION_FORCED : (isAiProposed ? RADAR_CONFIG.DRONE.ROTATION_AI : RADAR_CONFIG.DRONE.ROTATION_SPEED);
            groupRef.current.position.y += Math.sin(frameState.clock.elapsedTime * 0.8) * 0.0015;
        }
        currentPos.current.copy(groupRef.current.position);

        const time = frameState.clock.elapsedTime;
        const pulseFactor = isOverride ? 12 : (isForced ? 8 : (isSelected || agent.priority || isAiProposed ? 3 : 0));
        if (pulseFactor > 0) {
            const s = (isAiProposed ? 1.2 : 1) + Math.sin(time * (isAiProposed ? 12 : pulseFactor)) * 0.12;
            groupRef.current.scale.set(s, s, s);
        } else {
            groupRef.current.scale.set(1, 1, 1);
        }
    });

    const coreColor = useMemo(() => {
        if (isAiProposed) return LOG_LEVELS.insight.color;
        if (isOverride) return LOG_LEVELS.critical.color;
        if (isPaused) return isDark ? '#64748b' : '#94a3b8'; 
        if (isForced) return LOG_LEVELS.system.color;
        if (isLocked) return LOG_LEVELS.success.color;
        if (agent.priority) return LOG_LEVELS.warn.color;
        return agent.color || '#3b82f6';
    }, [isAiProposed, isOverride, isPaused, isForced, isLocked, agent.priority, agent.color, isDark]);

    return (
        <>
            {isGlobalStopped && (
                <group>
                    {[...Array(12)].map((_, i) => (
                        <mesh key={`dot-${agent.id}-${i}`} position={currentPos.current.clone().multiplyScalar((i + 1) / 13)}>
                            <sphereGeometry args={[0.04, 6, 6]} />
                            <meshBasicMaterial color={coreColor} transparent opacity={0.6} />
                        </mesh>
                    ))}
                </group>
            )}

            <group ref={groupRef}>
                <mesh onClick={(e) => { e.stopPropagation(); onClick(agent.id); }}>
                    <sphereGeometry args={[1.5, 8, 8]} />
                    <meshBasicMaterial transparent opacity={0} />
                </mesh>

                <mesh>
                    <octahedronGeometry args={[0.5, 0]} />
                    <meshStandardMaterial color={coreColor} emissive={coreColor} emissiveIntensity={isPaused ? 0.3 : (isAiProposed ? 2.5 : 1.5)} wireframe={true} />
                </mesh>

                <DroneLabel 
                    displayId={agent.displayId || agent.id} isDark={isDark} isLocked={isLocked}
                    isSelected={isSelected} isPaused={isPaused}
                    isPriority={!!agent.priority} isOverride={isOverride}
                    isAiProposed={isAiProposed}
                />

                {isSelected && (
                    <AgentDetailPopup 
                        agent={agent} 
                        position={[0, 0, 0]}
                        onClose={() => setSelectedAgentId(null)} 
                        isDark={isDark}
                        isCompact={compact}
                        onTerminate={actions.terminateAgent}
                        onTogglePriority={actions.togglePriority}
                        onTransferLock={actions.transferLock}
                        onTogglePause={actions.togglePause}
                    />
                )}
                
                {(isLocked || isForced || isAiProposed) && !isGlobalStopped && (
                    <DreiLine 
                        points={[[0, 0, 0], [-currentPos.current.x, -currentPos.current.y, -currentPos.current.z]]}
                        color={coreColor} lineWidth={isAiProposed ? 1.8 : 1.2} transparent opacity={0.4}
                    />
                )}
            </group>
        </>
    );
});

const DroneLabel = ({ displayId, isDark, isLocked, isSelected, isPaused, isPriority, isOverride, isAiProposed }: any) => (
    <Html position={[0, 0.9, 0]} center distanceFactor={12} zIndexRange={[0, 10]} style={{ pointerEvents: 'none' }}>
        <div className={clsx(
            "px-1.5 py-0.5 rounded text-[9px] font-mono border backdrop-blur-sm flex items-center gap-1 whitespace-nowrap select-none transition-all",
            isDark ? "bg-black/60 border-white/20 text-white" : "bg-white/90 border-slate-300 text-slate-700 shadow-sm",
            isAiProposed && "ring-2 ring-sky-500 bg-sky-600 text-white animate-pulse z-50",
            isLocked && !isPaused && !isOverride && (isDark ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" : "bg-emerald-50 border-emerald-500 text-emerald-600"),
            isOverride && "bg-red-500/20 border-red-500 text-red-500 animate-pulse",
            isSelected && "ring-1 ring-blue-500/50 scale-110 z-30",
            isPaused && (isDark ? "opacity-60 border-slate-600 bg-slate-900/50" : "opacity-50 grayscale")
        )}>
            {isAiProposed ? <AlertTriangle size={10} className="text-white" /> : (
                <>
                    {isPriority && !isOverride && <Star size={8} className={isDark ? "text-yellow-500" : "text-amber-500"} />}
                    {isPaused && <Pause size={7} className="text-slate-400" />}
                </>
            )}
            <span className={clsx("font-bold", isPaused && "line-through decoration-1 opacity-70 text-slate-400")}>
                {isAiProposed ? `[AI] ${displayId}` : (isOverride ? `OVERRIDING...` : (isPaused ? `[P] ${displayId}` : displayId))}
            </span>
        </div>
    </Html>
);

AgentDrone.displayName = 'AgentDrone';