import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, BellOff, Circle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { notificationsAPI } from '../../api/notifications';

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
  33%      { transform: translate(10px,-12px) rotate(120deg); opacity: 0.28; }
  66%      { transform: translate(-6px,7px)   rotate(240deg); opacity: 0.20; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.42),  0 0 22px rgba(255,165,0,.14); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.42),  0 0 22px rgba(160,0,255,.14); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.42),  0 0 22px rgba(255,0,100,.14); }
}
@keyframes notif-enter {
  from { transform: translateX(-10px) scale(0.98); opacity: 0; }
  to   { transform: translateX(0)     scale(1);    opacity: 1; }
}
@keyframes bell-float {
  0%,100% { transform: translateY(0)   rotate(0deg);   }
  25%      { transform: translateY(-6px) rotate(-8deg); }
  75%      { transform: translateY(-3px) rotate(6deg);  }
}
@keyframes unread-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(200,169,107,0); }
  50%      { box-shadow: 0 0 0 4px rgba(200,169,107,0.12); }
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
    transparent 0%, rgba(255,55,55,.032) 15%, rgba(255,200,0,.044) 30%,
    rgba(0,255,145,.036) 50%, rgba(0,145,255,.036) 70%,
    rgba(195,0,255,.028) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.10) 0%, rgba(80,255,160,.07) 30%,
    rgba(40,130,255,.07) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.32s; mix-blend-mode: screen;
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
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.notif-enter    { animation: notif-enter 0.42s cubic-bezier(0.22,1,0.36,1) both; }
.bell-animate   { animation: bell-float 3.2s ease-in-out infinite; }
.unread-pulse   { animation: unread-pulse 2.8s ease-in-out infinite; }
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
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 460, height: 460, top: '-230px', left: '-230px' }} />;
}

