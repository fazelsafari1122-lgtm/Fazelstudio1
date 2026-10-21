import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { errMsg } from '../../hooks.ts';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; text: string }
interface ConfirmState { message: string; title?: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }

interface UiApi {
  success: (text?: string) => void;
  error: (e?: any) => void;
  info: (text: string) => void;
  confirm: (message: string, opts?: { title?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('UiProvider missing');
  return ctx;
}

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const idRef = useRef(1);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3000);
  }, []);

  const api = useMemo<UiApi>(() => ({
    success: (text) => push('success', text || 'با موفقیت ثبت شد'),
    error: (e) => push('error', typeof e === 'string' ? e : errMsg(e)),
    info: (text) => push('info', text),
    confirm: (message, opts) => new Promise<boolean>((resolve) => setConfirmState({ message, ...opts, resolve })),
  }), [push]);

  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <UiContext.Provider value={api}>
      {children}
      <div className="fixed top-4 left-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-80" dir="rtl" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm shadow-xl border backdrop-blur ${
              t.kind === 'success' ? 'bg-emerald-950/90 border-emerald-700/60 text-emerald-100'
                : t.kind === 'error' ? 'bg-rose-950/90 border-rose-700/60 text-rose-100'
                  : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            {t.kind === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : t.kind === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="flex-1 leading-6">{t.text}</span>
            <button onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" dir="rtl" onClick={() => close(false)}>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${confirmState.danger === false ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 mb-1">{confirmState.title || 'تأیید عملیات'}</h3>
                <p className="text-sm text-slate-300 leading-6">{confirmState.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => close(false)} className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-200">انصراف</button>
              <button autoFocus onClick={() => close(true)} className={`px-4 py-2 rounded-xl text-sm font-medium ${confirmState.danger === false ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}>
                {confirmState.confirmLabel || 'بله، مطمئنم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
};
