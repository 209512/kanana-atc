// src/components/monitoring/terminal/terminalConfigs.ts
import { LOG_LEVELS } from '@/utils/logStyles';

/* 터미널 UI 테마 설정 */
export const THEME_COLORS = {
  insight: {
    base: "text-sky-400",
    border: "border-sky-500",
    bg: "bg-sky-500/20",
    glow: "rgba(14,165,233,0.4)",
    hex: LOG_LEVELS.insight.color,
    full: "text-sky-400 border-sky-500 bg-sky-500/20 shadow-[0_0_8px_rgba(14,165,233,0.3)]",
  },
  proposal: {
    base: "text-amber-400",
    border: "border-amber-500",
    bg: "bg-amber-500/20",
    glow: "rgba(251,191,36,0.4)",
    hex: LOG_LEVELS.proposal.color,
    full: "text-amber-400 border-amber-500 bg-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.3)]",
  },
  exec: {
    base: "text-indigo-400",
    border: "border-indigo-500",
    bg: "bg-indigo-500/20",
    glow: "rgba(99,102,241,0.4)",
    hex: LOG_LEVELS.exec.color,
    full: "text-indigo-400 border-indigo-500 bg-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.3)]",
  },
};

export interface FilterConfig {
  label: string;
  value: string;
  shortcut: string;
  types?: string[];
}

/* 로그 필터 버튼 구성 */
export const LOG_FILTER_CONFIG: FilterConfig[] = [
  { label: 'ALL',  value: 'ALL',      shortcut: 'A' },
  { label: 'INFO', value: 'info',     shortcut: 'I' },
  { label: 'WARN', value: 'warn',     shortcut: 'W' },
  { label: 'LOCK', value: 'lock',     shortcut: 'L', types: ['lock', 'success'] },
  { label: 'SYS',  value: 'system',   shortcut: 'S' },
  { label: 'PLC',  value: 'policy',   shortcut: 'P' },
  { label: 'CRIT', value: 'critical', shortcut: 'C', types: ['critical', 'error'] },
  { label: 'INS',  value: 'insight',  shortcut: 'N' },
  { label: 'PROP', value: 'proposal', shortcut: 'O' },
  { label: 'EXE',  value: 'exec',     shortcut: 'X' },
];

/* 특정 로그의 타입이 설정된 필터 값에 해당하는지 체크하는 헬퍼 */
export const matchLogType = (logType: string, filterValue: string): boolean => {
  if (filterValue === 'ALL') return true;
  const config = LOG_FILTER_CONFIG.find(c => c.value === filterValue);
  if (config?.types) return config.types.includes(logType);
  return logType === filterValue;
};