/* ── SkeletonNotif ───────────────────────────────────────────── */
function SkeletonNotif({ delay = '0s' }) {
  return (
    <div className="glass-card p-5 animate-pulse" style={{ animationDelay: delay }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full bg-white/8" />
            <div className="h-2.5 w-20 rounded-full bg-white/8" />
          </div>
          <div className="h-3.5 w-3/4 rounded-full bg-white/8 mb-2" />
          <div className="h-2.5 w-1/2 rounded-full bg-white/5" />
          <div className="h-2 w-24 rounded-full bg-white/5 mt-3" />
        </div>
        <div className="w-20 h-7 rounded-lg bg-white/5 flex-shrink-0" />
      </div>
    </div>
  );
}

/* ── NotifTypeBadge ─────────────────────────────────────────── */
const TYPE_STYLES = {
  BookingCreated:     { color: '#0ea5a0', label: 'New Booking'   },
  BookingCancelled:   { color: '#ef4444', label: 'Cancellation'  },
  BookingCompleted:   { color: '#22c55e', label: 'Completed'     },
  PaymentReceived:    { color: '#c8a96b', label: 'Payment'       },
  RescheduleRequest:  { color: '#f59e0b', label: 'Reschedule'    },
  CancellationRequest:{ color: '#f97316', label: 'Cancel Req.'   },
  WorkerAssigned:     { color: '#8b5cf6', label: 'Assignment'    },
};
function NotifTypeBadge({ type }) {
  const style = TYPE_STYLES[type] || { color: '#94a3b8', label: type || 'Alert' };
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
      style={{ background: `${style.color}18`, border: `1px solid ${style.color}30`, color: style.color }}>
      <Circle size={5} fill={style.color} stroke="none" />
      {style.label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   ADMIN NOTIFICATIONS
════════════════════════════════════════════════════════════ */
function AdminNotifications() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.getAll();
      setNotifications(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, []);

  const handleMarkRead    = async (id) => { await notificationsAPI.markRead(id);    await loadNotifications(); };
  const handleMarkAllRead = async ()   => { await notificationsAPI.markAllRead();   await loadNotifications(); };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{
          background: `
            radial-gradient(circle at 7% 7%, rgba(200,169,107,0.05) 0%, transparent 38%),
            radial-gradient(circle at 93% 91%, rgba(14,165,160,0.04) 0%, transparent 32%)
          `,
        }}
      >
        {/* Backdrop orb */}
        <div className="absolute top-0 right-0 w-72 h-60 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 70deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(80px)', animation: 'spectrum-float 18s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 md:px-6 max-w-3xl relative z-10">

          {/* ── Page header ──────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
              <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">{t('adminPanel')}</p>
              <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                    <Bell size={16} style={{ color: '#c8a96b' }} />
                  </div>
                  <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">Notifications</h1>
                  {/* Live unread badge */}
                  {!loading && unreadCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black"
                      style={{ background: 'rgba(200,169,107,0.16)', border: '1px solid rgba(200,169,107,0.30)', color: '#c8a96b' }}>
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--muted-color)] ml-12">Saved admin alerts and booking activity</p>
              </div>

              {/* Mark all read — prism glow only when there are unread items */}
              <div className={unreadCount > 0 ? 'cta-prism-glow rounded-xl' : ''}>
                <button type="button" onClick={handleMarkAllRead}
                  disabled={loading || unreadCount === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] transition hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCheck size={15} />
                  Mark all read
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats strip ──────────────────────────────── */}
          {!loading && notifications.length > 0 && (
            <div className="glass-card relative overflow-hidden mb-5">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="grid grid-cols-3 divide-x divide-[var(--border-color)]">
                {[
                  { label: 'Total',  value: notifications.length,                         color: 'text-[var(--heading-color)]' },
                  { label: 'Unread', value: unreadCount,                                  color: 'text-primary'                },
                  { label: 'Read',   value: notifications.length - unreadCount,            color: 'text-[var(--muted-color)]'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-6 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">{label}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Spectrum separator ───────────────────────── */}
          <div className="mb-5"><div className="spectrum-line" /></div>

          {/* ── Notifications list ───────────────────────── */}
          <div className="space-y-3">

            {/* Loading skeletons */}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <SkeletonNotif key={i} delay={`${i * 0.06}s`} />
            ))}

            {/* Empty state */}
            {!loading && notifications.length === 0 && (
              <div className="glass-card relative overflow-hidden py-20 flex flex-col items-center justify-center text-center">
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
                <div className="prism-ray" style={{ left: '48%', width: '16%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />

                <div className="relative mb-5">
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(200,169,107,0.14) 0%, transparent 70%)', filter: 'blur(18px)' }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(200,169,107,0.10)', border: '1px solid rgba(200,169,107,0.22)' }}>
                    <BellOff size={28} className="bell-animate" style={{ color: '#c8a96b' }} />
                  </div>
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-1.5">All Clear</h2>
                <p className="text-sm text-[var(--muted-color)]">No notifications found.</p>
              </div>
            )}

            {/* Notification rows */}
            {!loading && notifications.map((notif, idx) => {
              const isUnread = !notif.isRead;
              return (
                <div
                  key={notif.id}
                  className={`glass-card prism-glass relative overflow-hidden notif-enter ${isUnread ? 'unread-pulse' : ''}`}
                  style={{ animationDelay: `${idx * 0.045}s`, '--px': '50%', '--py': '50%' }}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                    e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                  }}
                >
                  {/* Left accent bar — gold for unread, muted for read */}
                  <div className="absolute top-0 left-0 w-[3px] h-full"
                    style={{
                      background: isUnread
                        ? 'linear-gradient(180deg, #c8a96b 0%, #c8a96b88 55%, transparent 100%)'
                        : 'linear-gradient(180deg, rgba(148,163,184,0.22) 0%, transparent 100%)',
                    }} />

                  {/* Prism ray — only on unread */}
                  {isUnread && (
                    <div className="prism-ray"
                      style={{ left: '70%', width: '12%', animation: `prism-ray-sweep ${16 + (idx % 4) * 3}s ease-in-out ${(idx % 5) * 1.6}s infinite` }} />
                  )}

                  <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Type badge + unread dot */}
                        <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                          <NotifTypeBadge type={notif.type} />
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: '#c8a96b', boxShadow: '0 0 6px rgba(200,169,107,0.65)' }} />
                          )}
                        </div>

                        {/* Message */}
                        <p className={`text-sm leading-relaxed mb-2 ${isUnread ? 'font-semibold text-[var(--heading-color)]' : 'text-[var(--text-color)]'}`}>
                          {notif.message}
                        </p>

                        {/* Timestamp */}
                        <p className="text-[11px] text-[var(--muted-color)]">
                          {new Date(notif.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {/* Mark read button */}
                      {isUnread && (
                        <button type="button" onClick={() => handleMarkRead(notif.id)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-color)] hover:border-primary/40 hover:text-primary transition">
                          <CheckCheck size={12} />
                          Mark read
                        </button>
                      )}

                      {/* Read indicator */}
                      {!isUnread && (
                        <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.20)' }}>
                          <CheckCheck size={11} className="text-green-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </div>
    </>
  );
}

export default AdminNotifications;