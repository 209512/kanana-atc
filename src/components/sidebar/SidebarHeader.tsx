import React, { useState } from 'react';
import clsx from 'clsx';
import { ShieldAlert, Activity, Settings, Volume2, VolumeX, Camera, Loader2, HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';

export const SidebarHeader = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
    const { i18n } = useTranslation();
    const holder = useATCStore(s => s.state.holder);
    const isAdminMuted = useATCStore(s => s.isAdminMuted);
    const toggleAdminMute = useATCStore(s => s.toggleAdminMute);
    
    const isDark = useUIStore(s => s.isDark);
    const setIsDark = useUIStore(s => s.setIsDark);
    const startTour = useUIStore(s => s.startTour);
    const overrideSignal = useATCStore(s => s.state.overrideSignal);
    
    const isHuman = holder === 'USER' || overrideSignal;
    const [isCapturing, setIsCapturing] = useState(false);

    const handleCapture = React.useCallback(async () => {
        if (isCapturing) return;
        setIsCapturing(true);
        const toastId = toast.loading('Capturing screen...');

        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const targetElement = document.getElementById('atc-dashboard') || document.body;
            const canvas = await html2canvas(targetElement, {
                background: isDark ? '#000000' : '#ffffff',
                useCORS: true,
                // @ts-ignore
                scale: window.devicePixelRatio || 2,
                logging: false,
                ignoreElements: (element: Element) => {
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
    }, [isCapturing, isDark]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                handleCapture();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCapture]);
    
    return (
        <div className={clsx(
            "p-4 border-b flex justify-between items-center transition-colors duration-500 min-w-0 shrink-0",
            isHuman ? "bg-red-500/10 border-red-500/30" : (isDark ? "border-gray-800" : "border-slate-200/40")
        )}>
            <div className="flex items-center gap-3">
                <div className={clsx("p-2 rounded-lg min-w-0", isHuman ? "bg-red-500 text-white animate-pulse" : (isDark ? "bg-gray-800 text-blue-400" : "bg-white text-blue-600 shadow-sm"))}>
                    {isHuman ? <ShieldAlert size={20} /> : <Activity size={20} />}
                </div>
                <div className="min-w-0">
                    <h2 className="font-bold text-sm tracking-wide min-w-0">
                        <Tooltip content="Main Control Panel" position="bottom">
                            {i18n.t('app.title', 'TRAFFIC CONTROL')}
                        </Tooltip>
                    </h2>
                    <div className="flex items-center gap-2 text-[10px] opacity-60 font-mono min-w-0">
                        <span className={clsx("w-1.5 h-1.5 rounded-full", isHuman ? "bg-red-500" : "bg-emerald-500")}></span>
                        {isHuman ? "MANUAL OVERRIDE" : "AUTONOMOUS"}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-0.5">
                <Tooltip content="Screenshot (Ctrl+Shift+S)" position="bottom">
                    <button 
                        onClick={handleCapture} 
                        disabled={isCapturing}
                        className={clsx(
                            "p-2 rounded-md hover:bg-white/10 transition-colors",
                            isCapturing ? "text-sky-500" : "text-gray-400 hover:text-white"
                        )}
                    >
                        {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    </button>
                </Tooltip>

                <Tooltip content={isAdminMuted ? "Unmute Audio" : "Mute Audio"} position="bottom">
                    <button onClick={toggleAdminMute} className={clsx(
                        "p-2 rounded-md transition-colors",
                        isAdminMuted ? "text-red-500 bg-red-500/10" : "hover:bg-white/10 text-gray-400"
                    )}>
                        {isAdminMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </Tooltip>
                
                <Tooltip content="Toggle Theme" position="bottom">
                    <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-md hover:bg-white/10 transition-colors text-lg">
                        {isDark ? "🌙" : "☀️"}
                    </button>
                </Tooltip>

                <Tooltip content="Guide & Help" position="bottom">
                    <button onClick={startTour} className="p-2 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-blue-400">
                        <HelpCircle size={16} />
                    </button>
                </Tooltip>

                <Tooltip content="System Settings" position="bottom-left">
                    <button onClick={onOpenSettings} className="p-2 rounded-md hover:bg-blue-500/20 transition-colors text-gray-400 tour-settings-btn">
                        <Settings size={16} />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};