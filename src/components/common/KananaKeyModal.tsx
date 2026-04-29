import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Brain, X } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { encryptDataAsync, SECURE_STORAGE_KEYS } from '@/utils/secureStorage';

export const KananaKeyModal = () => {
  const isDark = useUIStore(s => s.isDark);
  const isOpen = useUIStore(s => s.isKananaKeyModalOpen);
  const close = useUIStore(s => s.closeKananaKeyModal);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const localKeyRaw = window.localStorage.getItem(SECURE_STORAGE_KEYS.KANANA_API_KEY);
      const sessionKeyRaw = window.sessionStorage.getItem(SECURE_STORAGE_KEYS.KANANA_API_KEY);
      
      if (localKeyRaw) {
          setValue("••••••••••••••••");
          setRemember(true);
      } else if (sessionKeyRaw) {
          setValue("••••••••••••••••");
          setRemember(false);
      } else {
          setValue("");
          setRemember(false);
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onMouseDown = (e: MouseEvent) => {
      const root = modalRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (root.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab') {
        const root = modalRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const isShift = e.shiftKey;

        if (!active || !root.contains(active)) {
          e.preventDefault();
          first.focus();
          return;
        }

        if (isShift && active === first) {
          e.preventDefault();
          last.focus();
          return;
        }

        if (!isShift && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md"
      onMouseDown={close}
    >
      <div
        ref={modalRef}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanana-key-modal-title"
        className={clsx(
          "w-full max-w-sm p-6 rounded-xl shadow-2xl border relative transition-all animate-in zoom-in-95 duration-200",
          isDark ? "bg-[#0d1117] border-cyan-500/30 text-gray-300" : "bg-white border-slate-200 text-slate-800"
        )}
      >
        <button
          onClick={close}
          className="absolute top-3 right-3 opacity-60 hover:opacity-100 p-1 transition-opacity"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-cyan-500" />
          <h2 id="kanana-key-modal-title" className="font-mono font-bold tracking-widest uppercase text-xs">KANANA_API_KEY</h2>
        </div>

        <p className="text-[11px] opacity-70 leading-relaxed mb-4 break-keep">
          Kanana-o API 키 미입력 시 <strong>시뮬레이션 모드(모의 데이터)</strong>로 작동합니다. 실제 AI와 통신하려면 유효한 키를 입력해주세요. <br />
          <span className="text-[10px] opacity-60 mt-1 block">※ 입력된 키는 서버로 전송되지 않고 현재 브라우저에만 안전하게 저장됩니다.</span>
        </p>

        <input
          type="password"
          ref={inputRef}
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
              sessionStorage.removeItem(SECURE_STORAGE_KEYS.KANANA_API_KEY);
              localStorage.removeItem(SECURE_STORAGE_KEYS.KANANA_API_KEY);
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
            onClick={async () => {
              const trimmed = value.trim();
              if (trimmed) {
                const encodedKey = await encryptDataAsync(trimmed);
                if (remember) {
                  localStorage.setItem(SECURE_STORAGE_KEYS.KANANA_API_KEY, encodedKey);
                  sessionStorage.removeItem(SECURE_STORAGE_KEYS.KANANA_API_KEY);
                } else {
                  sessionStorage.setItem(SECURE_STORAGE_KEYS.KANANA_API_KEY, encodedKey);
                  localStorage.removeItem(SECURE_STORAGE_KEYS.KANANA_API_KEY);
                }
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
