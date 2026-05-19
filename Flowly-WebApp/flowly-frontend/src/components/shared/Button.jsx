import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  ...props
}) {
  const variants = {
    primary: 'from-primary to-secondary text-white hover:shadow-lg hover:shadow-primary/25',
    secondary: 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/10',
    ghost: 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5',
    danger: 'from-rose-500 to-red-500 text-white hover:shadow-lg hover:shadow-rose-500/25',
    success: 'from-emerald-500 to-green-500 text-white hover:shadow-lg hover:shadow-emerald-500/25',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  const disabledStyles = 'opacity-50 cursor-not-allowed pointer-events-none';

  return (
    <button
      className={`
        inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200
        bg-gradient-to-r ${variants[variant]} ${sizes[size]}
        ${disabled || loading ? disabledStyles : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : 16} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : 16} />}
        </>
      )}
    </button>
  );
}

export function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'text-primary hover:bg-primary/10',
    secondary: 'text-[var(--text-color)] hover:bg-white/10',
    ghost: 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5',
    danger: 'text-rose-400 hover:bg-rose-500/20',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg transition-all duration-200
        ${variants[variant]} ${sizes[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : children}
    </button>
  );
}