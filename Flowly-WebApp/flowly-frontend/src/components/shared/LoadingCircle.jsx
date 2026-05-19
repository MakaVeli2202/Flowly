import React from 'react';

export default function LoadingCircle({
  label = 'Loading...',
  fullScreen = false,
  sizeClass = 'h-10 w-10',
  className = '',
}) {
  const wrapperClass = fullScreen
    ? 'min-h-screen flex items-center justify-center'
    : 'flex items-center justify-center';

  return (
    <div className={`${wrapperClass} ${className}`.trim()} role="status" aria-live="polite" aria-label={label}>
      <div className="flex flex-col items-center gap-3">
        <div
          className={`${sizeClass} rounded-full border-2 border-[var(--border-color)] border-t-primary animate-spin`}
        />
        {label ? <p className="text-xs text-[var(--muted-color)]">{label}</p> : null}
      </div>
    </div>
  );
}
