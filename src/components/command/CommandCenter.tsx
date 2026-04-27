import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { Send, Brain, Mic, MicOff, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useCommandCenter } from '@/hooks/system/useCommandCenter';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { Tooltip } from '@/components/common/Tooltip';
import { useSTT } from '@/hooks/system/useSTT';

export const CommandCenter = () => {
    const isDark = useUIStore(s => s.isDark);
    const openKananaKeyModal = useUIStore(s => s.openKananaKeyModal);
    const isAiMode = useATCStore(s => s.isAiMode);
    const { inputValue, setInputValue, isAnalyzing, handleAnalyze, attachedImage, setAttachedImage } = useCommandCenter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [baseInputValue, setBaseInputValue] = useState("");

    const resetTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
        }
    };

    const checkAndExecute = (action: () => void) => {
        
        
        action();
    };

    const { isListening, toggleListening, hasSupport } = useSTT((text) => {
        
        setInputValue(baseInputValue ? `${baseInputValue} ${text}` : text);
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && isAiMode) { 
            e.preventDefault();
            setBaseInputValue(""); 
            handleAnalyze();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    setAttachedImage(compressedBase64);
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className={clsx(
            "w-full max-w-2xl px-4 transition-all duration-300 command-center-container",
            !isAiMode && "opacity-60 grayscale-[0.5]"
        )}> 
            <div className={clsx(
                "relative flex items-center gap-2 p-2 rounded-2xl border backdrop-blur-xl transition-all shadow-2xl",
                !isAiMode ? "bg-zinc-800/40 border-zinc-700/50" :
                isListening ? "ring-2 ring-red-500/50 border-red-500/50 bg-red-500/5" : 
                (isDark ? "bg-zinc-900/80 border-white/10 shadow-black/40" : "bg-white/90 border-slate-300 shadow-xl shadow-slate-200/50")
            )}>
                {/* Status Indicator */}
                <div className={clsx(
                    "absolute -top-3 left-6 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all z-10 select-none",
                    !isAiMode ? "bg-zinc-800 text-zinc-500" :
                    isAnalyzing ? "bg-sky-500 text-white animate-pulse" : 
                    isListening ? "bg-red-500 text-white animate-bounce" :
                    (isDark ? "bg-zinc-700 text-zinc-300" : "bg-slate-600 text-white")
                )}>
                    <Tooltip content={!isAiMode ? "System Link Offline" : "AI Core Active"} position="top">
                        <span>
                            {!isAiMode ? "AI_LINK_OFFLINE" : isAnalyzing ? "시스템을 분석 중입니다..." : isListening ? "Listening..." : "Ready for Command"}
                        </span>
                    </Tooltip>
                </div>

                {/* Analyze Button */}
                <Tooltip content="Analyze Strategic Command (Enter)" position="top">
                    <button
                        onClick={() => checkAndExecute(() => {
                            setBaseInputValue(""); 
                            handleAnalyze();
                            resetTextareaHeight();
                        })}
                        disabled={!isAiMode || isAnalyzing || isListening}
                        className={clsx(
                            "group flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-[11px] transition-all overflow-hidden relative shrink-0",
                            !isAiMode ? "bg-zinc-700 text-zinc-500 cursor-not-allowed" :
                            isAnalyzing ? "bg-sky-500/20 text-sky-400 cursor-wait" : "bg-sky-500 hover:bg-sky-400 text-white active:scale-95 disabled:opacity-50"
                        )}
                    >
                        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                        <span className="hidden sm:inline">{isAnalyzing ? "PROCESSING..." : "ANALYZE"}</span>
                    </button>
                </Tooltip>

                {/* Input Field */}
                <div className="flex-1 relative flex items-center">
                    {attachedImage && (
                        <div className="relative shrink-0 mr-2">
                            <img src={attachedImage} alt="Attached" className="h-8 w-8 object-cover rounded-md border border-zinc-500/30" />
                            <button 
                                onClick={() => setAttachedImage(null)}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:scale-110 transition-transform shadow-md"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            if (!isListening) {
                                setBaseInputValue(e.target.value); 
                            }
                            e.target.style.height = 'auto'; // Reset before measuring
                            const newHeight = Math.min(Math.max(e.target.scrollHeight, 40), 120);
                            e.target.style.height = `${newHeight}px`;
                            e.target.style.overflowY = newHeight >= 120 ? 'auto' : 'hidden';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && isAiMode) { 
                                e.preventDefault();
                                checkAndExecute(() => {
                                    setBaseInputValue(""); 
                                    handleAnalyze();
                                    resetTextareaHeight();
                                });
                            }
                        }}
                        placeholder={!isAiMode ? "System Link Offline..." : isListening ? "Listening..." : isAnalyzing ? "현재 시스템을 분석 중입니다..." : "Enter strategic command..."}
                        disabled={!isAiMode || isAnalyzing}
                        rows={1}
                        className={clsx(
                            "w-full bg-transparent px-2 py-2.5 text-[13px] focus:outline-none transition-colors resize-none custom-scrollbar leading-snug",
                            isDark 
                                ? "text-white placeholder-zinc-500" 
                                : "text-slate-900 placeholder-slate-500 font-medium",
                            !isAiMode && "cursor-not-allowed"
                        )}
                        style={{ overflowY: 'hidden' }}
                    />
                </div>

                {/* Attachments & STT */}
                <div className="flex items-center gap-1 pr-1">
                    <Tooltip content="Attach Image" position="top">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!isAiMode || isAnalyzing}
                            className={clsx(
                                "p-3 md:p-2.5 rounded-lg transition-all", 
                                !isAiMode ? "text-zinc-800" : "text-zinc-500 hover:bg-black/5 hover:text-sky-500"
                            )}
                        >
                            <ImageIcon size={20} className="md:w-[18px] md:h-[18px]" />
                        </button>
                    </Tooltip>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                    />
                    
                    {hasSupport && (
                        <Tooltip content={isListening ? "Stop STT" : "Start Voice Input"} position="top">
                            <button 
                                onClick={() => toggleListening()}
                                disabled={!isAiMode}
                                className={clsx(
                                    "p-3 md:p-2.5 rounded-lg transition-all", 
                                    !isAiMode ? "text-zinc-800" : isListening ? "bg-red-500 text-white shadow-lg" : "text-zinc-500 hover:bg-black/5"
                                )}
                            >
                                {isListening ? <MicOff size={20} className="md:w-[18px] md:h-[18px]" /> : <Mic size={20} className="md:w-[18px] md:h-[18px]" />}
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
};
