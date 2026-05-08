import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, ShoppingBag, Beaker, Calendar, TrendingUp, BarChart3,
  FileEdit, Ticket, Users, ClipboardList, Wrench, Repeat, Settings, ArrowRight,
  Layers, Briefcase, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { reportsAPI } from '../../api/reports';
import { subscribeToNotifications } from '../../api/notificationBus';
import { formatQAR, formatCompactQAR as formatCompactCurrency } from '../../utils/currency';

const CHART_COLORS = ['#c8a96b', '#0ea5a0', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

const formatShortDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });

/* ── PRISM CSS ─────────────────────────────────────────────── */
const PRISM_CSS = `
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg);           opacity: 0.18; }
  33%      { transform: translate(12px,-16px) rotate(120deg); opacity: 0.30; }
  66%      { transform: translate(-8px,8px)   rotate(240deg); opacity: 0.22; }
}
@keyframes hero-ring-pulse {
  0%,100% { transform: scale(1);     opacity: 0.28; }
  50%      { transform: scale(1.09); opacity: 0.50; }
}
@keyframes card-enter {
  from { transform: translateY(16px) scale(0.985); opacity: 0; }
  to   { transform: translateY(0)    scale(1);     opacity: 1; }
}
@keyframes icon-pop-in {
  0%   { transform: scale(0.5) rotate(-12deg); opacity: 0; }
  70%  { transform: scale(1.1) rotate(2deg);   opacity: 1; }
  100% { transform: scale(1)   rotate(0deg);   opacity: 1; }
}

.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(90px); mix-blend-mode: screen;
  will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.035) 15%, rgba(255,200,0,.05) 30%,
    rgba(0,255,145,.04) 50%, rgba(0,145,255,.04) 70%,
    rgba(195,0,255,.03) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.13) 0%, rgba(80,255,160,.09) 30%,
    rgba(40,130,255,.09) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.35s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.80) 12%, rgba(255,165,0,.85) 24%,
    rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.40;
}
.card-stagger { animation: card-enter 0.55s cubic-bezier(0.22,1,0.36,1) both; }
.icon-pop     { animation: icon-pop-in 0.65s cubic-bezier(0.34,1.56,0.64,1) both; }
`;

