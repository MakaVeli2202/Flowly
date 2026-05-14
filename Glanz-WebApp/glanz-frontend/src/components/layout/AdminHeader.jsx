"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Bell, LogOut, Sun, Moon, Globe, ChevronDown, CheckCheck, Menu, X, BookOpen, Users, Calendar, Clock, DollarSign, MapPin, Settings, Wrench, BarChart2, Package, UserCheck, Play, Pause, Car, AlertTriangle, Gift, Tag, Star, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../api/notifications';
import { subscribeToNotifications } from '../../api/notificationBus';
import { useLanguage, LANGUAGES } from '../../context/LanguageContext';

// ADMIN_LINKS and ADMIN_GROUPS will be defined inside the AdminHeader function after we have access to the `t` function

function CheckCircle({ size, className }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

function XCircle({ size, className }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}

export function AdminHeader({ theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const adminMenuRef = useRef(null);
  const notificationsRef = useRef(null);
  const langMenuRef = useRef(null);
  const { user, token, logout } = useAuth();
  const { lang, t, setLang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const relativeTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const NOTIF_CONFIG = {
    NewBooking:            { icon: BookOpen,    color: 'text-blue-400 bg-blue-500/20', label: t('notifications.newBooking') },
    BookingConfirmed:      { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/20', label: t('notifications.bookingConfirmed') },
    BookingCancelled:      { icon: XCircle,     color: 'text-rose-400 bg-rose-500/20', label: t('notifications.bookingCancelled') },
    BookingStatusChanged:  { icon: Car,         color: 'text-cyan-400 bg-cyan-500/20', label: t('notifications.bookingStatusChanged') },
    WorkerArrived:         { icon: Car,         color: 'text-green-400 bg-green-500/20', label: t('notifications.workerArrived') },
    JobStarted:            { icon: Play,        color: 'text-blue-400 bg-blue-500/20', label: t('notifications.jobStarted') },
    JobCompleted:          { icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/20', label: t('notifications.jobCompleted') },
    LowStock:              { icon: AlertTriangle, color: 'text-rose-400 bg-rose-500/20', label: t('notifications.lowStock') },
    SpecialOffer:          { icon: Tag,         color: 'text-purple-400 bg-purple-500/20', label: t('notifications.specialOffer') },
    LoyaltyReward:         { icon: Gift,        color: 'text-amber-400 bg-amber-500/20', label: t('notifications.loyaltyReward') },
    CancellationRequested: { icon: XCircle,   color: 'text-orange-400 bg-orange-500/20', label: t('notifications.cancellationRequested') },
  };

  const ADMIN_LINKS = [
    { to: '/admin',                     labelKey: 'navbar.dashboard',   icon: LayoutDashboard },
    { to: '/admin/bookings',            labelKey: 'navbar.bookings',    icon: BookOpen },
    { to: '/admin/staff',               labelKey: 'navbar.staff',       icon: Users },
    { to: '/admin/workers/schedule',    labelKey: 'navbar.schedule',    icon: Calendar },
    { to: '/admin/workers/management',  labelKey: 'navbar.shifts',      icon: Clock },
    { to: '/admin/payroll',             labelKey: 'navbar.payroll',     icon: DollarSign },
    { to: '/admin/live-map',            labelKey: 'navbar.liveMap',     icon: MapPin },
    { to: '/admin/analytics',          labelKey: 'navbar.analytics',   icon: TrendingUp },
    { to: '/admin/settings',            labelKey: 'common.settings',    icon: Settings },
    { to: '/admin/dev-settings',        labelKey: 'navbar.devSettings', icon: Wrench },
    { to: '/admin/translations',        labelKey: 'navbar.translations', icon: Globe },
  ];

  const ADMIN_GROUPS = [
    {
      titleKey: 'navbar.operations',
      links: ['/admin/bookings', '/admin/workers/schedule', '/admin/workers/management', '/admin/live-map', '/admin/analytics', '/admin/payroll'],
    },
    {
      titleKey: 'navbar.management',
      links: ['/admin', '/admin/staff', '/admin/settings', '/admin/dev-settings', '/admin/translations'],
    },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) setShowAdminMenu(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) setShowNotifications(false);
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setShowLangMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setShowAdminMenu(false);
    setShowNotifications(false);
    setShowLangMenu(false);
  }, [location.pathname]);

  const loadNotificationSummary = useCallback(async () => {
    if (!token) return;
    try {
      const [count, recent] = await Promise.all([
        notificationsAPI.getUnreadCount(),
        notificationsAPI.getRecent(6),
      ]);
      setUnreadCount(count || 0);
      setNotifications(recent || []);
    } catch {
      // ignore notification load errors
    }
  }, [token]);

  useEffect(() => {
    loadNotificationSummary();
    const onNotif = () => loadNotificationSummary();
    return subscribeToNotifications(onNotif);
  }, [loadNotificationSummary]);

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
    if (nextOpen) await refreshNotifications();
  };

  const handleMarkNotificationRead = async (id) => {
    await notificationsAPI.markRead(id);
    await refreshNotifications();
  };

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllRead();
    await refreshNotifications();
  };

  const handleNotificationClick = (notification) => {
    if (notification.bookingId) {
      sessionStorage.setItem('highlightBookingId', notification.bookingId);
      navigate('/admin/bookings');
      setShowNotifications(false);
      handleMarkNotificationRead(notification.id);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`flex sticky px-4 z-50 top-0 w-full bg-[#0d1117] items-center h-16 justify-between transition-border duration-300 ${
      scrolled ? "border-b border-gray-800" : "border-b-0"
    }`}>
      <div className="flex items-center justify-between w-full mx-auto max-w-7xl">
        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {/* Dashboard Button - Always visible */}
           <Link
             to="/admin"
             className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
               location.pathname === '/admin'
                 ? 'bg-primary text-white'
                 : 'text-gray-300 hover:text-white hover:bg-white/10'
             }`}
           >
             <LayoutDashboard size={14} className="inline mr-1.5" />
             {t('navbar.dashboard')}
           </Link>

          {/* Admin Dropdown */}
          <div className="relative" ref={adminMenuRef}>
<button
  type="button"
  onClick={() => setShowAdminMenu((v) => !v)}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
>
  {t('navbar.admin')}
  <ChevronDown size={14} className={`transition-transform ${showAdminMenu ? 'rotate-180' : ''}`} />
</button>

            {showAdminMenu && (
              <div className="absolute left-0 top-full mt-3 w-[38rem] rounded-2xl border border-gray-800 bg-[#0d1117] shadow-2xl z-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  {ADMIN_GROUPS.map((group) => (
                    <div key={group.titleKey} className="rounded-xl border border-gray-800 p-2">
                       <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                         {t(group.titleKey)}
                       </p>
                      <div className="space-y-1">
                        {group.links.map((path) => {
                          const item = ADMIN_LINKS.find((l) => l.to === path);
                          if (!item) return null;
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`block rounded-lg px-2.5 py-2 transition-all ${
                                location.pathname === item.to
                                  ? 'bg-primary/15 text-primary'
                                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                              onClick={() => setShowAdminMenu(false)}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="mt-0.5 rounded-md border border-gray-700 p-1.5"><Icon size={14} /></span>
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold">
                                    {t(item.labelKey)}
                                  </span>
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Language */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setShowLangMenu(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 text-gray-300 text-xs"
            >
              <Globe size={14} />
              {lang.toUpperCase()}
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl z-50 py-1.5">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-all ${
                      lang === l.code ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>{l.flag}</span>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-all"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={handleNotificationToggle}
              className="relative p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-all"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-3 w-96 rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl z-50 flex flex-col max-h-[28rem]">
                <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-gray-800">
                  <p className="text-sm font-bold text-white">{t('notifications')}</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80"
                    >
                      <CheckCheck size={13} />
                      {t('markAllRead')}
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
                  {notificationsLoading && (
                    <p className="text-sm text-gray-400 text-center py-6">{t('loading')}</p>
                  )}
                  {!notificationsLoading && notifications.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">{t('noNotifications')}</p>
                  )}
                  {!notificationsLoading && notifications.map((notif) => {
                    const config = NOTIF_CONFIG[notif.type] || { icon: Bell, color: 'text-gray-400 bg-gray-700', label: t('notifications.notification') };
                    const IconComponent = config.icon;
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full rounded-xl px-3 py-3 text-left transition-all ${
                          notif.isRead ? 'hover:bg-white/5' : 'bg-primary/10'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${config.color}`}>
                            <IconComponent size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{config.label}</p>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notif.message}</p>
                            <span className="text-[10px] text-gray-500 mt-1 inline-block">{relativeTime(notif.createdAt)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
            <span className="text-sm text-gray-300 hidden sm:block">{user?.firstName || t('navbar.admin')}</span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowAdminMenu(!showAdminMenu)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-gray-300"
          >
            {showAdminMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {showAdminMenu && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-[#0d1117] border-b border-gray-800 p-4">
          <div className="space-y-1">
{ADMIN_LINKS.map((link) => {
  const { to, label, icon } = link;
  const Icon = icon;
  return (
  <Link
    key={to}
    to={to}
    onClick={() => setShowAdminMenu(false)}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
      location.pathname === to
        ? 'bg-primary/10 text-primary font-semibold'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    <Icon size={16} />
    {t(label)}
  </Link>
  );
})}
          </div>
        </div>
      )}
    </div>
  );
}
