// src/components/monitoring/radar/AgentDrone.tsx
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line as DreiLine } from '@react-three/drei';
import * as THREE from 'three';
import { Star, Pause, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useUIStore } from '@/store/useUIStore';
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
        togglePause: (id: string) => void;
        togglePriority: (id: string) => void;
        transferLock: (id: string) => void;
        terminateAgent: (id: string) => void;
    };
}

export const AgentDrone = React.memo(({ 
    agent, isLocked, isOverride, isGlobalStopped, isForced, isAiProposed,
    isAdminMuted, onClick, compact = false, actions
}: AgentDroneProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const selectedAgentId = useUIStore(s => s.selectedAgentId);
    const isDark = useUIStore(s => s.isDark);
    const setSelectedAgentId = useUIStore(s => s.setSelectedAgentId);
    const { playSuccess } = useAudio(isAdminMuted);

    const isSelected = selectedAgentId === agent.id;
    const isPaused = agent.status === 'paused' || agent.isPaused === true || isGlobalStopped;

    const currentPos = useRef(new THREE.Vector3());
    const targetVec = useRef(new THREE.Vector3());
    const prevLocked = useRef(isLocked);
    const isResuming = useRef(false);

    const dotsGroupRef = useRef<THREE.Group>(null);
    const lineRef = useRef<any>(null);

    const accumulatedTime = useRef(0);
    const currentAngle = useRef((agent.seed || 0) * (Math.PI * 2));

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

    useFrame((frameState, delta) => {
        if (!groupRef.current) return;
        
        if (!isPaused) {
            // Delta time이 너무 크면(예: 탭 백그라운드 전환) 스킵하여 드론이 비정상적으로 빨리 움직이는 현상 방지
            if (delta < 0.1) {
                accumulatedTime.current += delta;
                
                // 에이전트 부하량(baseLoad)에 비례하여 공전 속도를 결정 (Load가 높을수록 미세하게 빨라짐)
                const loadFactor = (agent.baseLoad || 30) / 100; // 0.1 ~ 1.0
                const baseSpeed = 0.15 + (loadFactor * 0.15); // 0.15 ~ 0.30
                const speedNoise = Math.cos(accumulatedTime.current * 0.5 + (agent.seed || 0)) * 0.05;
                const direction = ((agent.seed || 0) % 2 === 0) ? 1 : -1;
                
                // 누적 시간이 아닌 delta에 속도를 곱하여 더함으로써 Load가 변해도 궤도가 튀지 않도록 함
                currentAngle.current += delta * (baseSpeed + speedNoise) * direction;
            }
        }
        
        // 불규칙적이고 자연스러운 궤도를 위해 seed 기반 노이즈 추가 및 중앙 집중 분산
        // 기존 반경이 너무 중앙에 몰려있어 5.0 ~ 20.0으로 널찍하게 퍼뜨림
        const baseRadius = 6 + ((agent.seed || 0) % 15);
        const radiusNoise = Math.sin(accumulatedTime.current * 0.5 + (agent.seed || 0)) * 1.5;
        const radius = baseRadius + radiusNoise;
        
        const angle = currentAngle.current;
        
        const targetX = Math.cos(angle) * radius;
        // y축(고도)에도 불규칙성을 부여
        const yNoise = Math.sin(accumulatedTime.current * 0.8 + (agent.seed || 0) * 2) * 2.0;
        const targetY = (((agent.index || 0) % 4) - 1.5) * 1.5 + yNoise;
        const targetZ = Math.sin(angle) * radius;

        targetVec.current.set(targetX, targetY, targetZ);

        if (isPaused) {
            groupRef.current.position.lerp(targetVec.current, RADAR_CONFIG.DRONE.LERP_PAUSED);
        } else {
            const lerpFactor = isResuming.current ? RADAR_CONFIG.DRONE.LERP_RESUMING : RADAR_CONFIG.DRONE.LERP_NORMAL;
            groupRef.current.position.lerp(targetVec.current, lerpFactor);
            groupRef.current.rotation.y += isForced ? RADAR_CONFIG.DRONE.ROTATION_FORCED : (isAiProposed ? RADAR_CONFIG.DRONE.ROTATION_AI : RADAR_CONFIG.DRONE.ROTATION_SPEED);
            
            // 미세한 노이즈 (바람에 흔들리는 호버링 효과)
            const hoverNoise = Math.sin(accumulatedTime.current * 2.0 + (agent.seed || 0)) * 0.015;
            groupRef.current.position.y += Math.sin(accumulatedTime.current * 0.8) * 0.0015 + hoverNoise;
            
            // z축 방향으로도 미세한 난기류(Turbulence) 노이즈 추가
            const windNoiseZ = Math.cos(accumulatedTime.current * 1.5 + (agent.seed || 0)) * 0.008;
            groupRef.current.position.z += windNoiseZ;
        }
        
        currentPos.current.copy(groupRef.current.position);
        
        if (lineRef.current && lineRef.current.geometry) {
            (lineRef.current.geometry as { setPositions: (p: number[]) => void }).setPositions([
                0, 0, 0,
                -groupRef.current.position.x,
                -groupRef.current.position.y,
                -groupRef.current.position.z
            ]);
        }

        if (dotsGroupRef.current && isGlobalStopped) {
            const pos = groupRef.current.position;
            dotsGroupRef.current.children.forEach((child, i) => {
                child.position.copy(pos).multiplyScalar((i + 1) / 13);
            });
        }

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
                <group ref={dotsGroupRef}>
                    {[...Array(12)].map((_, i) => (
                        <mesh key={`dot-${agent.id}-${i}`}>
                            <sphereGeometry args={[0.04, 6, 6]} />
                            <meshBasicMaterial color={coreColor} transparent opacity={0.6} />
                        </mesh>
                    ))}
                </group>
            )}

            <group ref={groupRef} name={`drone-${agent.id}`}>
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

                {(isLocked || isForced || isAiProposed) && !isGlobalStopped && (
                    <DreiLine 
                        ref={lineRef}
                        points={[[0, 0, 0], [0, 0, 0]]}
                        color={coreColor} lineWidth={isAiProposed ? 1.8 : 1.2} transparent opacity={0.4}
                    />
                )}
            </group>
        </>
    );
});

const DroneLabel = ({ displayId, isDark, isLocked, isSelected, isPaused, isPriority, isOverride, isAiProposed }: {
    displayId: string;
    isDark: boolean;
    isLocked: boolean;
    isSelected: boolean;
    isPaused: boolean;
    isPriority: boolean;
    isOverride: boolean;
    isAiProposed: boolean;
}) => {
    const { t } = useTranslation();
    return (
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
                {isAiProposed ? `${t('drone.ai', '[AI]')} ${displayId}` : (isOverride ? t('drone.overriding', 'OVERRIDING...') : (isPaused ? `${t('drone.paused', '[PAUSED]')} ${displayId}` : displayId))}
            </span>
        </div>
    </Html>
    );
};

AgentDrone.displayName = 'AgentDrone';