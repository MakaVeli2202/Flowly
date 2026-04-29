// ─── BookingScheduleStep.js ───────────────────────────────────────────────────
// Section 3: Calendar + time slot picker
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { toDateKey, parseDateKey } from '../../utils/dateUtils';
import {
  SectionHeader, Card,  FieldLabel,
  weekdayLabels, availabilityColors,
  calculateEndTime, getSlotStartTime,
  s,
} from './BookingShared';

function BookingScheduleStep({
  calendarMonth,
  setCalendarMonth,
  availabilityByDate,
  availabilityLoading,
  form,
  setForm,
  availableSlots,
  slotsLoading,
  totalDuration,
  minDateObj,
  monthLabel,
  selectedDateObj,
  calendarCells,
  onSelectDate,
}) {
  return (
    <Card>
      <SectionHeader icon="calendar-outline" step={3}>Schedule</SectionHeader>

      {/* Calendar nav */}
      <View style={s.calHeader}>
        <TouchableOpacity
          style={s.monthBtn}
          onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
        >
          <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{monthLabel}</Text>
        <TouchableOpacity
          style={s.monthBtn}
          onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
        >
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={s.legendRow}>
        {['available', 'medium', 'full'].map((k) => (
          <View key={k} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: availabilityColors[k].dot }]} />
            <Text style={s.legendText}>{availabilityColors[k].label}</Text>
          </View>
        ))}
      </View>

      {/* Day headers */}
      <View style={s.weekRow}>
        {weekdayLabels.map((d) => <Text key={d} style={s.weekDay}>{d}</Text>)}
      </View>

      {availabilityLoading && (
        <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 10 }} />
      )}

      {/* Calendar grid */}
      <View style={s.calGrid}>
        {calendarCells.map((dateObj, i) => {
          if (!dateObj) return <View key={`e-${i}`} style={s.calEmpty} />;
          const dateKey    = toDateKey(dateObj);
          const status     = availabilityByDate[dateKey]?.status || 'available';
          const isPast     = dateObj < minDateObj;
          const stateKey   = isPast ? 'disabled' : status;
          const palette    = availabilityColors[stateKey] || availabilityColors.available;
          const isSelected = toDateKey(selectedDateObj) === dateKey;
          return (
            <TouchableOpacity
              key={dateKey}
              style={[
                s.calCell,
                { backgroundColor: palette.bg, borderColor: isSelected ? theme.colors.primary : palette.border },
                isSelected && s.calCellSelected,
              ]}
              disabled={isPast || status === 'full'}
              onPress={() => onSelectDate(dateObj)}
              activeOpacity={0.75}
            >
              <Text style={[s.calDayText, { color: palette.text }]}>{dateObj.getDate()}</Text>
              <View style={[s.calDot, { backgroundColor: palette.dot }]} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected date pill */}
      <View style={s.selectedDate}>
        <Ionicons name="calendar" size={13} color={theme.colors.primary} />
        <Text style={s.selectedDateText}>
          {parseDateKey(form.scheduledDate).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>
      </View>

      {/* Time slots */}
      <FieldLabel>Time Slot</FieldLabel>
      {slotsLoading || availableSlots === null ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 8 }} />
      ) : availableSlots.length === 0 ? (
        <View style={s.noSlots}>
          <Ionicons name="time-outline" size={15} color="#FCA5A5" />
          <Text style={s.noSlotsText}>No slots available for this date. Try another day.</Text>
        </View>
      ) : (
        <View style={s.slotGrid}>
          {availableSlots.map((slot) => {
            const active = form.timeSlot === slot;
            return (
              <TouchableOpacity
                key={slot}
                style={[s.slotChip, active && s.slotActive]}
                onPress={() => setForm((p) => ({ ...p, timeSlot: slot }))}
              >
                <Text style={[s.slotText, active && s.slotTextActive]}>
                  {getSlotStartTime(slot)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Time confirmation strip */}
      {!!form.timeSlot && (
        <View style={s.timeConfirmStrip}>
          <View style={s.timeConfirmBlock}>
            <Text style={s.timeConfirmValue}>{getSlotStartTime(form.timeSlot)}</Text>
            <Text style={s.timeConfirmMeta}>Start</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          <View style={s.timeConfirmBlock}>
            <Text style={s.timeConfirmValue}>
              {calculateEndTime(getSlotStartTime(form.timeSlot), totalDuration)}
            </Text>
            <Text style={s.timeConfirmMeta}>Est. End · {totalDuration} min</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

export default React.memo(BookingScheduleStep);
