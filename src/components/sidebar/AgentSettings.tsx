// src/components/sidebar/AgentSettings.tsx
import React, { useEffect, useState, useRef } from 'react';
import { X, Save, Key, Cpu, MessageSquare, Settings, ChevronDown, Type, Brain } from 'lucide-react';
import clsx from 'clsx';
import { useAgentSettings } from '@/hooks/agent/useAgentSettings';
import { useUIStore } from '@/store/useUIStore';

export const AgentSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [isAgentOpen, setIsAgentOpen] = useState(false);
    const [isProviderOpen, setIsProviderOpen] = useState(false);
    const [agentApiKey, setAgentApiKey] = useState("");
    const modalRef = useRef<HTMLDivElement>(null);
    const { terminalFontSize, setTerminalFontSize, openKananaKeyModal } = useUIStore();

    const {
        agents, isDark, areTooltipsEnabled, setAreTooltipsEnabled,
        selectedAgent, setSelectedAgent, provider, setProvider,
        model, setModel, systemPrompt, setSystemPrompt,
        isLoading, handleSubmit
    } = useAgentSettings(onClose);

    const providers = [
        { id: 'mock', name: 'Mock (Simulation)' },
        { id: 'openai', name: 'OpenAI (GPT-4)' },
        { id: 'anthropic', name: 'Anthropic (Claude 3)' },
        { id: 'gemini', name: 'Google Gemini' }
    ];
 
    useEffect(() => {
        try {
            const keys = JSON.parse(localStorage.getItem('AGENT_API_KEYS') || '{}');
            setAgentApiKey(keys[selectedAgent]?.[provider] || "");
        } catch {
            setAgentApiKey("");
        }
    }, [selectedAgent, provider]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div ref={modalRef} onClick={(e) => e.stopPropagation()}
                className={clsx("w-full max-w-md p-6 rounded-xl shadow-2xl border relative transition-all animate-in zoom-in-95 duration-200",
                    isDark ? "bg-[#0d1117] border-gray-700 text-gray-300" : "bg-white border-slate-200 text-slate-800")}>
                            
                <div className={clsx("flex justify-between items-center border-b pb-3 mb-5", isDark ? "border-white/10" : "border-slate-200")}>
                    <h2 className="flex items-center gap-2 font-mono font-bold tracking-widest uppercase text-xs">
                        <Settings size={14} className="text-blue-500" /> SYSTEM_CONFIG
                    </h2>
                    <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1 transition-opacity"><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 font-mono">
                    {/* Tooltip Toggle */}
                    <div className={clsx("p-3 rounded-lg border flex items-center justify-between", isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 opacity-70">
                            <MessageSquare size={12} /> INTERACTIVE_TOOLTIPS
                        </span>
                        <label className="cursor-pointer">
                            <input type="checkbox" checked={areTooltipsEnabled} onChange={(e) => setAreTooltipsEnabled(e.target.checked)} className="sr-only" />
                            <div className={clsx("w-8 h-4 rounded-full transition-colors relative", areTooltipsEnabled ? "bg-blue-600" : "bg-gray-600")}>
                                <div className={clsx("absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform", areTooltipsEnabled ? "translate-x-4" : "translate-x-0")} />
                            </div>
                        </label>
                    </div>

                    {/* Font Size Slider */}
                    <div className={clsx("p-3 rounded-lg border", isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 opacity-70">
                                <Type size={12} /> TERMINAL_FONT_SIZE
                            </span>
                            <span className="text-[10px] font-bold opacity-50">{terminalFontSize}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="10" max="18" step="1" 
                            value={terminalFontSize} 
                            onChange={(e) => setTerminalFontSize(Number(e.target.value))}
                            className={clsx(
                                "w-full appearance-none h-1.5 rounded-full outline-none",
                                isDark ? "bg-gray-700 accent-blue-500" : "bg-gray-300 accent-blue-500"
                            )}
                        />
                    </div>

                    {/* Main System Kanana Key Settings */}
                    <div className={clsx("p-3 rounded-lg border flex items-center justify-between", isDark ? "bg-cyan-900/10 border-cyan-500/20" : "bg-cyan-50 border-cyan-200")}>
                        <div className="flex items-center gap-2">
                            <Brain size={14} className="text-cyan-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90 text-cyan-600 dark:text-cyan-400">
                                MAIN_SYSTEM_KEY (KANANA)
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                onClose(); // 설정 모달을 닫고
                                openKananaKeyModal(); // 카나나 키 모달을 엽니다.
                            }}
                            className={clsx(
                                "px-3 py-1.5 text-[9px] font-bold rounded transition-all shadow-sm",
                                isDark ? "bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40" : "bg-cyan-600 text-white hover:bg-cyan-700"
                            )}
                        >
                            UPDATE KEY
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 relative">
                        {/* Agent Selector */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50">Target Agent</label>
                            <button type="button" onClick={() => { setIsAgentOpen(!isAgentOpen); setIsProviderOpen(false); }} 
                                className={clsx("w-full h-9 px-3 rounded border text-[11px] flex items-center justify-between", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")}>
                                <span className="truncate">{agents.find(a => a.id === selectedAgent)?.displayId || "Select"}</span>
                                <ChevronDown size={12} className={clsx("transition-transform", isAgentOpen && "rotate-180")} />
                            </button>
                            {isAgentOpen && (
                                <div className={clsx("absolute z-[110] w-[calc(50%-6px)] mt-1 border rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar", isDark ? "bg-gray-900 border-gray-700" : "bg-white border-slate-200")}>
                                    {agents.map((a) => (
                                        <div key={a.id} onClick={() => { setSelectedAgent(a.id); setIsAgentOpen(false); }}
                                            className="p-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-white/5 last:border-0 text-[11px]">
                                            {a.displayId || a.id}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Provider Selector */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50">Provider</label>
                            <button type="button" onClick={() => { setIsProviderOpen(!isProviderOpen); setIsAgentOpen(false); }}
                                className={clsx("w-full h-9 px-3 rounded border text-[11px] flex items-center justify-between", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")}>
                                <span className="truncate">{providers.find(p => p.id === provider)?.name || "Select"}</span>
                                <ChevronDown size={12} className={clsx("transition-transform", isProviderOpen && "rotate-180")} />
                            </button>
                            {isProviderOpen && (
                                <div className={clsx("absolute z-[110] right-0 w-[calc(50%-6px)] mt-1 border rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar", isDark ? "bg-gray-900 border-gray-700" : "bg-white border-slate-200")}>
                                    {providers.map((p) => (
                                        <div key={p.id} onClick={() => { setProvider(p.id); setIsProviderOpen(false); }}
                                            className="p-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-white/5 last:border-0 text-[11px]">
                                            {p.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* API Key Input (Local Storage) */}
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1"><Key size={10} /> API_KEY (LOCAL)</label>
                        <input type="password" 
                            placeholder={`Enter ${providers.find(p => p.id === provider)?.name || 'Provider'} API Key`}
                            value={agentApiKey}
                            onChange={(e) => {
                                setAgentApiKey(e.target.value);
                                try {
                                    const keys = JSON.parse(localStorage.getItem('AGENT_API_KEYS') || '{}');
                                    if (!keys[selectedAgent]) keys[selectedAgent] = {};
                                    keys[selectedAgent][provider] = e.target.value;
                                    localStorage.setItem('AGENT_API_KEYS', JSON.stringify(keys));
                                } catch {}
                            }}
                            className={clsx("w-full h-9 px-3 rounded border text-[11px] outline-none focus:border-blue-500", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")} />
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1"><Cpu size={10} /> MODEL_OVERRIDE</label>
                            <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. gpt-4-turbo"
                                className={clsx("w-full h-9 px-3 rounded border text-[11px] outline-none focus:border-blue-500", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1"><MessageSquare size={10} /> SYSTEM_PERSONA</label>
                            <textarea rows={3} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                                className={clsx("w-full p-3 rounded border text-[11px] outline-none focus:border-blue-500 resize-none custom-scrollbar", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")} />
                        </div>
                    </div>
                    
                    <button type="submit" disabled={isLoading}
                        className={clsx("w-full h-10 mt-2 font-bold rounded flex items-center justify-center gap-2 transition-all uppercase text-[11px] tracking-widest",
                            isLoading ? "bg-gray-700 opacity-50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95")}>
                        <Save size={14} /> {isLoading ? 'UPDATING...' : 'DEPLOY_CONFIG'}
                    </button>
                </form>
            </div>
        </div>
    );
};
