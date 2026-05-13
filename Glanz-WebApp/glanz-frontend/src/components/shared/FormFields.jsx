import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export function FormField({ 
  children, 
  label, 
  error, 
  hint, 
  required, 
  className = '' 
}) {
  const hasError = !!error;
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-[var(--text-color)]">
          {label}
          {required && <span className="text-rose-400 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && !hasError && (
        <p className="text-xs text-[var(--muted-color)]">{hint}</p>
      )}
      {hasError && (
        <InputError message={error} />
      )}
    </div>
  );
}

export function InputError({ message, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs text-rose-400 animate-in slide-in-from-top-1 fade-in duration-200 ${className}`}>
      <AlertCircle size={12} className="flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function InputSuccess({ message, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs text-emerald-400 animate-in slide-in-from-top-1 fade-in duration-200 ${className}`}>
      <CheckCircle size={12} className="flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Input({
  type = 'text',
  error,
  success,
  className = '',
  ...props
}) {
  const baseInputClass = `
    w-full px-4 py-2.5 rounded-xl bg-[var(--surface-bg)] border text-[var(--text-color)] 
    placeholder:text-[var(--muted-color)]/60 font-medium text-sm
    transition-all duration-200 outline-none
    focus:ring-2 focus:ring-primary/30 focus:border-primary
  `;
  
  const stateClasses = error 
    ? 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20' 
    : success 
      ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20'
      : 'border-[var(--border-color)]';
  
  return (
    <div className="relative">
      <input
        type={type}
        className={`${baseInputClass} ${stateClasses} ${className}`}
        {...props}
      />
      {error && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <AlertCircle size={18} className="text-rose-400" />
        </div>
      )}
      {success && !error && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <CheckCircle size={18} className="text-emerald-400" />
        </div>
      )}
    </div>
  );
}

export function Select({
  options = [],
  error,
  className = '',
  placeholder = 'Select an option',
  ...props
}) {
  const baseSelectClass = `
    w-full px-4 py-2.5 rounded-xl bg-[var(--surface-bg)] border text-[var(--text-color)] 
    font-medium text-sm appearance-none cursor-pointer
    transition-all duration-200 outline-none
    focus:ring-2 focus:ring-primary/30 focus:border-primary
  `;
  
  const stateClasses = error 
    ? 'border-rose-500/50 focus:border-rose-500' 
    : 'border-[var(--border-color)]';
  
  return (
    <div className="relative">
      <select
        className={`${baseSelectClass} ${stateClasses} ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-[var(--muted-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export function Textarea({
  error,
  className = '',
  rows = 3,
  ...props
}) {
  const baseTextareaClass = `
    w-full px-4 py-2.5 rounded-xl bg-[var(--surface-bg)] border text-[var(--text-color)] 
    placeholder:text-[var(--muted-color)]/60 font-medium text-sm
    transition-all duration-200 outline-none resize-none
    focus:ring-2 focus:ring-primary/30 focus:border-primary
  `;
  
  const stateClasses = error 
    ? 'border-rose-500/50 focus:border-rose-500' 
    : 'border-[var(--border-color)]';
  
  return (
    <textarea
      rows={rows}
      className={`${baseTextareaClass} ${stateClasses} ${className}`}
      {...props}
    />
  );
}

export function Checkbox({
  label,
  className = '',
  ...props
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 w-4 h-4 rounded border-[var(--border-color)] bg-[var(--surface-bg)] 
          text-primary focus:ring-primary/30 focus:ring-offset-0
          checked:bg-primary checked:border-primary
          transition-all duration-200"
        {...props}
      />
      <span className="text-sm text-[var(--text-color)] group-hover:text-[var(--heading-color)] transition-colors">
        {label}
      </span>
    </label>
  );
}

export function FormGroup({ children, className = '' }) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

export function FormRow({ children, className = '' }) {
  return <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>{children}</div>;
}