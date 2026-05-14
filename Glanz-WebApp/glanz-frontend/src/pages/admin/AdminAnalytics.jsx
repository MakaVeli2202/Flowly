import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Users, Globe, Monitor, Smartphone, Tablet,
  RefreshCw, ChevronRight, Eye, Zap, BarChart3, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsAPI } from '../../api/analytics';

/* ── constants ────────────────────────────────────────────────────────────── */

const SOURCE_COLORS = {
  Google:     '#4285F4',
  TikTok:     '#FF0050',
  Instagram:  '#E1306C',
  Facebook:   '#1877F2',
  'Twitter/X':'#1DA1F2',
  YouTube:    '#FF0000',
  Snapchat:   '#FFFC00',
  LinkedIn:   '#0A66C2',
  Direct:     '#c8a96b',
  Referral:   '#0ea5a0',
};

const DEVICE_COLORS = { Desktop: '#c8a96b', Mobile: '#0ea5a0', Tablet: '#8b5cf6' };

const DEVICE_ICON = { Desktop: Monitor, Mobile: Smartphone, Tablet };

const RANGES = [
  { label: 'Today',   days: 0 },
  { label: '7 Days',  days: 7 },
  { label: '30 Days', days: 30 },
];

function sourceColor(src) {
  return SOURCE_COLORS[src] || '#6b7280';
}

