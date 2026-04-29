import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Droplet, LogOut, LayoutDashboard, Sun, Moon, Bell, CheckCheck, ChevronDown, BookOpen, Users, Calendar, Package, BarChart2, Settings, Home, LogIn, UserPlus, ShoppingBag, Globe, Layers, Car, CheckCircle, XCircle, Clock, AlertTriangle, Gift, Tag, UserCheck, Briefcase, MapPin, DollarSign, Wrench, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BUSINESS } from '../../config/business';
import { notificationsAPI } from '../../api/notifications';
import { subscribeToNotifications } from '../../api/notificationBus';
import { useRealtimeStatus } from '../../hooks/useRealtimeStatus';
import { useLanguage, ADMIN_LABEL_KEYS, LANGUAGES } from '../../context/LanguageContext';

const Play = ({ size, className }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8 5v14l11-7z"/></svg>;
const Pause = ({ size, className }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;

const NOTIF_CONFIG = {
  NewBooking:            { icon: BookOpen,    color: 'text-blue-400 bg-blue-500/20', label: 'New Booking' },
  BookingConfirmed:      { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/20', label: 'Booking Confirmed' },
  BookingCancelled:    { icon: XCircle,     color: 'text-rose-400 bg-rose-500/20', label: 'Booking Cancelled' },
  BookingStatusChanged: { icon: Car,         color: 'text-cyan-400 bg-cyan-500/20', label: 'Status Updated' },
  BookingReassigned:  { icon: UserCheck,   color: 'text-amber-400 bg-amber-500/20', label: 'Worker Reassigned' },
  BookingClaimed:      { icon: UserCheck,   color: 'text-emerald-400 bg-emerald-500/20', label: 'Worker Assigned' },
  WorkerArrived:       { icon: Car,         color: 'text-green-400 bg-green-500/20', label: 'Detailer Arrived' },
  WorkerRunningLate:    { icon: Clock,       color: 'text-amber-400 bg-amber-500/20', label: 'Running Late' },
  JobStarted:          { icon: Play,        color: 'text-blue-400 bg-blue-500/20', label: 'Service Started' },
  JobPaused:           { icon: Pause,       color: 'text-orange-400 bg-orange-500/20', label: 'Service Paused' },
  JobResumed:          { icon: Play,        color: 'text-green-400 bg-green-500/20', label: 'Service Resumed' },
  JobCompleted:        { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/20', label: 'Service Completed' },
  LowStock:            { icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/20', label: 'Low Stock Alert' },
  SpecialOffer:        { icon: Tag,         color: 'text-purple-400 bg-purple-500/20', label: 'Special Offer' },
  LoyaltyReward:       { icon: Gift,        color: 'text-amber-400 bg-amber-500/20', label: 'Loyalty Reward' },
  OfferAssigned:        { icon: Gift,        color: 'text-emerald-400 bg-emerald-500/20', label: 'New Offer' },
  CancellationRequested:{ icon: XCircle,   color: 'text-orange-400 bg-orange-500/20', label: 'Cancellation Request' },
  RescheduleRequested:{ icon: Clock,      color: 'text-amber-400 bg-amber-500/20', label: 'Reschedule Request' },
  BookingUnassigned:        { icon: UserCheck,   color: 'text-rose-400 bg-rose-500/20', label: 'Worker Unassigned' },
  LoyaltyReviewRequested:   { icon: Star,        color: 'text-yellow-400 bg-yellow-500/20', label: 'Loyalty Review' },
};

function formatNotifType(type) {
  return NOTIF_CONFIG[type]?.label || type?.replace(/([A-Z])/g, ' $1').trim() || 'Notification';
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Admin nav structure
const ADMIN_LINKS = [
  { to: '/admin',                      label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/admin/bookings',             label: 'Bookings',     icon: BookOpen },
  { to: '/admin/staff',               label: 'Staff',        icon: Users },
  { to: '/admin/workers/schedule',    label: 'Schedule',    icon: Calendar },
  { to: '/admin/workers/management',   label: 'Shifts',       icon: Clock },
  { to: '/admin/workers/sales',        label: 'Sales Kit',    icon: Briefcase },
  { to: '/admin/payroll',             label: 'Payroll',      icon: DollarSign },
  { to: '/admin/live-map',            label: 'Live Map',     icon: MapPin },
  { to: '/admin/settings',            label: 'Settings',     icon: Settings },
  { to: '/admin/dev-settings',        label: 'Dev Settings', icon: Wrench },
];

// Customer nav links
const CUSTOMER_LINKS = [
  { to: '/',           label: 'Home',     icon: Home     },
  { to: '/packages',   label: 'Packages', icon: ShoppingBag },
  { to: '/plans',      label: 'Plans',    icon: Layers   },
];

// Shared AudioContext — created once and unlocked on first user gesture
let _audioCtx = null;

function _getOrCreateAudioCtx() {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  return _audioCtx;
}

// Unlock audio on first user interaction (click/keydown/touch)
// so that sound works even when the tab is in background or has no recent gesture.
function _unlockAudio() {
  const ctx = _getOrCreateAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}
['click', 'keydown', 'touchstart', 'pointerdown'].forEach((ev) =>
  document.addEventListener(ev, _unlockAudio, { once: false, passive: true })
);

async function playNotificationSound() {
  // Vibrate on mobile browsers that support it (Android Chrome/Firefox)
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  try {
    const ctx = _getOrCreateAudioCtx();
    if (!ctx) return;

    // Resume in case browser suspended the context
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return; // give up if still blocked

    const t = ctx.currentTime;

    // Soft chime: two notes staggered 120ms apart
    [[880, 0.18, 0.7], [1109, 0.10, 0.55]].forEach(([freq, gain, decay], i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env);
      env.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t + i * 0.12);
      env.gain.linearRampToValueAtTime(gain, t + i * 0.12 + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + decay);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + decay);
    });
  } catch {
    // Silent fail — browser may block audio without prior user interaction
  }
}

function Navbar({ theme, onToggleTheme }) {
  const { lang, t, setLang, toggleLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const adminMenuRef = useRef(null);
  const notificationsRef = useRef(null);
  const langMenuRef = useRef(null);
    const { user, isAuthenticated, isAdmin, isEmployee, logout } = useAuth();
  const wsStatus = useRealtimeStatus();
  const navigate = useNavigate();
  const location = useLocation();
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setShowAdminMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setShowAdminMenu(false);
    setShowNotifications(false);
    setShowLangMenu(false);
  }, [location.pathname]);

  // Update current time every second for debugging
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadNotificationSummary = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [count, recent] = await Promise.all([
        notificationsAPI.getUnreadCount(),
        notificationsAPI.getRecent(6),
      ]);
      setUnreadCount(count || 0);
      setNotifications(recent || []);
    } catch {
      // Keep previous values
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotificationSummary();

    // AuthContext owns start/stop lifecycle — Navbar only subscribes to events
    const onNotif = () => {
      loadNotificationSummary();
      playNotificationSound();
    };

    return subscribeToNotifications(onNotif);
  }, [isAuthenticated, loadNotificationSummary]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotificationSummary();
    }
  }, [location.pathname, isAuthenticated, loadNotificationSummary]);

  const refreshNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const [count, recent] = await Promise.all([
        notificationsAPI.getUnreadCount(),
        notificationsAPI.getRecent(10),
      ]);
      setUnreadCount(count || 0);
      setNotifications(recent || []);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleNotificationToggle = async () => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);
    if (nextOpen) {
      await refreshNotifications();
    }
  };

  const handleMarkNotificationRead = async (id) => {
    await notificationsAPI.markRead(id);
    await refreshNotifications();
  };

  const handleNotificationClick = (notification) => {
    const type = notification.type || '';
    const isOfferNotif = type === 'SpecialOffer' || type === 'OfferAssigned';

    if (isOfferNotif && !isAdmin) {
      setShowNotifications(false);
      handleMarkNotificationRead(notification.id);
      navigate('/my-bookings');
      return;
    }

    if (type === 'LoyaltyReviewRequested') {
      setShowNotifications(false);
      handleMarkNotificationRead(notification.id);
      const target = '/admin/offers?tab=loyalty';
      if (location.pathname === '/admin/offers') {
        // Already on offers page — refresh data
        window.dispatchEvent(new CustomEvent('refresh-offers-data'));
        // Update tab if needed
        const url = new URL(window.location);
        url.searchParams.set('tab', 'loyalty');
        navigate(`${url.pathname}${url.search}`, { replace: true });
      } else {
        navigate(target);
      }
      return;
    }

    if (notification.bookingId) {
      if (isAdmin) {
        sessionStorage.setItem('highlightBookingId', notification.bookingId);
        window.dispatchEvent(new CustomEvent('highlight-booking', {
          detail: { bookingId: Number(notification.bookingId) }
        }));
        navigate('/admin/bookings');
      } else {
        sessionStorage.setItem('highlightCustomerBookingId', notification.bookingId);
        window.dispatchEvent(new CustomEvent('highlight-customer-booking', {
          detail: { bookingId: Number(notification.bookingId) }
        }));
        navigate('/my-bookings');
      }
      setShowNotifications(false);
      handleMarkNotificationRead(notification.id);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllRead();
    await refreshNotifications();
    setShowNotifications(false);
  };

  const handleViewAllNotifications = () => {
    setShowNotifications(false);
    navigate(isAdmin ? '/admin/notifications' : '/my-bookings');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <nav className="sticky top-0 z-50 bg-transparent backdrop-blur-md transition-all duration-300">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link to={isAdmin ? '/admin' : '/'} className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/Glanz-Logo.png" alt={BUSINESS.name} className="h-14 md:h-16 w-auto object-contain" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {/* Admin: Home link + Admin dropdown */}
            {isAdmin && (
              <>
                <Link to="/" className="text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors font-medium text-sm tracking-tight flex items-center gap-1.5">
                  <Home size={15} />
                  {t('home')}
                </Link>
                <div className="relative" ref={adminMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowAdminMenu((v) => !v)}
                    className="flex items-center gap-2 text-[var(--text-color)] hover:text-primary transition-colors font-medium text-sm tracking-tight group"
                  >
                    <LayoutDashboard size={16} className="group-hover:scale-110 transition-transform" />
                    {t('admin')}
                    <ChevronDown size={14} className={`transition-transform duration-300 ${showAdminMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Admin Dropdown — only Bookings, Schedule, Settings */}
                  {showAdminMenu && (
                    <div className="absolute left-0 top-full mt-3 w-52 rounded-xl border border-[var(--border-color)]/40 bg-[var(--surface-bg)] shadow-2xl z-50 py-2 overflow-hidden">
                      {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
                        <Link
                          key={to}
                          to={to}
                          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all tracking-tight ${
                            location.pathname === to
                              ? 'bg-primary/15 text-primary'
                              : 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/8'
                          }`}
                        >
                          <Icon size={16} />
                          {t(ADMIN_LABEL_KEYS[label] || label.toLowerCase())}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Customer Nav Links — hide from employees */}
            {!isAdmin && !isEmployee && (
              <>
                {CUSTOMER_LINKS.map(({ to, label }) => (
                  <Link key={to} to={to} className="text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors font-medium text-sm tracking-tight">
                    {t(label.toLowerCase())}
                  </Link>
                ))}
                {isAuthenticated && (
                  <Link to="/my-bookings" className="text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors font-medium text-sm tracking-tight">{t('myBookings')}</Link>
                )}
              </>
            )}

            {/* Right side actions */}
            <div className="flex items-center gap-4 pl-8">
              {/* Language Dropdown */}
              <div className="relative" ref={langMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowLangMenu(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[var(--text-color)] transition-all text-xs font-bold tracking-wide"
                  aria-label="Select language"
                >
                  <Globe size={14} />
                  {LANGUAGES.find(l => l.code === lang)?.flag} {lang.toUpperCase()}
                  <ChevronDown size={12} className={`transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                </button>
                {showLangMenu && (
                  <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-[var(--border-color)]/40 bg-[var(--surface-bg)] shadow-2xl z-50 py-1.5 overflow-hidden">
                    {LANGUAGES.map(l => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-all ${
                          lang === l.code ? 'bg-primary/15 text-primary' : 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/8'
                        }`}
                      >
                        <span>{l.flag}</span>
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

{/* Debug: Current Time */}
              <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-black/20 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                <Clock size={10} />
                <span>{currentTime.toLocaleTimeString()}</span>
                <span className="text-amber-400/60">{currentTime.toLocaleDateString()}</span>
              </div>

              {/* WebSocket status dot — only shown when not connected */}
              {isAuthenticated && wsStatus !== 'connected' && (
                <div
                  title={wsStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold"
                  style={{
                    backgroundColor: wsStatus === 'reconnecting' ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                    border: `1px solid ${wsStatus === 'reconnecting' ? 'rgba(251,191,36,0.35)' : 'rgba(248,113,113,0.35)'}`,
                    color: wsStatus === 'reconnecting' ? '#FBBF24' : '#F87171',
                  }}
                >
                  <span
                    className={wsStatus === 'reconnecting' ? 'animate-pulse' : ''}
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: wsStatus === 'reconnecting' ? '#FBBF24' : '#F87171',
                    }}
                  />
                  {wsStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
                </div>
              )}

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-color)] transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <div className="relative" ref={notificationsRef}>
                    <button
                      type="button"
                      onClick={handleNotificationToggle}
                      className="relative p-2 rounded-lg hover:bg-white/10 text-[var(--text-color)] transition-all"
                      aria-label="Notifications"
                    >
                      <Bell size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute -right-2 -top-2 min-w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 top-full mt-3 w-96 rounded-xl border border-[var(--border-color)]/40 bg-[var(--surface-bg)] shadow-2xl z-50 flex flex-col max-h-[28rem]">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-[var(--border-color)]/30 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[var(--text-color)] tracking-tight">{t('notifications')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {unreadCount > 0 && (
                              <span className="text-xs font-semibold text-[var(--muted-color)]">{unreadCount} {t('unread')}</span>
                            )}
                            <button
                              type="button"
                              onClick={handleMarkAllRead}
                              disabled={unreadCount === 0}
                              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition tracking-tight disabled:opacity-40"
                            >
                              <CheckCheck size={13} />
                              {t('markAll')}
                            </button>
                          </div>
                        </div>

                        {/* Notification list */}
                        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
                          {notificationsLoading && (
                            <p className="text-sm text-[var(--muted-color)] text-center py-6">{t('loading')}</p>
                          )}
                          {!notificationsLoading && notifications.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 px-4">
                              <div className="w-12 h-12 rounded-full bg-[var(--card-bg)] flex items-center justify-center mb-3">
                                <Bell size={20} className="text-[var(--muted-color)]" />
                              </div>
                              <p className="text-sm text-[var(--muted-color)] text-center">{t('noNotifications')}</p>
                            </div>
                          )}
                          {!notificationsLoading && notifications.map((notification) => {
                            const config = NOTIF_CONFIG[notification.type] || { icon: Bell, color: 'text-[var(--muted-color)] bg-[var(--card-bg)]', label: 'Notification' };
                            const IconComponent = config.icon;
                            return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => handleNotificationClick(notification)}
                              className={`w-full rounded-xl px-3 py-3 text-left transition-all ${
                                notification.isRead
                                  ? 'hover:bg-white/5'
                                  : 'bg-primary/10 hover:bg-primary/15'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${config.color}`}>
                                  <IconComponent size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-[var(--text-color)] tracking-tight truncate">
                                      {config.label}
                                    </p>
                                    {!notification.isRead && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 animate-pulse" />
                                    )}
                                  </div>
                                  <p className="text-xs text-[var(--muted-color)] mt-1 leading-relaxed line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <span className="text-[10px] text-[var(--muted-color)] mt-1.5 inline-block">
                                    {relativeTime(notification.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );})}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-[var(--border-color)]/30 flex-shrink-0">
                          <button
                            type="button"
                            onClick={handleViewAllNotifications}
                            className="w-full text-primary hover:text-primary/80 text-xs font-bold transition tracking-tight"
                          >
                            {t('viewAllNotifications')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile & Logout — hide profile from employees */}
                  <div className="flex items-center gap-4 pl-4">
                    {!isEmployee && (
                      <Link to="/profile" className="text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors font-medium text-sm tracking-tight">
                        {user?.firstName || t('profile')}
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
                      title="Logout"
                    >
                      <LogOut size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-4 py-2 text-sm font-semibold text-primary hover:text-primary/80 transition tracking-tight">
                    {t('login')}
                  </Link>
                  <Link to="/register" className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg hover:shadow-primary/20 transition-all text-sm font-semibold tracking-tight">
                    {t('signUp')}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors text-[var(--text-color)]"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-1 rounded-xl p-3 mb-3">
            {/* Language Selector */}
            <div className="border-b border-[var(--border-color)]/20 pb-2 mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-color)] px-3 pb-1.5">Language</p>
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { setLang(l.code); setIsOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm font-medium tracking-tight ${
                    lang === l.code ? 'bg-primary/10 text-primary' : 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5'
                  }`}
                >
                  <span>{l.flag}</span>
                  {l.label}
                </button>
              ))}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                onToggleTheme();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-[var(--text-color)] font-medium text-sm tracking-tight"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? t('lightMode') : t('darkMode')}
            </button>

            {/* Admin: Home link */}
            {isAdmin && (
              <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-[var(--text-color)] font-medium text-sm tracking-tight">
                <Home size={16} />
                {t('home')}
              </Link>
            )}

            {/* Customer Links */}
            {!isAdmin && (
              <>
                {CUSTOMER_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-[var(--text-color)] font-medium text-sm tracking-tight">
                    <Icon size={16} />
                    {t(label.toLowerCase())}
                  </Link>
                ))}
              </>
            )}

            {/* Admin Links */}
            {isAdmin && (
              <div className="pt-2 mt-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-color)] px-3 pb-2">{t('admin')}</p>
                {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                      location.pathname === to
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} />
                    {t(ADMIN_LABEL_KEYS[label] || label.toLowerCase())}
                  </Link>
                ))}
              </div>
            )}

            {/* My Bookings */}
            {!isAdmin && isAuthenticated && (
              <Link to="/my-bookings" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-[var(--text-color)] font-medium text-sm tracking-tight">
                <BookOpen size={16} />
                {t('myBookings')}
              </Link>
            )}

            {/* Auth Section */}
            {isAuthenticated ? (
              <div className="pt-2 mt-2">
                <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-[var(--text-color)] font-medium text-sm tracking-tight">
                  <Users size={16} />
                  {t('profile')}
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-rose-500/10 transition text-rose-400 font-medium text-sm mt-1 tracking-tight"
                >
                  <LogOut size={16} />
                  {t('logout')}
                </button>
              </div>
            ) : (
              <div className="pt-2 mt-2 space-y-2">
                <Link to="/login" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-primary font-semibold text-sm tracking-tight">
                  <LogIn size={16} />
                  {t('login')}
                </Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm tracking-tight">
                  <UserPlus size={16} />
                  {t('signUp')}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;