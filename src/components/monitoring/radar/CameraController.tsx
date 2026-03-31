// src/components/monitoring/radar/CameraController.tsx
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useEffect } from 'react';
import { useUI } from '@/hooks/system/useUI';
import { RADAR_CONFIG } from './radarConfig';

interface Props {
    targetPosition: [number, number, number] | null;
}

const tempTargetVec = new THREE.Vector3();
const tempCamDir = new THREE.Vector3();
const tempCamTargetPos = new THREE.Vector3();

export const CameraController = ({ targetPosition }: Props) => {
    const { camera, controls } = useThree();
    const { selectedAgentId } = useUI();
    
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
        const handleEnd = () => { isUserInteracting.current = false; };

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
        if (!controls || !targetPosition) return;
        const orbit = controls as any;
        if (isUserInteracting.current) return;

        tempTargetVec.set(targetPosition[0], targetPosition[1], targetPosition[2]);
        orbit.target.lerp(tempTargetVec, RADAR_CONFIG.CAMERA.TARGET_LERP);

        if (isAutoZooming.current) {
            const desiredDistance = RADAR_CONFIG.CAMERA.ZOOM_DISTANCE;
            const currentDistance = camera.position.distanceTo(tempTargetVec);

            if (Math.abs(currentDistance - desiredDistance) < 0.2) {
                isAutoZooming.current = false;
            } else {
                tempCamDir.subVectors(camera.position, tempTargetVec).normalize();
                tempCamTargetPos.addVectors(tempTargetVec, tempCamDir.multiplyScalar(desiredDistance));
                camera.position.lerp(tempCamTargetPos, RADAR_CONFIG.CAMERA.ZOOM_SPEED);
            }
        }
        orbit.update();
    });
    return null;
};