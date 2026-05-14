import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Clock, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatSlotStartHour } from '../../pages/customer/booking/BookingShared';

function cn(...inputs) { return twMerge(clsx(inputs)); }

function useClickOutside(refs, handler) {
  useEffect(() => {
    const handle = (e) => {
      if (refs.every(r => r.current && !r.current.contains(e.target))) handler();
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [refs, handler]);
}

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

export default function TimeSlotDropdown({
  value = '',
  onChange,
  slots = [],
  loading = false,
  disabled = false,
  className,
  placeholder = 'Select a time',
  loadingLabel = 'Checking availability…',
  emptyLabel = 'No times available — try another day',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mobile, setMobile] = useState(isMobile);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  useClickOutside([triggerRef, listRef], () => setIsOpen(false));

  // Track window resize for mobile detection
  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Position the portal dropdown below the trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || mobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, [mobile]);

  useEffect(() => {
    if (isOpen && !mobile) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, { passive: true, capture: true });
      window.addEventListener('resize', updatePosition, { passive: true });
      return () => {
        window.removeEventListener('scroll', updatePosition, { capture: true });
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, mobile, updatePosition]);

  const selectedSlot = slots.find((s) => s === value);
  const displayText = selectedSlot ? formatSlotStartHour(selectedSlot) : placeholder;

  const handleSelect = (slot) => { onChange(slot); setIsOpen(false); };
  const handleClear = (e) => { e.stopPropagation(); onChange(''); setIsOpen(false); };
  const handleOpen = () => { if (!disabled && !loading) { updatePosition(); setIsOpen(o => !o); } };

  const slotList = (
    <motion.div
      ref={listRef}
      role="listbox"
      initial={mobile ? { y: '100%' } : { opacity: 0, y: -8, scale: 0.96 }}
      animate={mobile ? { y: 0 }       : { opacity: 1, y: 0, scale: 1 }}
      exit={mobile    ? { y: '100%' }  : { opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: mobile ? 0.28 : 0.18, ease: mobile ? [0.32, 0.72, 0, 1] : 'easeOut' }}
      style={mobile ? undefined : dropdownStyle}
      className={cn(
        mobile
          ? 'fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl max-h-[60vh] flex flex-col'
          : 'absolute overflow-hidden rounded-xl',
        'bg-[var(--surface-bg)] border border-[var(--border-color)] shadow-2xl',
      )}
    >
      {/* Handle bar for mobile */}
      {mobile && (
        <div className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 border-b border-[var(--border-color)]">
          <div className="w-10 h-1 rounded-full bg-[var(--border-color)] mb-3" />
          <div className="flex items-center justify-between w-full px-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)]">
              {slots.length > 0 ? `${slots.length} slots available` : emptyLabel}
            </p>
            <button type="button" onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/5 transition text-[var(--muted-color)]">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop header */}
      {!mobile && (
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted-color)] border-b border-[var(--border-color)]">
          {slots.length > 0 ? `${slots.length} slot${slots.length !== 1 ? 's' : ''} available` : emptyLabel}
        </div>
      )}

      {slots.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <Clock size={20} className="mx-auto mb-2 text-[var(--muted-color)] opacity-40" />
          <p className="text-xs text-[var(--muted-color)]">{emptyLabel}</p>
        </div>
      ) : (
        <div className={cn('overflow-y-auto', mobile ? 'flex-1 pb-safe-area-inset-bottom pb-4' : 'max-h-56')}>
          {slots.map((slot) => {
            const isSelected = slot === value;
            return (
              <button
                key={slot}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(slot)}
                className={cn(
                  'w-full flex items-center gap-3 text-sm text-left transition-colors',
                  'border-b border-[var(--border-color)] last:border-b-0',
                  mobile ? 'px-5 py-4 min-h-[52px]' : 'px-3 py-2.5',
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
                {isSelected && <span className="ml-auto text-[10px] text-primary font-bold">Selected</span>}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  return (
    <>
      {/* Backdrop for mobile bottom sheet */}
      <AnimatePresence>
        {isOpen && mobile && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div ref={triggerRef} className={cn('relative', className)}>
        <button
          type="button"
          onClick={handleOpen}
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

        {/* Desktop: render in portal to escape stacking context */}
        <AnimatePresence>
          {isOpen && !loading && !mobile && ReactDOM.createPortal(slotList, document.body)}
        </AnimatePresence>
      </div>

      {/* Mobile: render in portal for bottom sheet */}
      <AnimatePresence>
        {isOpen && !loading && mobile && ReactDOM.createPortal(slotList, document.body)}
      </AnimatePresence>
    </>
  );
}
