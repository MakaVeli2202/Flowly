import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toDateKey } from '../../../utils/dateUtils';
import {
  SectionHeading, DAY_CELL_CLS, normalizeStatusKey,
  formatDuration, formatSlotStartHour, formatTimeToAmPm,
  calculateEndTimeFromSlot, getCalendarCells,
} from './BookingShared';

function BookingScheduleStep({
  calendarMonth, setCalendarMonth,
  availabilityByDate, availabilityLoading,
  formData, setFormData,
  availableSlots, slotsLoading,
  totalDuration,
  minDateObj, selectedDateObj,
  onSelectDate,
}) {
  const calendarCells = useMemo(() => getCalendarCells(calendarMonth), [calendarMonth]);

  return (
    <div className="glass-card p-6 relative">
      <div className="absolute top-0 left-8 right-8 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(200,169,107,0.3), rgba(14,165,160,0.25), transparent)' }} />
      <SectionHeading icon={Calendar} step={3}>Schedule</SectionHeading>
      <div className="grid md:grid-cols-2 gap-6">

        {/* Calendar */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Select Date</p>
          <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]"
              style={{ background: 'rgba(255,255,255,0.025)' }}>
              <button type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                className="w-7 h-7 rounded-lg border border-[var(--border-color)] hover:bg-white/8 hover:border-primary/40 flex items-center justify-center transition">
                <ChevronLeft size={14} className="text-[var(--muted-color)]" />
              </button>
              <span className="text-sm font-bold text-[var(--heading-color)]">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                className="w-7 h-7 rounded-lg border border-[var(--border-color)] hover:bg-white/8 hover:border-primary/40 flex items-center justify-center transition">
                <ChevronRight size={14} className="text-[var(--muted-color)]" />
              </button>
            </div>
            <div className="grid grid-cols-7" style={{ background: 'rgba(255,255,255,0.015)' }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <div key={d} className="text-[10px] font-bold text-[var(--muted-color)] text-center py-2 tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((dateObj, i) => {
                if (!dateObj) return <div key={`blank-${i}`} className="h-10" />;
                const dateKey    = toDateKey(dateObj);
                const day        = availabilityByDate[dateKey];
                const statusKey  = normalizeStatusKey(day?.status, { freeSlots: day?.freeSlots, totalSlots: day?.totalSlots });
                const isSelected = selectedDateObj && toDateKey(selectedDateObj) === dateKey;
                const isBeforeMin = dateObj < minDateObj;
                const isFull      = statusKey === 'full';
                const isDisabled  = isBeforeMin || isFull;
                const todayKey    = toDateKey(new Date());
                const isToday     = dateKey === todayKey;
                return (
                  <button key={dateKey} type="button"
                    disabled={isDisabled}
                    onClick={() => onSelectDate(dateObj)}
                    title={day ? `${day.freeSlots ?? 'Available'} slots` : 'No data'}
                    className={`h-10 rounded-lg border text-sm font-bold transition relative ${DAY_CELL_CLS[statusKey]} ${
                      isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
                    }`}>
                    {dateObj.getDate()}
                    {isToday && !isBeforeMin && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 border-t border-[var(--border-color)]"
              style={{ background: 'rgba(255,255,255,0.015)' }}>
              {[{ dot: 'bg-green-400', label: 'Open' }, { dot: 'bg-amber-400', label: 'Filling up' }, { dot: 'bg-red-500', label: 'Full' }].map(({ dot, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[10px] text-[var(--muted-color)]">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />{label}
                </span>
              ))}
              {availabilityLoading && (
                <span className="ml-auto text-[10px] text-primary animate-pulse">Updating…</span>
              )}
            </div>
          </div>
        </div>

        {/* Time slot */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Time Slot</p>
          <select name="timeSlot" value={formData.timeSlot}
            onChange={(e) => setFormData((prev) => ({ ...prev, timeSlot: e.target.value }))}
            required disabled={slotsLoading}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition">
            {slotsLoading ? (
              <option value="">Checking availability…</option>
            ) : availableSlots !== null && availableSlots.length === 0 ? (
              <option value="">No times available — try another day</option>
            ) : (
              <>
                <option value="">Select a time</option>
                {(availableSlots || []).map((slot) => (
                  <option key={slot} value={slot}>{formatSlotStartHour(slot)}</option>
                ))}
              </>
            )}
          </select>
          {availableSlots !== null && !slotsLoading && (
            <p className={`text-xs mt-2 ${availableSlots.length === 0 ? 'text-red-400' : 'text-[var(--muted-color)]'}`}>
              {availableSlots.length === 0
                ? 'No times available for this date. Please choose another day.'
                : `${availableSlots.length} slot${availableSlots.length !== 1 ? 's' : ''} available`}
            </p>
          )}
          {formData.scheduledDate && formData.timeSlot && (() => {
            const start   = formatSlotStartHour(formData.timeSlot);
            const endTime = calculateEndTimeFromSlot(formData.timeSlot, totalDuration);
            const end     = formatTimeToAmPm(endTime);
            return (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/6 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-primary/40 rounded-l-xl" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-2">Appointment Preview</p>
                <p className="text-sm font-semibold text-[var(--heading-color)]">
                  {new Date(formData.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-sm text-[var(--muted-color)] mt-1">
                  {endTime ? `${start} – ${end}` : start}
                  {totalDuration > 0 && <span className="ml-2 opacity-60">· {formatDuration(totalDuration)}</span>}
                </p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default React.memo(BookingScheduleStep);
