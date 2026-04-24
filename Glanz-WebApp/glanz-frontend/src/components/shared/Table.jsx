import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function Table({ 
  children, 
  className = '',
  hoverable = true,
  striped = false,
  ...props 
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table 
        className={`w-full ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = '' }) {
  return (
    <thead className={`${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', hoverable = true, striped = false }) {
  return (
    <tbody 
      className={`
        ${striped ? '[&>tr:nth-child(even)]:bg-[var(--card-bg)]/50' : ''}
        ${hoverable ? '[&>tr:hover]:bg-white/[0.02]' : ''}
        ${className}
      `}
    >
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', onClick, ...props }) {
  return (
    <tr 
      className={`
        border-b border-[var(--border-color)]/20 
        transition-colors duration-150
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ 
  children, 
  sortable = false, 
  sorted = null,
  onSort,
  align = 'left',
  className = '',
  ...props 
}) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const content = (
    <>
      {children}
      {sortable && (
        <span className="inline-flex flex-col ml-1">
          <ChevronUp size={12} className={`-mb-1 ${sorted === 'asc' ? 'text-primary' : 'text-[var(--muted-color)]/40'}`} />
          <ChevronDown size={12} className={`${sorted === 'desc' ? 'text-primary' : 'text-[var(--muted-color)]/40'}`} />
        </span>
      )}
    </>
  );

  return (
    <th 
      className={`
        px-4 py-3 text-xs font-bold text-[var(--muted-color)] uppercase tracking-wider
        ${alignClasses[align]}
        ${sortable ? 'cursor-pointer select-none hover:text-[var(--text-color)] transition-colors' : ''}
        ${className}
      `}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      {sortable ? (
        <span className="inline-flex items-center">
          {content}
        </span>
      ) : content}
    </th>
  );
}

export function TableCell({ 
  children, 
  align = 'left',
  className = '',
  ...props 
}) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td 
      className={`
        px-4 py-3 text-sm text-[var(--text-color)]
        ${alignClasses[align]}
        ${className}
      `}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableSortIcon({ direction }) {
  if (!direction) {
    return (
      <span className="inline-flex flex-col ml-1 opacity-30">
        <ChevronUp size={12} className="-mb-1" />
        <ChevronDown size={12} />
      </span>
    );
  }

  return direction === 'asc' ? (
    <ChevronUp size={14} className="ml-1 text-primary" />
  ) : (
    <ChevronDown size={14} className="ml-1 text-primary" />
  );
}