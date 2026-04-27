import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { RADAR_CONFIG } from './radarConfig';



import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const tempTargetVec = new THREE.Vector3();
const tempCamDir = new THREE.Vector3();
const tempCamTargetPos = new THREE.Vector3();

export const CameraController = () => {
    const { camera, controls, scene } = useThree();
    const { selectedAgentId } = useUIStore();
    
    const isAutoZooming = useRef(false);
    const isUserInteracting = useRef(false);
    const isTracking = useRef(true);
    const lastSelectedId = useRef<string | null>(null);

    useEffect(() => {
        if (!controls) return;
        const orbit = controls as unknown as OrbitControlsImpl;

        const handleStart = () => {
            isUserInteracting.current = true;
            isAutoZooming.current = false;
            
            if (!selectedAgentId) {
                isTracking.current = false;
            }
        };
        const handleEnd = () => { isUserInteracting.current = false; };

        orbit.addEventListener('start', handleStart);
        orbit.addEventListener('end', handleEnd);
        return () => {
            orbit.removeEventListener('start', handleStart);
            orbit.removeEventListener('end', handleEnd);
        };
    }, [controls, selectedAgentId]);

    useEffect(() => {
        
        isTracking.current = true;
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
        const orbit = controls as unknown as OrbitControlsImpl;
        if (isUserInteracting.current) return;

        if (isTracking.current) {
            if (selectedAgentId) {
                const targetObj = scene.getObjectByName(`drone-${selectedAgentId}`);
                if (targetObj) {
                    tempTargetVec.copy(targetObj.position);
                }
            } else {
                tempTargetVec.set(...RADAR_CONFIG.CAMERA.DEFAULT_TARGET);
            }
            
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
        }
        orbit.update();
    });
    return null;
};