/* ── Cursor orb ─────────────────────────────────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cy = my, rafId;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      const hue = (mx / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.10),rgba(255,160,0,.08),rgba(255,255,0,.07),rgba(0,255,100,.08),rgba(0,160,255,.10),rgba(160,0,255,.08),rgba(255,0,80,.10))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 500, height: 500, top: '-250px', left: '-250px' }} />;
}

/* ── Custom chart tooltips ──────────────────────────────────── */
const ttBase = (border) => ({
  background: 'var(--card-bg)', border: `1px solid ${border}`,
  borderRadius: 12, padding: '10px 14px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.22)', minWidth: 148,
});
const ttLabel = { fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted-color)', marginBottom: 8 };
const ttRow   = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 };
const ttDot   = (color) => ({ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 });
const ttName  = { fontSize: 11, color: 'var(--muted-color)' };
const ttVal   = { fontSize: 11, fontWeight: 700, color: 'var(--heading-color)' };

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={ttBase('rgba(200,169,107,0.32)')}>
      <p style={ttLabel}>{label}</p>
      {payload.map((e, i) => (
        <div key={i} style={ttRow}>
          <span style={ttDot(e.color)} />
          <span style={ttName}>{e.name === 'revenue' ? 'Revenue' : 'Profit'}:</span>
          <span style={ttVal}>{formatQAR(e.value)}</span>
        </div>
      ))}
    </div>
  );
}
function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={ttBase('rgba(14,165,160,0.32)')}>
      <div style={ttRow}>
        <span style={ttDot(p.payload.fill || p.color)} />
        <span style={ttVal}>{p.name}: {p.value}</span>
      </div>
    </div>
  );
}
function PackagesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={ttBase('rgba(59,130,246,0.32)')}>
      <p style={ttLabel}>{label}</p>
      {payload.map((e, i) => (
        <div key={i} style={ttRow}>
          <span style={ttDot(e.color)} />
          <span style={ttName}>{e.name === 'bookings' ? 'Bookings' : 'Revenue'}:</span>
          <span style={ttVal}>{e.name === 'bookings' ? e.value : formatQAR(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── ChartCard ───────────────────────────────────────────────── */
function ChartCard({ title, subtitle, badge, accentColor, rayDelay = '3s', rightAction, children }) {
  return (
    <div className="glass-card relative overflow-hidden">
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-[3px] h-full"
        style={{ background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}44 60%, transparent 100%)` }} />
      <div className="prism-ray"
        style={{ left: '68%', width: '12%', animation: `prism-ray-sweep 18s ease-in-out ${rayDelay} infinite` }} />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            {badge && (
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-5" style={{ background: `linear-gradient(90deg, transparent, ${accentColor})` }} />
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.25em]" style={{ color: accentColor }}>{badge}</p>
                <span className="h-px w-5" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
              </div>
            )}
            <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{title}</h2>
            {subtitle && <p className="text-xs text-[var(--muted-color)] mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
        </div>
        <div className="mb-5"><div className="spectrum-line" /></div>
        {children}
      </div>
    </div>
  );
}

/* ── SkeletonCard ────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-white/5 mb-5" />
      <div className="h-2.5 w-20 bg-white/5 rounded-full mb-3" />
      <div className="h-8 w-28 bg-white/5 rounded-full mb-2" />
      <div className="h-2.5 w-36 bg-white/5 rounded-full" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ADMIN DASHBOARD
════════════════════════════════════════════════════════════ */
function AdminDashboard() {
  const [summary,           setSummary]           = useState(null);
  const [loadingSummary,    setLoadingSummary]    = useState(true);
  const [financialReport,   setFinancialReport]   = useState(null);
  const [operationalReport, setOperationalReport] = useState(null);
  const [loadingCharts,     setLoadingCharts]     = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoadingSummary(true);
        setLoadingCharts(true);
        const [summaryData, financialData, operationalData] = await Promise.all([
          reportsAPI.getDashboardSummary(),
          reportsAPI.getFinancial(),
          reportsAPI.getOperational(),
        ]);
        setSummary(summaryData);
        setFinancialReport(financialData);
        setOperationalReport(operationalData);
      } catch {}
      finally { setLoadingSummary(false); setLoadingCharts(false); }
    };
    fetchDashboardData();

    // Refresh summary counts when booking-related notifications arrive
    const BOOKING_EVENTS = new Set([
      'NewBooking', 'BookingConfirmed', 'BookingCancelled', 'BookingStatusChanged',
      'JobStarted', 'JobCompleted', 'BookingReassigned', 'BookingClaimed', 'BookingUnassigned',
    ]);
    const onNotif = (notif) => {
      if (BOOKING_EVENTS.has(notif?.type)) {
        reportsAPI.getDashboardSummary()
          .then(d => { if (d) setSummary(d); })
          .catch(() => {});
      }
    };
    return subscribeToNotifications(onNotif);
  }, []);

  /* ── Derived data (logic unchanged) ─────────────────────── */
  const revenueTrendData = useMemo(() => (
    (financialReport?.dailyBreakdown || []).map((day) => ({
      date: formatShortDate(day.date),
      revenue: Number(day.revenue || 0),
      profit:  Number(day.profit  || 0),
      bookings: Number(day.bookingCount || 0),
    }))
  ), [financialReport]);

  const bookingStatusData = useMemo(() => {
    if (!operationalReport?.bookingsByStatus) return [];
    return Object.entries(operationalReport.bookingsByStatus)
      .map(([status, count]) => ({ name: status, value: Number(count || 0) }))
      .filter((item) => item.value > 0);
  }, [operationalReport]);

  const packagePerformanceData = useMemo(() => (
    (operationalReport?.packagePopularity || []).slice(0, 5).map((item) => ({
      name: `${item.packageName} ${item.tier}`,
      bookings: Number(item.bookingCount  || 0),
      revenue:  Number(item.totalRevenue  || 0),
    }))
  ), [operationalReport]);

  const analyticsHighlights = useMemo(() => {
    if (!financialReport || !operationalReport) return [];
    const completionRate   = operationalReport.totalBookings > 0
      ? (operationalReport.completedBookings / operationalReport.totalBookings) * 100 : 0;
    const cancellationRate = operationalReport.totalBookings > 0
      ? (operationalReport.cancelledBookings / operationalReport.totalBookings) * 100 : 0;
    return [
      { title: 'Completion Rate',       value: `${completionRate.toFixed(1)}%`,                     detail: `${operationalReport.completedBookings} of ${operationalReport.totalBookings} bookings finished`,     accent: '#0ea5a0' },
      { title: 'Cancellation Rate',     value: `${cancellationRate.toFixed(1)}%`,                   detail: `${operationalReport.cancelledBookings} cancelled in the current window`,                             accent: '#ef4444' },
      { title: 'Avg Booking Value',     value: formatQAR(financialReport.averageBookingValue),       detail: `${formatQAR(financialReport.totalProfit)} total profit over the selected period`,                   accent: '#c8a96b' },
    ];
  }, [financialReport, operationalReport]);

  /* ── Static data ─────────────────────────────────────────── */
  const summaryCards = summary ? [
    { title: 'Lifetime Revenue', value: formatQAR(summary.lifetimeRevenue), detail: `${formatQAR(summary.recentRevenue)} in the last 30 days`,                         icon: TrendingUp,    accent: '#c8a96b' },
    { title: 'Bookings',         value: `${summary.totalBookings}`,         detail: `${summary.pendingBookings} pending · ${summary.completedBookings} completed`,      icon: ClipboardList, accent: '#0ea5a0' },
    { title: 'Customers',        value: `${summary.activeCustomers}`,       detail: `${summary.recentBookings} bookings in the last 30 days`,                           icon: Users,         accent: '#f59e0b' },
    { title: 'Active Catalog',   value: `${summary.activePackages}`,        detail: `${summary.activeServices} services · ${summary.activeProducts} products`,          icon: Package,       accent: '#8b5cf6' },
  ] : [];

  const adminSections = [
    { title: 'Manage Products',      description: 'Add and manage chemical inventory',                              icon: Beaker,      path: '/admin/products',              accent: '#3b82f6' },
    { title: 'Manage Services',      description: 'Create services and assign products',                            icon: Package,     path: '/admin/services',              accent: '#22c55e' },
    { title: 'Manage Packages',      description: 'Build packages and set pricing',                                 icon: ShoppingBag, path: '/admin/packages',              accent: '#8b5cf6' },
    { title: 'Manage Plans',         description: 'Create and edit subscription plan templates',                    icon: Layers,      path: '/admin/plans',                 accent: '#10b981' },
    { title: 'View Bookings',        description: 'Manage all customer bookings',                                   icon: Calendar,    path: '/admin/bookings',              accent: '#f97316' },
    { title: 'Subscription Bookings',description: 'Manage bookings made via subscription plans',                    icon: Repeat,      path: '/admin/subscription-bookings', accent: '#c8a96b' },
    { title: 'Financial Reports',    description: 'Revenue and profit analysis',                                    icon: TrendingUp,  path: '/admin/reports/financial',     accent: '#ef4444' },
    { title: 'Operational Reports',  description: 'Booking and service statistics',                                 icon: BarChart3,   path: '/admin/reports/operational',   accent: '#6366f1' },
    { title: 'Content Editor',       description: 'Edit home, packages, and booking text/settings',                icon: FileEdit,    path: '/admin/content',               accent: '#f59e0b' },
    { title: 'Offers & Loyalty',     description: 'Manage discounts, coupons, and loyalty rewards',                icon: Ticket,      path: '/admin/offers',                accent: '#14b8a6' },
    { title: 'Manage Staff',         description: 'Add, remove, and manage your detailing team',                   icon: Wrench,      path: '/admin/staff',                 accent: '#06b6d4' },
    { title: 'Detailer Schedule',    description: 'Calendar heatmap of worker busyness and free windows',          icon: Calendar,    path: '/admin/workers/schedule',      accent: '#84cc16' },
    { title: 'Detailer Skills',      description: 'Create and assign skills to detailers for smart job matching', icon: Zap,       path: '/admin/skills',                accent: '#a855f7' },
    { title: 'Job Positions',        description: 'Post and manage open job positions and descriptions',            icon: Briefcase,   path: '/admin/job-positions',         accent: '#f59e0b' },
    { title: 'Settings',             description: 'Cancellation policy, fees, and platform configuration',         icon: Settings,    path: '/admin/settings',              accent: '#94a3b8' },
  ];

  /* ── Axis tick style ─────────────────────────────────────── */
  const axisTick = { fontSize: 11, fill: 'var(--muted-color)', fontWeight: 600 };

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{
          background: `
            radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%),
            radial-gradient(circle at 92% 94%, rgba(14,165,160,0.04) 0%, transparent 32%)
          `,
        }}
      >
        {/* Spectral backdrop orb */}
        <div className="absolute -top-8 -right-24 w-96 h-80 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 90deg,rgba(14,165,160,.08),rgba(0,120,255,.06),rgba(14,165,160,.08),rgba(200,169,107,.05),rgba(14,165,160,.08))', filter: 'blur(88px)', animation: 'spectrum-float 22s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 relative z-10">

          {/* ── Page header ──────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.26em] text-primary">Command Center</p>
              <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
            </div>
            <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)] mb-2">Admin Dashboard</h1>
            <p className="text-[var(--muted-color)]">Live data from your detailing business</p>
          </div>

          {/* ── Summary cards ────────────────────────────── */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
            {loadingSummary
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : summaryCards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title}
                      className="glass-card relative overflow-hidden card-stagger"
                      style={{ animationDelay: `${idx * 0.08}s` }}
                    >
                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-[2px]"
                        style={{ background: `linear-gradient(90deg, transparent, ${card.accent} 50%, transparent)` }} />
                      {/* Prism ray */}
                      <div className="prism-ray" style={{ left: '58%', width: '15%', animation: `prism-ray-sweep ${20 + idx * 3}s ease-in-out ${idx * 2.2}s infinite` }} />

                      <div className="p-6">
                        {/* Icon with glow */}
                        <div className="relative inline-flex items-center justify-center mb-5">
                          <div className="absolute w-14 h-14 rounded-full"
                            style={{ background: `radial-gradient(circle, ${card.accent}22 0%, transparent 70%)`, filter: 'blur(12px)', animation: 'hero-ring-pulse 3.5s ease-in-out infinite' }} />
                          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center icon-pop"
                            style={{ background: `${card.accent}16`, border: `1px solid ${card.accent}38`, boxShadow: `0 4px 18px ${card.accent}1a`, animationDelay: `${idx * 0.12 + 0.18}s` }}>
                            <Icon size={20} style={{ color: card.accent }} />
                          </div>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--muted-color)] mb-1.5">{card.title}</p>
                        <p className="text-3xl font-black text-[var(--heading-color)] mb-1.5">{card.value}</p>
                        <p className="text-xs text-[var(--muted-color)] leading-relaxed">{card.detail}</p>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {/* ── Charts Row 1 ─────────────────────────────── */}
          <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr] mb-6">

            {/* Revenue Trend */}
            <ChartCard
              title="Revenue Trend"
              subtitle="Last 30 days of bookings, revenue, and profit performance"
              badge="Financial"
              accentColor="#c8a96b"
              rayDelay="2s"
              rightAction={
                financialReport ? (
                  <div className="rounded-xl px-4 py-3 text-right"
                    style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.24)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted-color)] mb-0.5">Profit Margin</p>
                    <p className="text-2xl font-black" style={{ color: '#c8a96b' }}>
                      {Number(financialReport.profitMarginPercent || 0).toFixed(1)}%
                    </p>
                  </div>
                ) : null
              }
            >
              {loadingCharts ? (
                <div className="h-80 animate-pulse rounded-xl bg-white/5" />
              ) : revenueTrendData.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width={800} height={320}>
                    <AreaChart data={revenueTrendData}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#c8a96b" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#c8a96b" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#0ea5a0" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#0ea5a0" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888" strokeOpacity={0.12} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={axisTick} />
                      <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} tick={axisTick} />
                      <Tooltip content={<RevenueTooltip />} />
                      <Area type="monotone" dataKey="revenue" stroke="#c8a96b" fill="url(#revenueFill)" strokeWidth={2.5} dot={false} />
                      <Area type="monotone" dataKey="profit"  stroke="#0ea5a0" fill="url(#profitFill)"  strokeWidth={2}   dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 rounded-xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] text-sm">
                  No financial data available yet.
                </div>
              )}
            </ChartCard>

            {/* Booking Mix */}
            <ChartCard
              title="Booking Mix"
              subtitle="Current workload split by booking status"
              badge="Operational"
              accentColor="#0ea5a0"
              rayDelay="9s"
            >
              {loadingCharts ? (
                <div className="h-80 animate-pulse rounded-xl bg-white/5" />
              ) : bookingStatusData.length > 0 ? (
                <>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width={400} height={208}>
                      <PieChart>
                        <Pie data={bookingStatusData} dataKey="value" nameKey="name"
                          innerRadius={54} outerRadius={84} paddingAngle={3}>
                          {bookingStatusData.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<StatusTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {bookingStatusData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between rounded-xl border border-[var(--border-color)] px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span className="text-sm font-semibold text-[var(--text-color)]">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-[var(--heading-color)]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-80 rounded-xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] text-sm">
                  No operational data available yet.
                </div>
              )}
            </ChartCard>
          </div>

          {/* ── Charts Row 2 ─────────────────────────────── */}
          <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr] mb-12">

            {/* Top Packages */}
            <ChartCard
              title="Top Packages"
              subtitle="Best-performing packages by booking volume across the current reporting window"
              badge="Analytics"
              accentColor="#3b82f6"
              rayDelay="5s"
              rightAction={
                <Link to="/admin/reports/operational"
                  className="flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-80"
                  style={{ color: '#3b82f6' }}>
                  Full report <ArrowRight size={11} />
                </Link>
              }
            >
              {loadingCharts ? (
                <div className="h-80 animate-pulse rounded-xl bg-white/5" />
              ) : packagePerformanceData.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width={800} height={320}>
                    <BarChart data={packagePerformanceData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#888" strokeOpacity={0.12} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} />
                      <YAxis type="category" dataKey="name" width={148} tickLine={false} axisLine={false} tick={axisTick} />
                      <Tooltip content={<PackagesTooltip />} />
                      <Bar dataKey="bookings" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 rounded-xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] text-sm">
                  No package analytics available yet.
                </div>
              )}
            </ChartCard>

            {/* Analytics highlights */}
            <div className="space-y-5">
              {loadingCharts
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="glass-card p-5 animate-pulse">
                      <div className="h-2.5 w-24 bg-white/5 rounded-full mb-3" />
                      <div className="h-7 w-28 bg-white/5 rounded-full mb-2" />
                      <div className="h-2.5 w-full bg-white/5 rounded-full" />
                    </div>
                  ))
                : analyticsHighlights.map((item, idx) => (
                    <div key={item.title}
                      className="glass-card relative overflow-hidden card-stagger"
                      style={{ animationDelay: `${0.28 + idx * 0.1}s` }}
                    >
                      {/* Left accent bar */}
                      <div className="absolute top-0 left-0 w-[3px] h-full"
                        style={{ background: `linear-gradient(180deg, ${item.accent} 0%, transparent 100%)` }} />
                      <div className="prism-ray" style={{ left: '65%', width: '12%', animation: `prism-ray-sweep ${17 + idx * 4}s ease-in-out ${idx * 2.5}s infinite` }} />

                      <div className="p-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--muted-color)] mb-1.5">{item.title}</p>
                        <p className="text-2xl font-black text-[var(--heading-color)] mb-1">{item.value}</p>
                        <p className="text-xs text-[var(--muted-color)] leading-relaxed">{item.detail}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* ── Admin sections ────────────────────────────── */}
          <div>
            <div className="mb-7">
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[0.60rem] font-bold uppercase tracking-[0.25em] text-primary">Admin Tools</p>
                <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <h2 className="premium-heading text-2xl font-bold text-[var(--heading-color)]">Management Center</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {adminSections.map((section, idx) => {
                const Icon = section.icon;
                return (
                  <Link
                    key={idx}
                    to={section.path}
                    className="glass-card prism-glass group relative overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                    onMouseMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                      e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                    }}
                    style={{ '--px': '50%', '--py': '50%' }}
                  >
                    {/* Left accent bar */}
                    <div className="absolute top-0 left-0 w-[3px] h-full"
                      style={{ background: `linear-gradient(180deg, ${section.accent} 0%, ${section.accent}44 55%, transparent 100%)` }} />
                    {/* Top accent glow on hover */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `linear-gradient(90deg, transparent, ${section.accent}80, transparent)` }} />
                    {/* Prism ray */}
                    <div className="prism-ray" style={{ left: '72%', width: '11%', animation: `prism-ray-sweep ${14 + idx * 1.7}s ease-in-out ${idx * 1.1}s infinite` }} />

                    <div className="p-6">
                      {/* Icon with hover ring */}
                      <div className="relative inline-flex items-center justify-center mb-5">
                        <div className="absolute w-14 h-14 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                          style={{ background: `radial-gradient(circle, ${section.accent}25 0%, transparent 70%)`, filter: 'blur(10px)' }} />
                        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                          style={{ background: `${section.accent}14`, border: `1px solid ${section.accent}30` }}>
                          <Icon size={20} style={{ color: section.accent }} />
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-[var(--heading-color)] mb-1.5 group-hover:text-primary transition-colors duration-300">
                        {section.title}
                      </h3>
                      <p className="text-xs text-[var(--muted-color)] leading-relaxed mb-4">{section.description}</p>

                      <div className="flex items-center gap-1.5 text-xs font-bold opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-300"
                        style={{ color: section.accent }}>
                        Open <ArrowRight size={11} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default AdminDashboard;