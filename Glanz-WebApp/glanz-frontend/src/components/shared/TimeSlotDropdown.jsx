import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatSlotStartHour } from '../../pages/customer/booking/BookingShared';

function cn(...inputs) { return twMerge(clsx(inputs)); }

function useClickOutside(ref, handler) {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler]);
}

export default function TimeSlotDropdown({
  value = '',
  onChange,
  slots = [],
  loading = false,
  disabled = false,
  className,
  placeholder = 'Select a time',
  loadingLabel = 'Checking availability\u2026',
  emptyLabel = 'No times available \u2014 try another day',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const selectedSlot = slots.find((s) => s === value);
  const displayText = selectedSlot ? formatSlotStartHour(selectedSlot) : placeholder;

  const handleSelect = (slot) => {
    onChange(slot);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => { if (!disabled && !loading) setIsOpen((o) => !o); }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen
            ? 'border-primary bg-[var(--surface-bg)]'
            : 'border-[var(--border-color)] bg-[var(--surface-bg)] hover:border-primary/40',
        )}
      >
        <Clock size={15} className={cn('flex-shrink-0', value ? 'text-primary' : 'text-[var(--muted-color)]')} />
        <span className={cn('flex-1 text-left truncate', value ? 'text-[var(--text-color)]' : 'text-[var(--muted-color)]')}>
          {loading ? loadingLabel : displayText}
        </span>
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin flex-shrink-0" />
        ) : value ? (
          <button type="button" onClick={handleClear}
            className="flex-shrink-0 text-[var(--muted-color)] hover:text-[var(--text-color)] transition p-0.5 -mr-1">
            <X size={14} />
          </button>
        ) : (
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-shrink-0 text-[var(--muted-color)]">
            <ChevronDown size={16} />
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && !loading && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'absolute top-[calc(100%+6px)] left-0 right-0 z-50',
              'overflow-hidden rounded-xl',
              'bg-[var(--surface-bg)]',
              'border border-[var(--border-color)]',
              'shadow-lg',
            )}
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.025 } },
              }}
            >
              {/* Header */}
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-color)] border-b border-[var(--border-color)]">
                {slots.length > 0 ? `${slots.length} slot${slots.length !== 1 ? 's' : ''} available` : emptyLabel}
              </div>

              {slots.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <Clock size={20} className="mx-auto mb-2 text-[var(--muted-color)] opacity-40" />
                  <p className="text-xs text-[var(--muted-color)]">{emptyLabel}</p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  {slots.map((slot) => {
                    const isSelected = slot === value;
                    return (
                      <motion.button
                        key={slot}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(slot)}
                        variants={{
                          hidden: { opacity: 0, x: -12 },
                          visible: { opacity: 1, x: 0 },
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors',
                          'border-b border-[var(--border-color)] last:border-b-0',
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-[var(--text-color)] hover:bg-white/5',
                        )}
                      >
                        <span className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0 transition',
                          isSelected ? 'bg-primary' : 'bg-[var(--border-color)]',
                        )} />
                        <span>{formatSlotStartHour(slot)}</span>
                        {isSelected && (
                          <span className="ml-auto text-[10px] text-primary font-bold">Selected</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
