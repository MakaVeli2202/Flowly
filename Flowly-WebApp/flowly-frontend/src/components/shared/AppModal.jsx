import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, CheckCircle, Loader2 } from 'lucide-react';

const ICONS = {
  danger: { icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/20' },
  info: { icon: Info, color: 'text-blue-400 bg-blue-500/20' },
  success: { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/20' },
};

const CONFIRM_STYLES = {
  danger: 'from-rose-500 to-red-500 hover:shadow-lg hover:shadow-rose-500/25 text-white',
  warning: 'from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/25 text-white',
  info: 'from-primary to-secondary hover:shadow-lg hover:shadow-primary/25 text-white',
  success: 'from-emerald-500 to-green-500 hover:shadow-lg hover:shadow-emerald-500/25 text-white',
};

/**
 * Generic modal for confirmations and error/info alerts.
 *
 * Props:
 *   isOpen        boolean
 *   title         string
 *   message       string | ReactNode
 *   variant       'danger' | 'warning' | 'info' | 'success'  (default: 'info')
 *   confirmLabel  string (default: 'Confirm')
 *   cancelLabel   string (default: 'Cancel') — omit the cancel button by passing cancelLabel={null}
 *   onConfirm     () => void
 *   onClose       () => void  — called on backdrop click, X, or cancel
 *   children      optional extra content below message
 *   loading       boolean — shows loading spinner on confirm button
 */
function AppModal({
  isOpen,
  title,
  message,
  variant = 'info',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  children,
  loading = false,
  size = 'md',
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const config = ICONS[variant] || ICONS.info;
  const IconComponent = config.icon;
  const maxWidth = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Card with slide-up animation */}
      <div className={`relative z-10 w-full ${maxWidth} rounded-2xl bg-[var(--surface-bg)] border border-[var(--border-color)] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200`}>
        {/* Glow effect for important modals */}
        {variant === 'danger' && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none" />
        )}

        {/* Header */}
        <div className="flex items-start gap-4 p-5 pb-0">
          <div className={`p-2.5 rounded-xl ${config.color}`}>
            <IconComponent size={22} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-base font-bold text-[var(--heading-color)] leading-snug">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-[var(--muted-color)] hover:text-[var(--heading-color)] hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        {(message || children) && (
          <div className="px-5 pt-3">
            {message && (
              <p className="text-sm text-[var(--text-color)] leading-relaxed pl-1">{message}</p>
            )}
            {children && (
              <div className="mt-3 text-sm text-[var(--text-color)]">{children}</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 p-5 pt-4">
          {cancelLabel !== null && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] text-sm font-semibold hover:border-primary/50 hover:bg-white/5 transition-all disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 bg-gradient-to-r ${CONFIRM_STYLES[variant] || CONFIRM_STYLES.info} disabled:opacity-50`}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppModal;
