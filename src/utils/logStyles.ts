export type LogType = 'critical' | 'error' | 'warn' | 'success' | 'system' | 'info' | 'lock' | 'policy' | 'insight' | 'proposal' | 'exec';

export const LOG_LEVELS: Record<LogType, { color: string; tag: string; label: string }> = {
    critical: { color: '#ef4444', tag: '[CRIT]', label: 'CRITICAL' },
    error:    { color: '#f97316', tag: '[ERR ]', label: 'ERROR' },
    warn:     { color: '#f59e0b', tag: '[WARN]', label: 'WARNING' },
    success:  { color: '#10b981', tag: '[ACQ ]', label: 'SUCCESS' },
    system:   { color: '#a855f7', tag: '[SYS ]', label: 'SYSTEM' },
    info:     { color: '#3b82f6', tag: '[INFO]', label: 'INFO' },
    lock:     { color: '#10b981', tag: '[LOCK]', label: 'LOCK_GRANTED' },
    policy:   { color: '#84cc16', tag: '[PLC ]', label: 'POLICY' },
    insight:  { color: '#0ea5e9', tag: '[AI💡]', label: 'AI_INSIGHT' },
    proposal: { color: '#fbbf24', tag: '[PROP]', label: 'AI_PROPOSAL' },
    exec:     { color: '#6366f1', tag: '[EXE ]', label: 'EXECUTION' },
};

export const getLogStyle = (type: LogType, isDark: boolean) => {
    const base = LOG_LEVELS[type] || LOG_LEVELS.info;
    const tailwindColors: Record<LogType, string> = {
        critical: 'text-red-600 font-black animate-pulse',
        error:    'text-orange-600 font-black',
        warn:     'text-amber-600 font-bold',
        success:  'text-emerald-600 font-bold',
        system:   'text-purple-600 font-bold',
        info:     isDark ? 'text-blue-400' : 'text-blue-700 font-semibold',
        lock:     isDark ? 'text-emerald-400 font-bold brightness-125' : 'text-emerald-700 font-black',
        policy:   isDark ? 'text-lime-400 font-bold' : 'text-lime-800 font-bold',
        insight:  isDark 
            ? 'text-sky-300 bg-sky-500/5 border-l-2 border-sky-400/50 shadow-[inset_0_0_10px_rgba(14,165,233,0.05)]' 
            : 'text-sky-900 bg-sky-100/50 border-l-2 border-sky-600 shadow-sm',
        proposal: isDark 
            ? 'text-amber-300 bg-amber-500/10 border-l-2 border-amber-400 animate-pulse' 
            : 'text-amber-900 bg-amber-100/50 border-l-2 border-amber-600 font-bold',
        exec: isDark 
            ? 'text-indigo-400 font-bold border-l-2 border-indigo-500 bg-indigo-500/5' 
            : 'text-indigo-900 font-black border-l-2 border-indigo-600 bg-indigo-100/50',
    };
    return { ...base, className: tailwindColors[type] || tailwindColors.info };
};