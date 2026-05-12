// OperationalReport.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { reportsAPI } from '../../api/reports';
import { Calendar, Package, TrendingUp, Download, BarChart2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { formatQAR } from '../../utils/currency';
import { useLanguage } from '../../context/LanguageContext';
import { generateOperationalPDF } from '../../utils/reportPDF';

/* PRISM_CSS — identical */
const PRISM_CSS = `
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; } 90% { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg); opacity: 0.18; }
  33%      { transform: translate(12px,-14px) rotate(120deg); opacity: 0.30; }
  66%      { transform: translate(-7px,8px) rotate(240deg); opacity: 0.22; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.42),  0 0 22px rgba(255,165,0,.15); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.42),  0 0 22px rgba(160,0,255,.15); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.42),  0 0 22px rgba(255,0,100,.15); }
}
@keyframes card-enter {
  from { transform: translateY(14px) scale(0.988); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(90px); mix-blend-mode: screen; will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none; transform: skewX(-18deg);
  background: linear-gradient(90deg, transparent 0%, rgba(255,55,55,.030) 15%,
    rgba(255,200,0,.042) 30%, rgba(0,255,145,.034) 50%, rgba(0,145,255,.034) 70%,
    rgba(195,0,255,.026) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.10) 0%, rgba(80,255,160,.07) 30%, rgba(40,130,255,.07) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.32s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg, transparent 0%, rgba(255,0,100,.80) 12%,
    rgba(255,165,0,.85) 24%, rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%; animation: holo-sweep 5s linear infinite; opacity: 0.40;
}
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.card-stagger   { animation: card-enter 0.52s cubic-bezier(0.22,1,0.36,1) both; }
.field-input {
  padding: 10px 14px; border-radius: 12px;
  border: 1px solid var(--border-color); background: var(--surface-bg);
  color: var(--text-color); font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s; outline: none;
}
.field-input:focus { border-color: rgba(200,169,107,0.65); box-shadow: 0 0 0 3px rgba(200,169,107,0.12); }
`;

function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, cx = mx, cy = my, rafId;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      const hue = (mx / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 480, height: 480, top: '-240px', left: '-240px' }} />;
}

function StatCard({ icon: Icon, label, value, accentColor, delay = '0s' }) {
  return (
    <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: delay }}>
      <div className="absolute top-0 left-0 w-[3px] h-full"
        style={{ background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}44 60%, transparent 100%)` }} />
      <div className="prism-ray" style={{ left: '66%', width: '12%', animation: `prism-ray-sweep 20s ease-in-out 3s infinite` }} />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}28` }}>
            <Icon size={18} style={{ color: accentColor }} />
          </div>
          <p className="text-sm font-bold text-[var(--text-color)]">{label}</p>
        </div>
        <p className="text-3xl font-black" style={{ color: accentColor }}>{value}</p>
      </div>
    </div>
  );
}

/* Pure display maps */
const TIER_COLORS = { Standard: '#3b82f6', Gold: '#c8a96b', Platinum: '#94a3b8', Premium: '#8b5cf6' };
const STATUS_COLORS = {
  Pending:    '#f59e0b',
  Confirmed:  '#3b82f6',
  InProgress: '#8b5cf6',
  Completed:  '#22c55e',
  Cancelled:  '#ef4444',
};

