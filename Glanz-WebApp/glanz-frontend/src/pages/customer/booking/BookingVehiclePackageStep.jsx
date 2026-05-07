import React, { useCallback } from 'react';
import { Clock, Car, Zap, AlertCircle } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { formatQAR } from '../../../utils/currency';
import { SectionHeading } from './BookingShared';

const VEHICLE_OPTIONS = [
  { value: 'Motorcycle', label: 'Motorcycle', badge: '−20%', badgeCls: 'text-green-400 bg-green-500/10 border-green-500/25' },
  { value: 'Sedan',      label: 'Sedan',      badge: 'Base',  badgeCls: 'text-[var(--muted-color)] bg-white/5 border-[var(--border-color)]' },
  { value: 'SUV',        label: 'SUV / 4×4',  badge: '+25%', badgeCls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  { value: 'Pickup',     label: 'Pickup',     badge: '+50%', badgeCls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
];

const VEHICLE_FIELDS = [
  { label: 'Make',  name: 'vehicleMake',  placeholder: 'Toyota' },
  { label: 'Model', name: 'vehicleModel', placeholder: 'Camry'  },
  { label: 'Year',  name: 'vehicleYear',  placeholder: '2022', maxLength: 4 },
];

function BookingVehiclePackageStep({
  formData, setFormData,
  vehicleMultiplier,
  packages, packagesCtxLoading,
  selectedPackages, setSelectedPackages,
  quote,
}) {
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, [setFormData]);

  const selectedPackageId = selectedPackages[0]?.packageId ?? null;

  return (
    <>
      {/* ── 01 Vehicle ──────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '55%', width: '16%', animation: 'prism-ray-sweep 11s ease-in-out 6s infinite' }} />
        <SectionHeading icon={Car} step={1}>Vehicle Details</SectionHeading>
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Vehicle Type</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VEHICLE_OPTIONS.map(({ value, label, badge, badgeCls }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, vehicleType: value }))}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                  e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                }}
                className={`rounded-xl border-2 p-3 text-center transition-all duration-200 prism-glass ${
                  formData.vehicleType === value
                    ? 'border-primary bg-primary/10 text-primary pkg-selected-glow'
                    : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                }`}
              >
                <p className="text-sm font-bold leading-tight">{label}</p>
                <span className={`mt-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeCls}`}>{badge}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {VEHICLE_FIELDS.map(({ label, name, placeholder, maxLength }) => (
            <div key={name}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">{label}</p>
              <input type="text" name={name} value={formData[name]} onChange={handleChange}
                placeholder={placeholder} maxLength={maxLength}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-3 py-2.5 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition" />
            </div>
          ))}
        </div>
      </div>

      {/* ── 02 Package ──────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '68%', width: '14%', animation: 'prism-ray-sweep 18s ease-in-out 1s infinite' }} />
        <SectionHeading icon={Zap} step={2}>Select Package</SectionHeading>
        {packagesCtxLoading && packages.length === 0 ? (
          <div className="flex items-center gap-3 py-10 justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            <span className="text-[var(--muted-color)] text-sm">Loading packages…</span>
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-amber-400 text-sm flex items-center gap-3">
            <AlertCircle size={15} className="flex-shrink-0" />
            No packages available right now. Please try again later.
          </div>
        ) : (
          <div className="rounded-[28px] border-2 border-[var(--border-color)] bg-white/5 p-3 shadow-md space-y-3">
            {packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id;
              const adjPrice   = Math.round(pkg.price * vehicleMultiplier * 100) / 100;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackages([{ packageId: pkg.id, quantity: 1 }])}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                    e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                  }}
                  className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-300 relative overflow-hidden prism-glass ${
                    isSelected
                      ? 'border-black bg-white/15 pkg-selected-glow'
                      : 'border-gray-400/70 hover:border-primary/40 hover:bg-white/6'
                  }`}
                >
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isSelected ? 'border-black' : 'border-slate-500'
                      }`}>
                        <div className="w-2.5 h-2.5 rounded-full bg-black transition-opacity duration-300" style={{ opacity: isSelected ? 1 : 0 }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[var(--heading-color)] tracking-tight">{pkg.name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/12 border border-primary/25 px-2 py-0.5 rounded-full">
                            {pkg.tier}
                          </span>
                        </div>
                        {pkg.description && (
                          <p className="text-sm text-[var(--muted-color)] mt-1 line-clamp-2">{pkg.description}</p>
                        )}
                        <p className="text-xs text-[var(--muted-color)] mt-1.5 flex items-center gap-1">
                          <Clock size={11} />{pkg.estimatedDurationMinutes} min
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {vehicleMultiplier !== 1.0 && (
                        <p className="text-xs text-[var(--muted-color)] line-through">{formatQAR(pkg.price)}</p>
                      )}
                      <p className="text-xl font-bold text-primary inline-flex items-center gap-1">
                        <span>QAR</span>
                        <NumberFlow value={adjPrice} className="text-primary font-bold" />
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default React.memo(BookingVehiclePackageStep);
