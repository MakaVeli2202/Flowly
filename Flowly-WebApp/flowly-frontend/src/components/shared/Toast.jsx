import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};
const COLORS = {
  success: 'from-green-500/20 to-emerald-500/10 border-green-500/40 text-green-300',
  error: 'from-rose-500/20 to-red-500/10 border-rose-500/40 text-rose-300',
  warning: 'from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300',
  info: 'from-blue-500/20 to-cyan-500/10 border-blue-500/40 text-blue-300',
};
const BG_COLORS = {
  success: 'bg-green-500/10',
  error: 'bg-rose-500/10',
  warning: 'bg-amber-500/10',
  info: 'bg-blue-500/10',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[300px] max-w-sm bg-[var(--surface-bg)] ${COLORS[t.type] || COLORS.info}`}
            >
              <div className={`absolute inset-0 opacity-30 ${BG_COLORS[t.type] || BG_COLORS.info}`} />
              <div className="relative flex items-start gap-3 px-4 py-3.5">
                <div className={`p-2 rounded-xl ${BG_COLORS[t.type] || BG_COLORS.info}`}>
                  <Icon size={16} className="flex-shrink-0" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-color)] leading-snug">{t.message}</p>
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--muted-color)] hover:text-[var(--text-color)] transition flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
