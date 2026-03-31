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
            className="fixed inset-0 pointer-events-none transition-all duration-300" 
            style={{ 
                zIndex: 30,
                right: `${sidebarWidth}px`,
            }}
        >
            <TerminalLog />
            <QueueDisplay />
            <TacticalPanel />
        </div>
    );
};