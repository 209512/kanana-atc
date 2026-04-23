// src/components/command/CommandCenter.tsx
import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { Send, Brain, Mic, MicOff, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useCommandCenter } from '@/hooks/system/useCommandCenter';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';
import { Tooltip } from '@/components/common/Tooltip';
import { useSTT } from '@/hooks/system/useSTT';

export const CommandCenter = () => {
    const { isDark } = useUIStore();
    const openKananaKeyModal = useUIStore(s => s.openKananaKeyModal);
    const isAiMode = useATCStore(s => s.isAiMode);
    const { inputValue, setInputValue, isAnalyzing, handleAnalyze, attachedImage, setAttachedImage } = useCommandCenter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [baseInputValue, setBaseInputValue] = useState("");

    const checkAndExecute = (action: () => void) => {
        // 클라이언트 스토리지가 아닌, API가 먼저 호출된 뒤 서버의 401(Missing Key) 응답을 받았을 때 모달을 띄우는 것이 안전합니다.
        // 현재는 환경변수로 키가 주입된 상황을 지원하기 위해, 클라이언트 키 검증을 생략하고 즉시 실행합니다.
        action();
    };

    const { isListening, toggleListening, hasSupport } = useSTT((text) => {
        // 기존에 타이핑된 텍스트(baseInputValue) 뒤에 음성 인식 텍스트를 이어붙임
        setInputValue(baseInputValue ? `${baseInputValue} ${text}` : text);
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && isAiMode) { 
            e.preventDefault();
            setBaseInputValue(""); // 전송 시 베이스 초기화
            handleAnalyze();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachedImage(reader.result as string);
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
                {/* 상태 표시기 */}
                <div className={clsx(
                    "absolute -top-3 left-6 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all z-10 select-none",
                    !isAiMode ? "bg-zinc-800 text-zinc-500" :
                    isAnalyzing ? "bg-sky-500 text-white animate-pulse" : 
                    isListening ? "bg-red-500 text-white animate-bounce" :
                    (isDark ? "bg-zinc-700 text-zinc-300" : "bg-slate-600 text-white")
                )}>
                    <Tooltip content={!isAiMode ? "System Link Offline" : "AI Core Active"} position="top">
                        <span>
                            {!isAiMode ? "AI_LINK_OFFLINE" : isAnalyzing ? "Kanana-O Analyzing..." : isListening ? "Listening..." : "Ready for Command"}
                        </span>
                    </Tooltip>
                </div>

                {/* Analyze 버튼 */}
                <Tooltip content="Analyze Strategic Command (Enter)" position="top">
                    <button
                        onClick={() => checkAndExecute(() => {
                            setBaseInputValue(""); // 전송 시 베이스 초기화
                            handleAnalyze();
                        })}
                        disabled={!isAiMode || isAnalyzing || isListening}
                        className={clsx(
                            "group flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-[11px] transition-all overflow-hidden relative shrink-0",
                            !isAiMode ? "bg-zinc-700 text-zinc-500 cursor-not-allowed" :
                            isAnalyzing ? "bg-sky-500/20 text-sky-400 cursor-wait" : "bg-sky-500 hover:bg-sky-400 text-white active:scale-95 disabled:opacity-50"
                        )}
                    >
                        <Brain size={16} />
                        <span className="hidden sm:inline">ANALYZE</span>
                    </button>
                </Tooltip>

                {/* 입력창 */}
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
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            if (!isListening) {
                                setBaseInputValue(e.target.value); // 타이핑할 때마다 베이스 갱신
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
                                    setBaseInputValue(""); // 전송 시 베이스 초기화
                                    handleAnalyze();
                                    // Reset height after analyze
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.overflowY = 'hidden';
                                });
                            }
                        }}
                        placeholder={!isAiMode ? "System Link Offline..." : isListening ? "Listening..." : "Enter strategic command..."}
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

                {/* 첨부파일 및 STT */}
                <div className="flex items-center gap-1 pr-1">
                    <Tooltip content="Attach Image" position="top">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!isAiMode || isAnalyzing}
                            className={clsx(
                                "p-2.5 rounded-lg transition-all",
                                !isAiMode ? "text-zinc-800" : "text-zinc-500 hover:bg-black/5 hover:text-sky-500"
                            )}
                        >
                            <ImageIcon size={18} />
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
                                onClick={toggleListening}
                                disabled={!isAiMode}
                                className={clsx(
                                    "p-2.5 rounded-lg transition-all",
                                    !isAiMode ? "text-zinc-800" : isListening ? "bg-red-500 text-white shadow-lg" : "text-zinc-500 hover:bg-black/5"
                                )}
                            >
                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
};
