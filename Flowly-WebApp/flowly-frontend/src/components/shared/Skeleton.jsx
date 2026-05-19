import React from 'react';

export function Skeleton({ className = '', variant = 'text', width, height, animate = true }) {
  const baseClasses = 'bg-gradient-to-r from-[var(--card-bg)] via-[var(--border-color)]/30 to-[var(--card-bg)] bg-[length:200%_100%]';
  const animateClass = animate ? 'animate-pulse' : '';
  
  const variants = {
    text: 'rounded h-4',
    title: 'rounded h-6 w-3/4',
    avatar: 'rounded-full',
    button: 'rounded-lg h-10',
    card: 'rounded-xl h-32',
    image: 'rounded-lg h-48',
    input: 'rounded-lg h-10',
    badge: 'rounded-full h-5 w-16',
    table: 'rounded h-8',
  };

  const style = {
    width: width || (variants[variant] === 'rounded-full' ? '40px' : undefined),
    height: height || (variant === 'avatar' ? '40px' : undefined),
  };

  return (
    <div 
      className={`${baseClasses} ${animateClass} ${variants[variant] || ''} ${className}`}
      style={style}
    />
  );
}

export function SkeletonGroup({ count = 3, gap = 4, children }) {
  return (
    <div className={`space-y-${gap}`}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>{children}</React.Fragment>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" height="16px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3 border-b border-[var(--border-color)]/20">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="flex-1" height="12px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" width="40px" height="40px" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/2" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
      </div>
      <Skeleton variant="text" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  );
}

export function BookingCardSkeleton() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton variant="title" className="w-24" />
          <Skeleton variant="text" className="w-32" />
        </div>
        <Skeleton variant="badge" />
      </div>
      <div className="flex gap-4">
        <Skeleton variant="text" className="flex-1" />
        <Skeleton variant="text" className="flex-1" />
      </div>
      <Skeleton variant="text" className="w-3/4" />
    </div>
  );
}