function StatCard({ label, value, sub, icon: Icon, accent = '#c8a96b', loading }) {
  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg,transparent,${accent}80,transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">{label}</p>
          {loading ? (
            <div className="h-8 w-20 rounded-md bg-white/10 animate-pulse" />
          ) : (
            <p className="text-3xl font-black tabular-nums text-[var(--heading-color)]">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
          {sub && <p className="text-xs text-[var(--muted-color)] mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

function LiveDot({ active = true }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? 'bg-green-500' : 'bg-gray-500'}`} />
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2 shadow-xl text-xs">
      <p className="font-bold text-[var(--muted-color)] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

/* ── main page ────────────────────────────────────────────────────────────── */

export default function AdminAnalytics() {
  const [range, setRange]       = useState(1);      // index into RANGES
  const [stats, setStats]       = useState(null);
  const [live, setLive]         = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [liveLoading, setLiveLoading]   = useState(true);
  const [error, setError]               = useState('');
  const liveTimerRef = useRef(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setError('');
    try {
      const { days } = RANGES[range];
      const from = days === 0
        ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
        : new Date(Date.now() - days * 86_400_000).toISOString();
      const data = await analyticsAPI.getStats(from, new Date().toISOString());
      setStats(data);
    } catch {
      setError('Failed to load analytics. Check your connection.');
    } finally {
      setStatsLoading(false);
    }
  }, [range]);

  const loadLive = useCallback(async () => {
    try {
      const data = await analyticsAPI.getLive();
      setLive(data);
    } catch { /* silent */ } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    loadLive();
    liveTimerRef.current = setInterval(loadLive, 30_000);
    return () => clearInterval(liveTimerRef.current);
  }, [loadLive]);

  const sourcePie   = (stats?.sources || []).map(s => ({ name: s.source, value: s.count }));
  const devicePie   = (stats?.devices || []).map(d => ({ name: d.device, value: d.count }));
  const topPages    = stats?.topPages || [];
  const timeline    = stats?.timeline || [];

  return (
    <div className="min-h-screen py-10 md:py-14 text-[var(--text-color)]"
      style={{ background: 'radial-gradient(circle at 12% 18%, rgba(200,169,107,0.09), transparent 32%), linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt, var(--surface-bg)) 52%, var(--surface-bg) 100%)' }}>
      <div className="container mx-auto px-4 max-w-6xl space-y-6">

        {/* ── Header ── */}
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-color)] mb-4">
            <Link to="/admin" className="hover:text-primary transition">Dashboard</Link>
            <ChevronRight size={12} />
            <span>Analytics</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.25)' }}>
                <TrendingUp size={22} style={{ color: '#c8a96b' }} />
              </div>
              <div>
                <h1 className="premium-heading text-2xl md:text-3xl font-bold text-[var(--heading-color)]">
                  Website Analytics
                </h1>
                <p className="text-[var(--muted-color)] text-sm mt-0.5">
                  Real-time visitor tracking and traffic sources.
                </p>
              </div>
            </div>

            {/* Range selector */}
            <div className="flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-1">
              {RANGES.map((r, i) => (
                <button key={r.label} type="button" onClick={() => setRange(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    range === i
                      ? 'bg-primary text-white'
                      : 'text-[var(--muted-color)] hover:text-[var(--text-color)]'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* ── Live banner ── */}
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(34,197,94,0.6),transparent)' }} />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LiveDot active={!liveLoading} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)]">
                  Live right now
                </p>
                {liveLoading ? (
                  <div className="h-10 w-16 rounded-md bg-white/10 animate-pulse mt-1" />
                ) : (
                  <p className="text-5xl font-black tabular-nums text-green-400 leading-none mt-1">
                    {live?.activeNow ?? 0}
                  </p>
                )}
                <p className="text-xs text-[var(--muted-color)] mt-0.5">visitors on the site (last 5 min)</p>
              </div>
            </div>

            {/* Live source breakdown */}
            {live?.sources?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {live.sources.map(s => (
                  <div key={s.source} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold"
                    style={{ borderColor: `${sourceColor(s.source)}40`, color: sourceColor(s.source), background: `${sourceColor(s.source)}10` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sourceColor(s.source) }} />
                    {s.source} {s.count}
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={loadLive}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors">
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>

          {/* Live top pages */}
          {live?.pages?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mr-1">On now:</span>
              {live.pages.map(p => (
                <span key={p.page} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-color)] text-[var(--muted-color)]">
                  {p.page} <strong className="text-[var(--text-color)]">{p.count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Page Views" value={stats?.totalViews}    icon={Eye}      accent="#c8a96b" loading={statsLoading} />
          <StatCard label="Unique Visitors"   value={stats?.uniqueVisitors} icon={Users}    accent="#0ea5a0" loading={statsLoading} />
          <StatCard label="New Visitors"      value={stats?.newVisitors}   icon={Zap}      accent="#8b5cf6" loading={statsLoading} />
          <StatCard label="Returning"         value={stats?.returningVisitors} icon={Activity} accent="#f59e0b" loading={statsLoading} />
        </div>

        {/* ── Timeline chart ── */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={16} className="text-primary" />
            <h2 className="font-bold text-[var(--heading-color)]">
              {RANGES[range].days === 0 ? 'Hourly Views Today' : `Daily Views — Last ${RANGES[range].days} Days`}
            </h2>
          </div>
          {statsLoading ? (
            <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
          ) : timeline.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-[var(--muted-color)]">
              No data for this period yet. Views will appear once visitors land on the site.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8a96b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c8a96b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-color)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-color)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="views" name="Views" stroke="#c8a96b" strokeWidth={2}
                  fill="url(#viewsGrad)" dot={false} activeDot={{ r: 4, fill: '#c8a96b' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Source + Device row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Traffic Sources */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Globe size={16} className="text-primary" />
              <h2 className="font-bold text-[var(--heading-color)]">Traffic Sources</h2>
            </div>
            {statsLoading ? (
              <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
            ) : sourcePie.length === 0 ? (
              <p className="text-sm text-[var(--muted-color)] text-center py-12">No source data yet.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={sourcePie} cx="50%" cy="50%" innerRadius={42} outerRadius={72}
                      paddingAngle={3} dataKey="value">
                      {sourcePie.map((entry) => (
                        <Cell key={entry.name} fill={sourceColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 min-w-0">
                  {sourcePie.map(s => {
                    const total = sourcePie.reduce((a, b) => a + b.value, 0);
                    const pct   = total ? Math.round((s.value / total) * 100) : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-semibold text-[var(--text-color)] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: sourceColor(s.name) }} />
                            {s.name}
                          </span>
                          <span className="text-[var(--muted-color)] tabular-nums">{s.value} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: sourceColor(s.name) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Device Breakdown */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Monitor size={16} className="text-primary" />
              <h2 className="font-bold text-[var(--heading-color)]">Devices</h2>
            </div>
            {statsLoading ? (
              <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
            ) : devicePie.length === 0 ? (
              <p className="text-sm text-[var(--muted-color)] text-center py-12">No device data yet.</p>
            ) : (
              <div className="space-y-4">
                {devicePie.map(d => {
                  const total = devicePie.reduce((a, b) => a + b.value, 0);
                  const pct   = total ? Math.round((d.value / total) * 100) : 0;
                  const color = DEVICE_COLORS[d.name] || '#6b7280';
                  const Icon  = DEVICE_ICON[d.name] || Monitor;
                  return (
                    <div key={d.name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-[var(--text-color)]">{d.name}</span>
                          <span className="text-[var(--muted-color)] tabular-nums">{d.value} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Top Pages ── */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Eye size={16} className="text-primary" />
            <h2 className="font-bold text-[var(--heading-color)]">Top Pages</h2>
          </div>
          {statsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : topPages.length === 0 ? (
            <p className="text-sm text-[var(--muted-color)] text-center py-8">No page data yet.</p>
          ) : (
            <div className="space-y-2">
              {topPages.map((p, i) => {
                const max = topPages[0]?.count || 1;
                const pct = Math.round((p.count / max) * 100);
                return (
                  <div key={p.page} className="flex items-center gap-3 group">
                    <span className="text-[10px] font-bold text-[var(--muted-color)] w-4 tabular-nums text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-[var(--text-color)] truncate">{p.page}</span>
                        <span className="text-[var(--muted-color)] tabular-nums ml-3 flex-shrink-0">{p.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
