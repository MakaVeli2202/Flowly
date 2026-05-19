import React from 'react';
import { Tag, Calendar, Clock, Shield, CheckCircle, Ticket } from 'lucide-react';
import { formatQAR } from '../../../utils/currency';
import {
  formatDuration, formatSlotStartHour, formatTimeToAmPm, calculateEndTimeFromSlot,
} from './BookingShared';

function BookingSidebar({
  selectedPackages, packages,
  quote, vehicleMultiplier,
  formData,
  totalDuration, totalAmount, quoteLoading,
}) {
  return (
    <div className="lg:col-span-1">
      <div className="glass-card p-6 sticky top-24 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '38%', width: '22%', animation: 'prism-ray-sweep 16s ease-in-out 5s infinite' }} />

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-[var(--border-color)]">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Tag size={13} className="text-primary" />
          </div>
          <h2 className="text-base font-bold text-[var(--heading-color)] tracking-tight">Booking Summary</h2>
        </div>

        {selectedPackages.length > 0 ? (
          <>
            <div className="space-y-3 mb-5">
              {selectedPackages.map((item) => {
                const pkg = packages.find((p) => p.id === item.packageId);
                if (!pkg) return null;
                const multiplierUsed = quote?.vehicleMultiplier ?? vehicleMultiplier;
                const adjPrice = Math.round(pkg.price * multiplierUsed * 100) / 100;
                return (
                  <div key={item.packageId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--heading-color)] truncate">{pkg.name}</p>
                      <p className="text-xs text-primary font-medium mt-0.5">{pkg.tier}</p>
                    </div>
                    <p className="text-sm font-bold text-primary flex-shrink-0">{formatQAR(adjPrice)}</p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--border-color)] pt-4 space-y-2.5">
              {vehicleMultiplier !== 1.0 && (
                <div className="flex justify-between text-xs text-[var(--muted-color)]">
                  <span>Vehicle adj. ({formData.vehicleType})</span>
                  <span className={`font-semibold ${vehicleMultiplier > 1 ? 'text-amber-400' : 'text-green-400'}`}>×{vehicleMultiplier}</span>
                </div>
              )}
              {quote?.subscriptionDiscountAmount > 0 && (
                <div className="flex justify-between text-xs text-green-400">
                  <span>Subscription discount ({quote.subscriptionDiscountPercent}%)</span>
                  <span className="font-semibold">−{formatQAR(quote.subscriptionDiscountAmount)}</span>
                </div>
              )}
              {quote?.offerDiscountAmount > 0 && (
                <div className="flex justify-between text-xs text-green-400">
                  <span>Offer discount</span>
                  <span className="font-semibold">−{formatQAR(quote.offerDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-[var(--muted-color)]">
                <span>Est. duration</span>
                <span className="font-semibold text-[var(--text-color)]">{formatDuration(totalDuration)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border-color)]">
                <span className="text-sm font-bold text-[var(--heading-color)]">Total</span>
                {quoteLoading ? (
                  <span className="text-sm text-[var(--muted-color)] animate-pulse">Calculating…</span>
                ) : (
                  <span className="text-2xl font-bold text-primary">{formatQAR(totalAmount)}</span>
                )}
              </div>
              <p className="text-[10px] text-[var(--muted-color)] leading-relaxed">
                {quote ? 'Price confirmed by server.' : 'Estimated — server confirms at checkout.'}
              </p>
            </div>

            {formData.offerCode && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2.5">
                <Ticket size={12} className="text-primary flex-shrink-0" />
                <span className="text-xs text-[var(--muted-color)]">Coupon:</span>
                <span className="text-xs font-mono font-bold text-primary ml-auto">{formData.offerCode}</span>
              </div>
            )}

            {formData.scheduledDate && formData.timeSlot && (() => {
              const start   = formatSlotStartHour(formData.timeSlot);
              const endTime = calculateEndTimeFromSlot(formData.timeSlot, totalDuration);
              const end     = formatTimeToAmPm(endTime);
              return (
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-[3px] h-full bg-primary/35 rounded-l-xl" />
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary mb-2">Appointment</p>
                  <p className="text-sm font-semibold text-[var(--heading-color)]">
                    {new Date(formData.scheduledDate).toLocaleDateString('en-US', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-[var(--muted-color)] mt-1">
                    {endTime ? `${start} – ${end}` : start}
                    {totalDuration > 0 && <span className="ml-2 opacity-60">· {formatDuration(totalDuration)}</span>}
                  </p>
                </div>
              );
            })()}

            <div className="mt-5 pt-4 border-t border-[var(--border-color)] space-y-2.5">
              {[
                { Icon: Shield,      label: 'Secure & Encrypted Payment'   },
                { Icon: CheckCircle, label: 'Instant Booking Confirmation' },
                { Icon: Clock,       label: 'Free Reschedule Available'    },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-xs text-[var(--muted-color)]">
                  <Icon size={12} className="text-primary flex-shrink-0" />{label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-4">
              <Calendar size={22} className="text-primary" style={{ opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-[var(--heading-color)] mb-1">No package selected</p>
            <p className="text-xs text-[var(--muted-color)]">Choose a package above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(BookingSidebar);
