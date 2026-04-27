import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import clsx from 'clsx';
import { Agent } from '@/contexts/atcTypes';
import { LOG_LEVELS } from '@/utils/logStyles';

interface CentralHubProps {
  isLocked: boolean;
  isOverride: boolean;
  holder: string | null;
  isDark: boolean;
  agents: Agent[];
  isAiMode?: boolean;
}

export const CentralHub = ({ isLocked, isOverride, holder, isDark, agents, isAiMode }: CentralHubProps) => {
    const ref = useRef<THREE.Group>(null!);

    const hubColor = useMemo(() => {
        if (isOverride) return LOG_LEVELS.critical.color;
        if (isAiMode) return LOG_LEVELS.insight.color;
        if (isLocked) return LOG_LEVELS.success.color;
        return LOG_LEVELS.info.color;
    }, [isOverride, isAiMode, isLocked]);
    
    const holderDisplayName = useMemo(() => {
        if (!holder) return null;
        if (holder === 'USER' || holder === 'Human-Operator') return 'HUMAN';
        const agent = agents.find(a => a.uuid === holder || a.id === holder);
        return agent?.displayName || agent?.displayId || agent?.id || holder.split('-')[0];
    }, [holder, agents]);

    useFrame(() => {
        if(ref.current) {
            ref.current.rotation.y -= 0.01;
            ref.current.rotation.z += 0.005;
        }
    });
    
    return (
        <group ref={ref}>
            <mesh>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial 
                    color={hubColor}
                    wireframe
                    emissive={hubColor}
                    emissiveIntensity={isAiMode ? 1.0 : 0.5}
                />
            </mesh>
            <Html position={[0, 0, 0]} center distanceFactor={10} zIndexRange={[0, 10]}>
                <div className={clsx(
                    "flex flex-col items-center justify-center pointer-events-none select-none",
                    isDark ? "text-white" : "text-black"
                )}>
                    {isAiMode && (
                        <div className="mb-1 animate-bounce">
                            <div className="w-4 h-4 rounded-full bg-sky-500 blur-[4px] absolute opacity-50" />
                            <span className="text-[12px]">🧠</span> 
                        </div>
                    )}
                    <div 
                        className={clsx(
                            "font-black tracking-tighter whitespace-nowrap transition-all duration-300",
                            "text-[10px] uppercase",
                            "drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]", 
                            isAiMode ? (
                                "text-sky-400 shadow-sky-500/50 brightness-125 scale-110"
                            ) : (
                                isDark ? "text-white/90" : "text-black/90"
                            )
                        )}
                        style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.9)' }}
                    >
                        {isAiMode ? "KANANA-O" : "CORE"}
                    </div>
                    {holderDisplayName && (
                        <div className={clsx(
                            "text-[11px] mt-1 px-2 rounded font-bold animate-pulse whitespace-nowrap",
                            "bg-black/40 backdrop-blur-sm border border-current",
                            isOverride ? "text-red-500" : "text-emerald-500"
                        )}>
                            {isOverride ? 'OVERRIDE' : holderDisplayName}
                        </div>
                    )}
                </div>
            </Html>
        </group>
    );
};