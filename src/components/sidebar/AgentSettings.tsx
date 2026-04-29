import React, { useEffect, useState, useRef } from 'react';
import { X, Save, Key, Cpu, MessageSquare, Settings, ChevronDown, Type, Brain, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAgentSettings } from '@/hooks/agent/useAgentSettings';
import { useUIStore } from '@/store/useUIStore';
import { updateAgentKeyAsync, hasAgentKeyAsync } from '@/utils/secureStorage';
import { request } from '@/utils/apiClient';

const modelsByProvider: Record<string, string[]> = {
    gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    mock: ['mock-model']
};

export const AgentSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [isAgentOpen, setIsAgentOpen] = useState(false);
    const [isProviderOpen, setIsProviderOpen] = useState(false);
    const [isModelOpen, setIsModelOpen] = useState(false);
    const [agentApiKey, setAgentApiKey] = useState("");
    const [modelChecks, setModelChecks] = useState<Record<string, { status: 'idle' | 'checking' | 'ok' | 'fail'; mock?: boolean; error?: string }>>({});
    const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const { terminalFontSize, setTerminalFontSize, openKananaKeyModal } = useUIStore();

    const {
        agents, isDark, areTooltipsEnabled, setAreTooltipsEnabled,
        selectedAgent, setSelectedAgent, provider, setProvider,
        model, setModel, systemPrompt, setSystemPrompt,
        isLoading, handleSubmit, handleSave
    } = useAgentSettings(onClose);

    const providers = [
        { id: 'mock', name: 'Mock (Simulation)' },
        { id: 'openai', name: 'OpenAI (GPT-4)' },
        { id: 'anthropic', name: 'Anthropic (Claude 3)' },
        { id: 'gemini', name: 'Google Gemini' }
    ];
 
    useEffect(() => {
        const loadKey = async () => {
            try {
                const hasKey = await hasAgentKeyAsync(selectedAgent, provider);
                setAgentApiKey(hasKey ? "••••••••••••••••" : "");
            } catch {
                setAgentApiKey("");
            }
        };
        loadKey();
    }, [selectedAgent, provider]);

    useEffect(() => {
        const baseModels = modelsByProvider[provider] || [];
        const keyPrefix = `${selectedAgent}:${provider}:`;
        const verified = baseModels.filter((m) => modelChecks[`${keyPrefix}${m}`]?.status === 'ok');
        const availableModels = provider === 'gemini' && showVerifiedOnly && verified.length > 0 ? verified : baseModels;
        if (availableModels.length > 0 && !availableModels.includes(model)) setModel(availableModels[0]);
    }, [provider, model, setModel, modelChecks, selectedAgent, showVerifiedOnly]);

    const modelCheckKey = `${selectedAgent}:${provider}:${model}`;
    const modelCheck = modelChecks[modelCheckKey] || { status: 'idle' as const };
    const modelBadge = provider === 'gemini' && modelCheck.status !== 'idle';

    const testCurrentModel = async () => {
        if (provider !== 'gemini') return;
        const key = `${selectedAgent}:${provider}:${model}`;
        setModelChecks((s) => ({ ...s, [key]: { status: 'checking' } }));
        try {
            const agent = agents.find((a) => a.id === selectedAgent);
            const payload = {
                agentId: selectedAgent,
                agentName: agent?.displayId || agent?.displayName || agent?.id || selectedAgent,
                model,
                externalData: { risk_level: 5 },
                state: { logs: [] }
            };
            const res: any = await request('/gemini', { method: 'POST', body: JSON.stringify(payload), timeout: 12000, retries: 0 });
            if (!res || res.error) {
                setModelChecks((s) => ({ ...s, [key]: { status: 'fail', error: String(res?.error || 'UNKNOWN_ERROR') } }));
                return;
            }
            setModelChecks((s) => ({ ...s, [key]: { status: 'ok', mock: !!res.mock } }));
        } catch (e: any) {
            setModelChecks((s) => ({ ...s, [key]: { status: 'fail', error: String(e?.message || e) } }));
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div ref={modalRef} onClick={(e) => e.stopPropagation()}
                className={clsx("w-full max-w-md p-6 rounded-xl shadow-2xl border relative transition-all animate-in zoom-in-95 duration-200",
                    isDark ? "bg-[#0d1117] border-gray-700 text-gray-300" : "bg-white border-slate-200 text-slate-800")}>
                            
                <div className={clsx("flex justify-between items-center border-b pb-3 mb-5", isDark ? "border-white/10" : "border-slate-200")}>
                    <h2 className="flex items-center gap-2 font-mono font-bold tracking-widest uppercase text-xs">
                        <Settings size={14} className="text-blue-500" /> SYSTEM_CONFIG
                        {/* TODO(i18n): replace hardcoded labels */}
                    </h2>
                    <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1 transition-opacity"><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 font-mono">
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
                                onClose(); 
                                openKananaKeyModal(); 
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
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50">Target Agent</label>
                            <button type="button" onClick={() => { setIsAgentOpen(!isAgentOpen); setIsProviderOpen(false); setIsModelOpen(false); }} 
                                className={clsx("w-full h-9 px-3 rounded border text-[11px] flex items-center justify-between", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")}>
                                <span className="truncate">{agents.find(a => a.id === selectedAgent)?.displayId || "Select"}</span>
                                <ChevronDown size={12} className={clsx("transition-transform", isAgentOpen && "rotate-180")} />
                            </button>
                            {isAgentOpen && (
                                <div className={clsx("absolute z-[110] w-[calc(50%-6px)] mt-1 border rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar", isDark ? "bg-gray-900 border-gray-700" : "bg-white border-slate-200")}>
                                    {agents.map((a) => (
                                        <div key={a.id} onClick={() => { setSelectedAgent(a.id); setIsAgentOpen(false); setIsModelOpen(false); }}
                                            className="p-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-white/5 last:border-0 text-[11px]">
                                            {a.displayId || a.id}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50">Provider</label>
                            <button type="button" onClick={() => { setIsProviderOpen(!isProviderOpen); setIsAgentOpen(false); setIsModelOpen(false); }}
                                className={clsx("w-full h-9 px-3 rounded border text-[11px] flex items-center justify-between", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")}>
                                <span className="truncate">{providers.find(p => p.id === provider)?.name || "Select"}</span>
                                <ChevronDown size={12} className={clsx("transition-transform", isProviderOpen && "rotate-180")} />
                            </button>
                            {isProviderOpen && (
                                <div className={clsx("absolute z-[110] right-0 w-[calc(50%-6px)] mt-1 border rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar", isDark ? "bg-gray-900 border-gray-700" : "bg-white border-slate-200")}>
                                    {providers.map((p) => (
                                        <div key={p.id} onClick={() => { setProvider(p.id); setIsProviderOpen(false); setIsModelOpen(false); }}
                                            className="p-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-white/5 last:border-0 text-[11px]">
                                            {p.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1"><Key size={10} /> API_KEY (LOCAL)</label>
                        <input type="password" 
                            placeholder={`Enter ${providers.find(p => p.id === provider)?.name || 'Provider'} API Key`}
                            value={agentApiKey}
                            onChange={async (e) => {
                                setAgentApiKey(e.target.value);
                                try {
                                    await updateAgentKeyAsync(selectedAgent, provider, e.target.value);
                                } catch {}
                            }}
                            className={clsx("w-full h-9 px-3 rounded border text-[11px] outline-none focus:border-blue-500", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")} />
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1 relative">
                            <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1"><Cpu size={10} /> MODEL_OVERRIDE</label>
                            {provider === 'gemini' && (
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <label className="flex items-center gap-2 text-[9px] font-bold uppercase opacity-60 select-none cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showVerifiedOnly}
                                            onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                                            className="accent-blue-500"
                                        />
                                        SHOW_VERIFIED_ONLY
                                    </label>
                                    <button
                                        type="button"
                                        onClick={testCurrentModel}
                                        disabled={modelCheck.status === 'checking'}
                                        className={clsx(
                                            "px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-wider min-h-[28px] flex items-center gap-1",
                                            modelCheck.status === 'checking'
                                                ? "bg-gray-700/40 border-gray-600 text-gray-300 cursor-not-allowed"
                                                : "bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30"
                                        )}
                                    >
                                        {modelCheck.status === 'checking' ? <Loader2 size={12} className="animate-spin" /> : null}
                                        TEST
                                    </button>
                                </div>
                            )}
                            <button type="button" onClick={() => { setIsModelOpen(!isModelOpen); setIsProviderOpen(false); setIsAgentOpen(false); }}
                                className={clsx("w-full h-9 px-3 rounded border text-[11px] flex items-center justify-between", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")}>
                                <span className="truncate flex items-center gap-2">
                                    <span className="truncate">{model || "Select Model"}</span>
                                    {modelBadge && (
                                        <span className={clsx(
                                            "px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase",
                                            modelCheck.status === 'ok'
                                                ? (modelCheck.mock ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300")
                                                : modelCheck.status === 'fail'
                                                    ? "bg-red-500/10 border-red-500/30 text-red-300"
                                                    : "bg-gray-500/10 border-gray-500/30 text-gray-300"
                                        )}>
                                            {modelCheck.status === 'ok' ? (modelCheck.mock ? 'SIM' : 'OK') : modelCheck.status === 'fail' ? 'FAIL' : '...'}
                                        </span>
                                    )}
                                </span>
                                <ChevronDown size={12} className={clsx("transition-transform", isModelOpen && "rotate-180")} />
                            </button>
                            {isModelOpen && (
                                <div className={clsx("absolute z-[110] w-full mt-1 border rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar", isDark ? "bg-gray-900 border-gray-700" : "bg-white border-slate-200")}>
                                    {(() => {
                                        const base = modelsByProvider[provider] || [];
                                        if (provider !== 'gemini' || !showVerifiedOnly) return base;
                                        const keyPrefix = `${selectedAgent}:${provider}:`;
                                        const verified = base.filter((m) => modelChecks[`${keyPrefix}${m}`]?.status === 'ok');
                                        return verified.length > 0 ? verified : base;
                                    })().map((m) => (
                                        <div key={m} onClick={() => { setModel(m); setIsModelOpen(false); }}
                                            className="p-2 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-white/5 last:border-0 text-[11px]">
                                            {m}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {provider === 'gemini' && modelCheck.status === 'fail' && modelCheck.error && (
                                <div className="mt-1 text-[10px] text-red-400 break-words">
                                    {modelCheck.error}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1"><MessageSquare size={10} /> SYSTEM_PERSONA</label>
                            <textarea rows={3} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                                className={clsx("w-full p-3 rounded border text-[11px] outline-none focus:border-blue-500 resize-none custom-scrollbar", isDark ? "bg-black border-gray-700" : "bg-white border-slate-300")} />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                        <button type="button" disabled={isLoading}
                            onClick={() => handleSave(false)}
                            className={clsx("flex-1 h-10 font-bold rounded flex items-center justify-center gap-2 transition-all uppercase text-[11px] tracking-widest",
                                isLoading ? "bg-gray-700 opacity-50 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-95")}>
                            <Save size={14} /> {isLoading ? 'SAVING...' : 'SAVE_ONLY'}
                        </button>
                        <button type="submit" disabled={isLoading}
                            className={clsx("flex-1 h-10 font-bold rounded flex items-center justify-center gap-2 transition-all uppercase text-[11px] tracking-widest",
                                isLoading ? "bg-gray-700 opacity-50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95")}>
                            <Save size={14} /> {isLoading ? 'UPDATING...' : 'DEPLOY_CONFIG'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
