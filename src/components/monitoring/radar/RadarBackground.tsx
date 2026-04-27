import React, { useMemo } from 'react';
import * as THREE from 'three';

interface RadarBackgroundProps {
  isDark: boolean;
}

export const RadarBackground = React.memo(({ isDark }: RadarBackgroundProps) => {
    const count = 3000;
    
    const [positions] = React.useState(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }
        return pos;
    });
    
    const colors = useMemo(() => {
        const color = new THREE.Color();
        color.setHex(isDark ? 0x444444 : 0x94a3b8);
        const newColors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            newColors[i * 3] = color.r;
            newColors[i * 3 + 1] = color.g;
            newColors[i * 3 + 2] = color.b;
        }
        return newColors;
    }, [isDark, count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} args={[colors, 3]} />
      </bufferGeometry>
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={isDark ? 0.8 : 0.4}
          sizeAttenuation
          depthWrite={false}
          blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
    );
});