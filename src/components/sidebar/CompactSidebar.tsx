import React, { useState } from 'react';
import clsx from 'clsx';
import { Activity, ShieldAlert, Settings, Pause, Moon, Sun, Volume2, VolumeX, Camera, Loader2 } from 'lucide-react';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { LOG_LEVELS } from '@/utils/logStyles';
import { Tooltip } from '@/components/common/Tooltip';
import { useAgentMutations } from '@/hooks/api/useAgentMutations';
import { AIControlGroup } from '@/components/common/AIControlGroup';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface Props {
    uptime: number;
    formatUptime: (sec: number) => string;
    onOpenSettings: () => void;
}

export const CompactSidebar = ({ onOpenSettings }: Props) => {
    const { isDark, setIsDark, setSelectedAgentId } = useUIStore();
    
    const holder = useATCStore(s => s.state.holder);
    const overrideSignal = useATCStore(s => s.state.overrideSignal);
    const agents = useATCStore(s => s.agents);
    const globalStop = useATCStore(s => s.state.globalStop);
    const isAiMode = useATCStore(s => s.isAiMode);
    const isAdminMuted = useATCStore(s => s.isAdminMuted);
    const toggleAdminMute = useATCStore(s => s.toggleAdminMute);
    
    const { triggerOverride, releaseLock } = useAgentMutations();
    const [isCapturing, setIsCapturing] = useState(false);

    const handleCapture = async () => {
        if (isCapturing) return;
        setIsCapturing(true);
        const toastId = toast.loading('Capturing screen...');

        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const targetElement = document.getElementById('atc-dashboard') || document.body;
            const canvas = await html2canvas(targetElement, {
                backgroundColor: isDark ? '#000000' : '#ffffff',
                useCORS: true,
                scale: window.devicePixelRatio || 2,
                logging: false,
                ignoreElements: (element) => {
                    if (element.id === 'sonner-toast-container') return true;
                    return false;
                }
            });

            canvas.toBlob((blob) => {
                if (!blob) {
                    toast.error('Failed to capture screen.', { id: toastId });
                    setIsCapturing(false);
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    if (useATCStore.getState().isAiMode) {
                        window.dispatchEvent(new CustomEvent('ATTACH_IMAGE', { detail: base64data }));
                        toast.success('Screenshot attached to Command Center.', { id: toastId });
                    } else {
                        const a = document.createElement('a');
                        a.href = base64data;
                        a.download = `kanana-atc-capture-${new Date().getTime()}.png`;
                        a.click();
                        toast.success('Screenshot saved successfully.', { id: toastId });
                    }
                };
                reader.readAsDataURL(blob);
                setIsCapturing(false);
            }, 'image/png', 1.0);
        } catch (error) {
            logger.error('Capture failed:', error);
            toast.error('An error occurred during capture.', { id: toastId });
            setIsCapturing(false);
        }
    };
    
    const isHuman = holder === 'USER' || overrideSignal;

    const handleTakeover = () => {
        if (isHuman) releaseLock.mutate();
        else triggerOverride.mutate();
    };

    return (
        <div className="flex flex-col h-full w-full items-center py-4 space-y-6 opacity-100 transition-opacity duration-200">
            {/* Top: Takeover / Waveform Icon */}
            <Tooltip content={isHuman ? "RELEASE CONTROL" : "MANUAL OVERRIDE"} position="left">
                <button 
                    onClick={handleTakeover}
                    className={clsx(
                        "p-2.5 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors",
                        isHuman 
                            ? "bg-red-500 text-white animate-pulse" 
                            : (isDark ? "bg-gray-800 text-blue-400 hover:bg-gray-700" : "bg-slate-100 text-blue-600 hover:bg-slate-200 shadow-sm")
                    )}
                >
                    {isHuman ? <ShieldAlert size={20} /> : <Activity size={20} />}
                </button>
            </Tooltip>

            {/* Middle: Agent Mini List (Attention Needed Only) */}
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center gap-3">
                {/* Total Active Agents Badge */}
                <Tooltip content={`Total Agents: ${agents.length}`} position="left">
                    <div className={clsx(
                        "w-8 h-8 rounded-full flex flex-col items-center justify-center border transition-all cursor-pointer",
                        isDark ? "bg-gray-900 border-gray-700 text-gray-400" : "bg-white border-slate-200 text-slate-500"
                    )}>
                        <span className="text-[10px] font-bold">{agents.length}</span>
                    </div>
                </Tooltip>

                {agents.filter(a => a.status === 'paused' || a.isPaused || globalStop || holder === a.id || a.priority).map(agent => {
                    const isPaused = agent.status === 'paused' || agent.isPaused || globalStop;
                    const isLocked = holder === agent.id || agent.locked;
                    
                    let color = agent.color || '#3b82f6';
                    if (isPaused) color = isDark ? '#64748b' : '#94a3b8';
                    
                    if (agent.priority) color = LOG_LEVELS.warn.color;
                    if (isLocked) color = LOG_LEVELS.success.color;

                    return (
                        <Tooltip key={agent.id} content={agent.displayId || agent.id} position="left">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedAgentId(agent.id);
                                }}
                                className={clsx(
                                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all hover:scale-110",
                                    isDark ? "bg-gray-900 border-gray-700" : "bg-white border-slate-200"
                                )}
                                style={{ borderColor: color }}
                            >
                                {isPaused ? (
                                    <Pause size={12} style={{ color }} />
                                ) : (
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                )}
                            </button>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Bottom: Settings & Status */}
            <div className="flex flex-col items-center gap-3 shrink-0 pb-2">
                <AIControlGroup variant="sidebar" isCompact={true} />
                
                <Tooltip content={isAdminMuted ? "Sound OFF" : "Sound ON"} position="left">
                    <button 
                        onClick={toggleAdminMute}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        )}
                    >
                        {isAdminMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </Tooltip>

                <Tooltip content={isDark ? "Light Mode" : "Dark Mode"} position="left">
                    <button 
                        onClick={() => setIsDark(!isDark)}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        )}
                    >
                        {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </Tooltip>

                <Tooltip content="Capture Screen" position="left">
                    <button 
                        onClick={handleCapture}
                        disabled={isCapturing}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
                            isCapturing && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    </button>
                </Tooltip>

                <Tooltip content="Settings" position="left">
                    <button 
                        onClick={onOpenSettings}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        )}
                    >
                        <Settings size={16} />
                    </button>
                </Tooltip>

                <Tooltip content={isHuman ? "TAKEOVER ACTIVE" : globalStop ? "GLOBAL STOP" : isAiMode ? "AI LINK ACTIVE" : "SYSTEM READY"} position="left">
                    <div className={clsx(
                        "w-2 h-2 rounded-full mt-2 transition-colors",
                        isHuman ? "bg-red-500 animate-pulse" : globalStop ? "bg-gray-500" : isAiMode ? "bg-sky-500 animate-pulse" : "bg-emerald-500"
                    )} />
                </Tooltip>
            </div>
        </div>
    );
};