function OperationalReport() {
  const { t } = useLanguage();
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await reportsAPI.getOperational(startDate, endDate);
      setReport(data);
    } catch (err) {
      console.error('Operational report fetch failed:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.title || err?.message || 'Failed to load report';
      setFetchError(msg);
      setReport(null);
    }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-[var(--muted-color)] text-sm">Loading report…</p>
      </div>
    </>
  );

  if (fetchError) return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4">
        <XCircle size={40} className="text-red-400" />
        <p className="text-red-400 text-sm font-bold text-center">{fetchError}</p>
        <button onClick={fetchReport}
          className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
          Retry
        </button>
      </div>
    </>
  );

  if (!report) return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <BarChart2 size={40} className="text-[var(--muted-color)]" />
        <p className="text-[var(--muted-color)] text-sm">No data available for the selected range.</p>
      </div>
    </>
  );

  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{
          background: `
            radial-gradient(circle at 7% 6%, rgba(200,169,107,0.05) 0%, transparent 38%),
            radial-gradient(circle at 93% 92%, rgba(14,165,160,0.04) 0%, transparent 32%)
          `,
        }}
      >
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(85px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10 space-y-6">

          {/* ── Header ───────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">{t('adminPanel')}</p>
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                  <BarChart2 size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Operational Report</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Booking statistics and service usage</p>
            </div>
            <div className="cta-prism-glow rounded-xl">
              <button type="button" onClick={() => generateOperationalPDF(report, startDate, endDate)}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition">
                <Download size={15} /> Export PDF
              </button>
            </div>
          </div>

          {/* ── Date range ───────────────────────────── */}
          <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.04s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
            <div className="px-6 py-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: '#c8a96b' }} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">Date Range</p>
              </div>
              <div className="h-4 w-px bg-[var(--border-color)]" />
              <div className="flex items-center gap-3 flex-wrap">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="field-input" style={{ width: '155px' }} />
                <span className="text-xs font-bold text-[var(--muted-color)]">→</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="field-input" style={{ width: '155px' }} />
              </div>
            </div>
          </div>

          {/* ── KPI cards ────────────────────────────── */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={Package}     label="Total Bookings" value={report.totalBookings}     accentColor="#3b82f6" delay="0.08s" />
            <StatCard icon={CheckCircle} label="Completed"      value={report.completedBookings} accentColor="#22c55e" delay="0.12s" />
            <StatCard icon={Clock}       label="Pending"        value={report.pendingBookings}    accentColor="#f59e0b" delay="0.16s" />
            <StatCard icon={XCircle}     label="Cancelled"      value={report.cancelledBookings}  accentColor="#ef4444" delay="0.20s" />
          </div>

          {/* ── Package popularity + top products ─────── */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* Package popularity */}
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.24s' }}>
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #c8a96b44 60%, transparent 100%)' }} />
              <div className="prism-ray" style={{ left: '65%', width: '12%', animation: 'prism-ray-sweep 19s ease-in-out 7s infinite' }} />

              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                    <Package size={14} style={{ color: '#c8a96b' }} />
                  </div>
                  <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)]">Package Popularity</h2>
                </div>
                <div className="mb-4"><div className="spectrum-line" /></div>

                <div className="space-y-4">
                  {report.packagePopularity.map((pkg, index) => {
                    const tierColor = TIER_COLORS[pkg.tier] || '#3b82f6';
                    return (
                      <div key={index}
                        className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border-color)] last:border-b-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-bold text-sm text-[var(--heading-color)]">{pkg.packageName}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: `${tierColor}18`, border: `1px solid ${tierColor}30`, color: tierColor }}>
                              {pkg.tier}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--muted-color)]">
                            Revenue: <span className="font-bold text-green-400">{formatQAR(pkg.totalRevenue)}</span>
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary whitespace-nowrap">
                          {pkg.bookingCount} bookings
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top products */}
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.28s' }}>
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #0ea5a0 0%, #0ea5a044 60%, transparent 100%)' }} />
              <div className="prism-ray" style={{ left: '68%', width: '11%', animation: 'prism-ray-sweep 21s ease-in-out 9s infinite' }} />

              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(14,165,160,0.12)', border: '1px solid rgba(14,165,160,0.24)' }}>
                    <TrendingUp size={14} style={{ color: '#0ea5a0' }} />
                  </div>
                  <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)]">Top Products Used</h2>
                </div>
                <div className="mb-4"><div className="spectrum-line" /></div>

                <div className="space-y-4">
                  {report.topProductsUsed.map((product, index) => (
                    <div key={index}
                      className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--border-color)] last:border-b-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-[var(--heading-color)] mb-1">{product.productName}</p>
                        <p className="text-xs text-[var(--muted-color)]">
                          Total Cost: <span className="font-bold text-rose-400">{formatQAR(product.totalCost)}</span>
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: 'rgba(14,165,160,0.12)', border: '1px solid rgba(14,165,160,0.25)', color: '#0ea5a0' }}>
                        {product.totalQuantityUsed.toFixed(1)} {product.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ── Bookings by status ────────────────────── */}
          <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.32s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
            <div className="prism-ray" style={{ left: '55%', width: '14%', animation: 'prism-ray-sweep 17s ease-in-out 4s infinite' }} />

            <div className="px-7 pt-6 pb-6">
              <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-4">Bookings by Status</h2>
              <div className="mb-5"><div className="spectrum-line" /></div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {Object.entries(report.bookingsByStatus).map(([status, count]) => {
                  const color = STATUS_COLORS[status] || '#94a3b8';
                  const pct   = report.totalBookings > 0 ? ((count / report.totalBookings) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={status} className="rounded-xl border p-4 text-center"
                      style={{ background: `${color}08`, borderColor: `${color}28` }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>{status}</p>
                      <p className="text-2xl font-black mb-1" style={{ color }}>{count}</p>
                      <p className="text-[11px] text-[var(--muted-color)]">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default OperationalReport;