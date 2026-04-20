// src/components/agent/AgentMetrics.tsx
import React from 'react';
import { Zap, Clock, Hash, Activity } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import clsx from 'clsx';
import { Agent } from '@/contexts/atcTypes';

interface MetricBoxProps {
    label: string;
    value: string | number;
    isDark: boolean;
    icon: React.ReactNode;
    tooltip: string;
}

const MetricBox = ({ label, value, isDark, icon, tooltip }: MetricBoxProps) => (
    <Tooltip content={tooltip} position="top" className="flex-1">
        <div className={clsx(
            "w-full flex flex-col items-center justify-center py-1.5 rounded-sm border min-w-[45px] h-11 shadow-sm transition-all", 
            isDark 
                ? "bg-black/40 border-white/5 hover:border-blue-500/30 group/metric" 
                : "bg-white border-slate-200 hover:border-blue-300 shadow-inner"
        )}>
            <div className="text-[7px] text-gray-500 uppercase font-black tracking-tighter flex items-center gap-1 leading-none mb-1 group-hover/metric:text-blue-400">
                {icon}{label}
            </div>
            <div className={clsx(
                "text-[10px] font-mono font-bold truncate leading-none", 
                isDark ? "text-gray-300" : "text-slate-800"
            )}>
                {value}
            </div>
        </div>
    </Tooltip>
);

export const AgentMetrics = ({ isDark, agent }: { isDark: boolean, agent?: Agent }) => {
    // 시뮬레이션 값 생성 (React 컴포넌트의 순수성을 유지하기 위해 useRef로 초기값 고정 또는 useMemo 외부에 의존)
    const [randTs] = React.useState(() => (Math.random() * 15 + 35).toFixed(1));
    const [randLat] = React.useState(() => (Math.random() * 50 + 150).toFixed(0));
    const [randTot] = React.useState(() => (Math.random() * 2000 + 800).toFixed(0));
    const [randLoad] = React.useState(() => (Math.random() * 15 + 5).toFixed(1));

    const metrics = React.useMemo(() => {
        return {
            ts: agent?.metrics?.ts || randTs,
            lat: agent?.metrics?.lat || randLat,
            tot: agent?.metrics?.tot || randTot,
            load: agent?.metrics?.load || randLoad
        };
    }, [agent?.metrics?.ts, agent?.metrics?.lat, agent?.metrics?.tot, agent?.metrics?.load, randTs, randLat, randTot, randLoad]);

    return (
        <div className="grid grid-cols-4 gap-1">
            <MetricBox isDark={isDark} label="T/S" value={metrics.ts} icon={<Zap size={10}/>} tooltip="Tokens Per Second" />
            <MetricBox isDark={isDark} label="LAT" value={metrics.lat} icon={<Clock size={10}/>} tooltip="Latency" />
            <MetricBox isDark={isDark} label="TOT" value={metrics.tot} icon={<Hash size={10}/>} tooltip="Total Tokens" />
            <MetricBox isDark={isDark} label="LOAD" value={metrics.load} icon={<Activity size={10}/>} tooltip="Compute Load" />
        </div>
    );
};