// FinancialReport.jsx
import React, { useState, useEffect, useRef } from 'react';
import { reportsAPI } from '../../api/reports';
import { DollarSign, TrendingUp, TrendingDown, BarChart2, Calendar, Download, AlertCircle, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { formatQAR } from '../../utils/currency';
import { useLanguage } from '../../context/LanguageContext';
import { generateFinancialPDF } from '../../utils/reportPDF';

/* PRISM_CSS — identical to ManageProducts above */
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

/* ── StatCard ─────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, subtitle, accentColor, delay = '0s' }) {
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
        <p className="text-2xl font-black mb-1" style={{ color: accentColor }}>{value}</p>
        {subtitle && <p className="text-xs text-[var(--muted-color)]">{subtitle}</p>}
      </div>
    </div>
  );
}

/* Pure display helpers */
const mColor  = (m) => m > 30 ? '#22c55e' : m > 15 ? '#f59e0b' : '#ef4444';
const mBg     = (m) => m > 30 ? 'rgba(34,197,94,0.08)'  : m > 15 ? 'rgba(245,158,11,0.08)'  : 'rgba(239,68,68,0.08)';
const mBorder = (m) => m > 30 ? 'rgba(34,197,94,0.28)'  : m > 15 ? 'rgba(245,158,11,0.28)'  : 'rgba(239,68,68,0.28)';

function FinancialReport() {
  const { t } = useLanguage();
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { fetchReport(); }, [startDate, endDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await reportsAPI.getFinancial(startDate, endDate);
      setReport(data);
    } catch (err) {
      console.error('Financial report fetch failed:', err);
      setReport(null);
    }
    finally { setLoading(false); }
  };

  if (loading) return (
    <>
      <style>{PRISM_CSS}</style>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-[var(--muted-color)] text-sm">Loading report…</p>
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
                  <TrendingUp size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Financial Report</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">Revenue and profitability analysis</p>
            </div>
            <div className="cta-prism-glow rounded-xl">
              <button type="button" onClick={() => generateFinancialPDF(report, startDate, endDate)}
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
            <StatCard icon={DollarSign}   label="Total Revenue" value={formatQAR(report.totalRevenue)}        subtitle={`${report.totalBookings} bookings`}                 accentColor="#c8a96b" delay="0.08s" />
            <StatCard icon={TrendingDown} label="Total Cost"    value={formatQAR(report.totalCost)}           subtitle="Product expenses"                                   accentColor="#ef4444" delay="0.12s" />
            <StatCard icon={TrendingUp}   label="Total Profit"  value={formatQAR(report.totalProfit)}         subtitle={`${report.profitMarginPercent.toFixed(1)}% margin`} accentColor="#22c55e" delay="0.16s" />
            <StatCard icon={BarChart2}    label="Avg Booking"   value={formatQAR(report.averageBookingValue)} subtitle="Per appointment"                                    accentColor="#8b5cf6" delay="0.20s" />
          </div>

          {/* ── Outstanding payments ──────────────────── */}
          {report.outstandingPayments?.length > 0 && (
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.22s' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #ef4444 38%, #f59e0b 62%, transparent)' }} />
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #ef4444 0%, #ef444444 60%, transparent 100%)' }} />
              <div className="px-7 pt-6 pb-2">
                <div className="flex items-center gap-3 mb-1">
                  <AlertCircle size={16} style={{ color:'#f87171' }} />
                  <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">Outstanding Payments</h2>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ml-auto"
                    style={{ background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.28)', color:'#f87171' }}>
                    {formatQAR(report.outstandingTotal ?? 0)} at risk
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-color)] mb-4 ml-7">Bookings with uncaptured or failed payments — not yet collected.</p>
                <div className="mb-4"><div className="spectrum-line" /></div>
              </div>
              <div className="overflow-x-auto pb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Booking', 'Customer', 'Amount', 'Payment', 'Booking Status', 'Date'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {report.outstandingPayments.map(p => (
                      <tr key={p.bookingId} className="hover:bg-white/[0.015] transition">
                        <td className="px-6 py-3 font-bold text-xs text-primary">{p.bookingNumber}</td>
                        <td className="px-6 py-3 text-sm text-[var(--text-color)]">{p.customerName}</td>
                        <td className="px-6 py-3 font-black text-sm" style={{ color:'#f87171' }}>{formatQAR(p.amount)}</td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background:'rgba(245,158,11,.10)', border:'1px solid rgba(245,158,11,.28)', color:'#fbbf24' }}>
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-[var(--text-color)]">{p.bookingStatus}</td>
                        <td className="px-6 py-3 text-xs text-[var(--muted-color)]">
                          {format(new Date(p.scheduledDate), 'MMM dd, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Daily breakdown ───────────────────────── */}
          <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.24s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #c8a96b44 60%, transparent 100%)' }} />
            <div className="prism-ray" style={{ left: '60%', width: '14%', animation: 'prism-ray-sweep 22s ease-in-out 6s infinite' }} />

            <div className="px-7 pt-6 pb-4">
              <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-4">Daily Breakdown</h2>
              <div className="mb-4"><div className="spectrum-line" /></div>
            </div>

            <div className="overflow-x-auto pb-2">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    {['Date', 'Bookings', 'Revenue', 'Cost', 'Profit', 'Margin'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {report.dailyBreakdown.map((day, index) => {
                    const m = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0;
                    return (
                      <tr key={index} className="hover:bg-white/[0.015] transition">
                        <td className="px-6 py-4 font-bold text-sm text-[var(--heading-color)]">
                          {format(new Date(day.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--text-color)]">{day.bookingCount}</td>
                        <td className="px-6 py-4 text-sm font-black text-primary">{formatQAR(day.revenue)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-rose-400">{formatQAR(day.cost)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-400">{formatQAR(day.profit)}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ background: mBg(m), border: `1px solid ${mBorder(m)}`, color: mColor(m) }}>
                            {m.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Per-service margins ───────────────────── */}
          {report.serviceMargins?.length > 0 && (
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.30s' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6 38%, #06b6d4 62%, transparent)' }} />
              <div className="absolute top-0 left-0 w-[3px] h-full"
                style={{ background: 'linear-gradient(180deg, #8b5cf6 0%, #8b5cf644 60%, transparent 100%)' }} />
              <div className="prism-ray" style={{ left: '55%', width: '14%', animation: 'prism-ray-sweep 24s ease-in-out 2s infinite' }} />

              <div className="px-7 pt-6 pb-4">
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-1">Service Margins</h2>
                <p className="text-xs text-[var(--muted-color)] mb-4">Revenue and profitability broken down per service (completed bookings only).</p>
                <div className="mb-4"><div className="spectrum-line" /></div>
              </div>
              <div className="overflow-x-auto pb-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      {['Service', 'Package', 'Jobs', 'Revenue', 'Cost', 'Profit', 'Margin'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {report.serviceMargins.map((s, i) => (
                      <tr key={i} className="hover:bg-white/[0.015] transition">
                        <td className="px-6 py-3 font-bold text-sm text-[var(--heading-color)]">{s.serviceName}</td>
                        <td className="px-6 py-3 text-xs text-[var(--muted-color)]">{s.packageName || '—'}</td>
                        <td className="px-6 py-3 text-sm text-[var(--text-color)]">{s.jobCount}</td>
                        <td className="px-6 py-3 text-sm font-black text-primary">{formatQAR(s.totalRevenue)}</td>
                        <td className="px-6 py-3 text-sm font-bold text-rose-400">{formatQAR(s.totalCost)}</td>
                        <td className="px-6 py-3 text-sm font-bold text-green-400">{formatQAR(s.totalProfit)}</td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ background: mBg(s.marginPercent), border: `1px solid ${mBorder(s.marginPercent)}`, color: mColor(s.marginPercent) }}>
                            {s.marginPercent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default FinancialReport;