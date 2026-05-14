"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, LogOut, Sun, Moon, Globe, BookOpen, Home, ShoppingBag, Layers, UserPlus, LogIn, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../api/notifications';
import { subscribeToNotifications } from '../../api/notificationBus';
import { useLanguage, LANGUAGES } from '../../context/LanguageContext';


const CUSTOMER_LINKS = [
  { to: '/',           label: 'Home',     icon: Home     },
  { to: '/packages',   label: 'Packages', icon: ShoppingBag },
  { to: '/plans',      label: 'Plans',    icon: Layers   },
];

export function CustomerNavbar({ theme, onToggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { lang, t, setLang } = useLanguage();
  const { user, isAuthenticated, isEmployee, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const notificationsRef = useRef(null);
  const langMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handler = (e) => {
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowNotifications(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowLangMenu(false);
  }, [location.pathname]);

  const loadNotifications = async () => {
    try {
      const [count, recent] = await Promise.all([
        notificationsAPI.getUnreadCount(),
        notificationsAPI.getRecent(6),
      ]);
      setUnreadCount(count || 0);
      setNotifications(recent || []);
    } catch (error) {
      void error;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      return;
    }
    loadNotifications();
    const onNotif = () => loadNotifications();
    return subscribeToNotifications(onNotif);
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = (notification) => {
    if (notification.bookingId) {
      sessionStorage.setItem('highlightCustomerBookingId', notification.bookingId);
      navigate('/my-bookings');
      setShowNotifications(false);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsAPI.markAllRead();
    loadNotifications();
  };

  const loginButtonElement = (
    <Link to="/login" className="px-4 py-2 text-xs sm:text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors duration-200 w-full sm:w-auto text-center">
      {t('login')}
    </Link>
  );

  const signupButtonElement = (
    <Link to="/register" className="relative group w-full sm:w-auto">
      <div className="absolute inset-0 -m-2 rounded-full hidden sm:block bg-gray-100 opacity-40 filter blur-lg pointer-events-none transition-all duration-300 ease-out group-hover:opacity-60 group-hover:blur-xl group-hover:-m-3"></div>
      <span className="relative z-10 block px-4 py-2 text-xs sm:text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full hover:from-gray-200 hover:to-gray-400 transition-all duration-200 w-full sm:w-auto text-center">
        {t('signUp')}
      </span>
    </Link>
  );

  function relativeTime(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <>
      {/* Navbar */}
      <header className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-40
                         flex flex-col items-center
                         pl-6 pr-6 py-3 backdrop-blur-sm
                         ${isOpen ? 'rounded-xl' : 'rounded-full'}
                         border border-[#333] bg-[#1f1f1f57]
                         w-[calc(100%-2rem)] max-w-6xl
                         transition-[border-radius] duration-0 ease-in-out`}>

        <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">

          <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
            {CUSTOMER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                {t(link.label.toLowerCase())}
              </Link>
            ))}
            {isAuthenticated && (
              <Link to="/my-bookings" className="text-gray-300 hover:text-white transition-colors font-medium">
                {t('myBookings')}
              </Link>
            )}
          </nav>

          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setShowLangMenu(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 text-gray-300 transition-all text-xs"
              >
                <Globe size={14} />
                {lang.toUpperCase()}
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-[#333] bg-[#1f1f1f] shadow-2xl z-50 py-1.5">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-all ${
                        lang === l.code ? 'text-white' : 'text-gray-300 hover:text-white'
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

            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <div className="relative" ref={notificationsRef}>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(v => !v)}
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
                    <div className="absolute right-0 top-full mt-3 w-96 rounded-xl border border-[#333] bg-[#1f1f1f] shadow-2xl z-50 flex flex-col max-h-[28rem]">
                      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-[#333]">
                        <p className="text-sm font-bold text-white">{t('notifications')}</p>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80"
                          >
                            {t('markAll')}
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
                        {notifications.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-6">{t('noNotifications')}</p>
                        )}
                        {notifications.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => handleNotificationClick(notif)}
                            className={`w-full rounded-xl px-3 py-3 text-left transition-all ${
                              notif.isRead ? 'hover:bg-white/5' : 'bg-primary/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg flex-shrink-0 ${
                                notif.isRead ? 'bg-gray-700 text-gray-400' : 'bg-primary/20 text-primary'
                              }`}>
                                <Bell size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{notif.type || 'Notification'}</p>
                                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notif.message}</p>
                                <span className="text-[10px] text-gray-500 mt-1 inline-block">{relativeTime(notif.createdAt)}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile - hide from employees */}
                {!isEmployee && (
                  <Link to="/profile" className="text-gray-300 hover:text-white transition-colors font-medium text-sm">
                    {user?.firstName || t('profile')}
                  </Link>
                )}

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                {loginButtonElement}
                {signupButtonElement}
              </>
            )}
          </div>

          <button className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                         ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
          <nav className="flex flex-col items-center space-y-4 text-base w-full">
            {CUSTOMER_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="text-gray-300 hover:text-white transition-colors w-full text-center" onClick={() => setIsOpen(false)}>
                {t(link.label.toLowerCase())}
              </Link>
            ))}
            {isAuthenticated && (
              <Link to="/my-bookings" className="text-gray-300 hover:text-white transition-colors w-full text-center" onClick={() => setIsOpen(false)}>
                {t('myBookings')}
              </Link>
            )}
          </nav>
          <div className="flex flex-col items-center space-y-4 mt-4 w-full">
            {isAuthenticated ? (
              <>
                {!isEmployee && (
                  <Link to="/profile" className="text-gray-300 hover:text-white transition-colors w-full text-center" onClick={() => setIsOpen(false)}>
                    <User size={16} className="inline mr-2" />
                    {t('profile')}
                  </Link>
                )}
                <button
                  onClick={() => { handleLogout(); setIsOpen(false); }}
                  className="flex items-center gap-2 text-rose-400 w-full justify-center"
                >
                  <LogOut size={16} />
                  {t('logout')}
                </button>
              </>
            ) : (
              <>
                {loginButtonElement}
                {signupButtonElement}
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
