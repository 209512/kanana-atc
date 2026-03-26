// src/components/monitoring/radar/CameraController.tsx
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useEffect } from 'react';
import { useUI } from '@/hooks/system/useUI';

interface Props {
    targetPosition: [number, number, number] | null;
}

export const CameraController = ({ targetPosition }: Props) => {
    const { camera, controls } = useThree();
    const { selectedAgentId } = useUI();
    const targetVec = new THREE.Vector3();
    
    const isAutoZooming = useRef(false);
    const isUserInteracting = useRef(false);
    const lastSelectedId = useRef<string | null>(null);

    useEffect(() => {
        if (!controls) return;
        const orbit = controls as any;

        const handleStart = () => {
            isUserInteracting.current = true;
            isAutoZooming.current = false;
        };
        const handleEnd = () => {
            isUserInteracting.current = false;
        };

        orbit.addEventListener('start', handleStart);
        orbit.addEventListener('end', handleEnd);

        return () => {
            orbit.removeEventListener('start', handleStart);
            orbit.removeEventListener('end', handleEnd);
        };
    }, [controls]);

    useEffect(() => {
        if (selectedAgentId) {
            if (selectedAgentId !== lastSelectedId.current) {
                isAutoZooming.current = true;
                isUserInteracting.current = false; 
                lastSelectedId.current = selectedAgentId;
            }
        } else {
            isAutoZooming.current = false;
            lastSelectedId.current = null;
        }
    }, [selectedAgentId]);

    useFrame(() => {
        if (!controls) return;
        const orbit = controls as any;

        if (isUserInteracting.current) return;

        if (targetPosition) {
            targetVec.set(targetPosition[0], targetPosition[1], targetPosition[2]);
            orbit.target.lerp(targetVec, 0.1);

            if (isAutoZooming.current) {
                const desiredDistance = 15;
                const currentDistance = camera.position.distanceTo(targetVec);

                if (Math.abs(currentDistance - desiredDistance) < 0.2) {
                    isAutoZooming.current = false;
                } else {
                    const direction = new THREE.Vector3().subVectors(camera.position, targetVec).normalize();
                    const targetCameraPos = new THREE.Vector3().addVectors(targetVec, direction.multiplyScalar(desiredDistance));
                    camera.position.lerp(targetCameraPos, 0.05);
                }
            }
            orbit.update();
        }
    });
    return null;
};