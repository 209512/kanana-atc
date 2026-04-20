import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Brain, X } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useATCStore } from '@/store/useATCStore';

export const KananaKeyModal = () => {
  const isDark = useUIStore(s => s.isDark);
  const isOpen = useUIStore(s => s.isKananaKeyModalOpen);
  const close = useUIStore(s => s.closeKananaKeyModal);

  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const localKey = localStorage.getItem('KANANA_API_KEY');
    const sessionKey = sessionStorage.getItem('KANANA_API_KEY');
    if (localKey) {
      setRemember(true);
      setValue(localKey);
      return;
    }
    setRemember(false);
    setValue(sessionKey || '');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md"
      onMouseDown={close}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "w-full max-w-sm p-6 rounded-xl shadow-2xl border relative transition-all animate-in zoom-in-95 duration-200",
          isDark ? "bg-[#0d1117] border-cyan-500/30 text-gray-300" : "bg-white border-slate-200 text-slate-800"
        )}
      >
        <button
          onClick={close}
          className="absolute top-3 right-3 opacity-60 hover:opacity-100 p-1 transition-opacity"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-cyan-500" />
          <h2 className="font-mono font-bold tracking-widest uppercase text-xs">KANANA_API_KEY</h2>
        </div>

        <p className="text-[11px] opacity-70 leading-relaxed mb-4 break-keep">
          Kanana-o API 키 미입력 시 <strong>시뮬레이션 모드(모의 데이터)</strong>로 작동합니다. 실제 AI와 통신하려면 유효한 키를 입력해주세요. <br />
          <span className="text-[10px] opacity-60 mt-1 block">※ 입력된 키는 서버로 전송되지 않고 현재 브라우저에만 안전하게 저장됩니다.</span>
        </p>

        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter Kanana-o API Key"
          className={clsx(
            "w-full h-10 px-3 rounded border text-[12px] outline-none focus:border-cyan-500",
            isDark ? "bg-black border-gray-700 text-cyan-100" : "bg-white border-slate-300 text-slate-900"
          )}
        />

        <label className="flex items-center gap-2 mt-3 text-[11px] opacity-80 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-cyan-500"
          />
          Remember on this device
        </label>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => {
              sessionStorage.removeItem('KANANA_API_KEY');
              localStorage.removeItem('KANANA_API_KEY');
              // 키 삭제 시 초기 설정된 쿼터(20)로 리셋하여 시뮬레이션 모드에서 정상 작동하도록 처리
              const defaultQuota = Number(import.meta.env?.VITE_AI_QUOTA) || 20;
              useATCStore.getState().setAiQuota(defaultQuota);
              close();
            }}
            className={clsx(
              "h-10 rounded font-bold uppercase text-[11px] tracking-widest border transition-all",
              isDark ? "bg-transparent border-gray-700 text-gray-400 hover:text-gray-200" : "bg-transparent border-slate-300 text-slate-600 hover:text-slate-800"
            )}
          >
            CLEAR
          </button>
          <button
            onClick={() => {
              const trimmed = value.trim();
              if (trimmed) {
                if (remember) {
                  localStorage.setItem('KANANA_API_KEY', trimmed);
                  sessionStorage.removeItem('KANANA_API_KEY');
                } else {
                  sessionStorage.setItem('KANANA_API_KEY', trimmed);
                  localStorage.removeItem('KANANA_API_KEY');
                }
                // 새 키 입력 시 초기 설정된 쿼터(20)로 리셋
                const defaultQuota = Number(import.meta.env?.VITE_AI_QUOTA) || 20;
                useATCStore.getState().setAiQuota(defaultQuota);
              }
              close();
            }}
            className="h-10 rounded font-bold uppercase text-[11px] tracking-widest bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg active:scale-95 transition-all"
          >
            CONNECT
          </button>
        </div>
      </div>
    </div>
  );
};
