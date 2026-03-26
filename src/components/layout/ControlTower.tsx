// src/components/layout/ControlTower.tsx
import React from 'react';
import { TerminalLog } from '@/components/monitoring/terminal/TerminalLog';
import { QueueDisplay } from '@/components/monitoring/queue/QueueDisplay';
import { TacticalPanel } from '@/components/command/TacticalPanel';
import { useUI } from '@/hooks/system/useUI';

export const ControlTower = () => {
    const { sidebarWidth } = useUI();

    return (
        <div 
            className="fixed top-0 left-0 pointer-events-none transition-all duration-300" 
            style={{ 
                zIndex: 45, 
                width: `calc(100vw - ${sidebarWidth}px)`, 
                height: '100vh' 
            }}
        >
            {/* 하위 컴포넌트들은 pointer-events-auto 설정 */}
            <TerminalLog />
            <QueueDisplay />
            <TacticalPanel />
        </div>
    );
};