// src/components/monitoring/radar/radarConfig.ts
export const RADAR_CONFIG = {
    CAMERA: {
        DEFAULT_POS: [12, 12, 12] as [number, number, number],
        DEFAULT_TARGET: [0, 0, 0] as [number, number, number],
        FOV_MAIN: 45,
        FOV_COMPACT: 60,
        ZOOM_DISTANCE: 15,
        ZOOM_SPEED: 0.05,
        TARGET_LERP: 0.1,
        MAX_DIST: 60,
        MIN_DIST: 3,
        DAMPING: 0.08,
    },
    DRONE: {
        LERP_NORMAL: 0.06,
        LERP_PAUSED: 0.1,
        LERP_RESUMING: 0.02,
        OFFSET_Y: -180, // AgentDetailPopup 위치
        ROTATION_SPEED: Number(import.meta.env.VITE_DRONE_ROTATION_SPEED) || 0.02,
        ROTATION_FORCED: Number(import.meta.env.VITE_DRONE_ROTATION_FORCED) || 0.08,
        ROTATION_AI: Number(import.meta.env.VITE_DRONE_ROTATION_AI) || 0.15,
    },
    ANIMATION: {
        DETAIL_POPUP_DELAY_MS: Number(import.meta.env.VITE_DETAIL_POPUP_DELAY_MS) || 1500,
    },
    BACKGROUND: {
        PARTICLE_COUNT: 3000,
        PARTICLE_SIZE: 0.15,
        BOUNDS: 50,
    }
};