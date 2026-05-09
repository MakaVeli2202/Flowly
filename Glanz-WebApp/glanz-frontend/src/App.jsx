import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import useLenis from './hooks/useLenis';
import {
  BrowserRouter as Router, Routes, Route, Navigate,
  useLocation, Link,
} from 'react-router-dom';
import { AuthProvider }     from './context/AuthContext';
import { PackagesProvider } from './context/PackagesContext';
import { LanguageProvider } from './context/LanguageContext';
import { FeaturesProvider } from './context/FeaturesContext';
import { SettingsProvider } from './context/SettingsContext';
import ErrorBoundary        from './components/shared/ErrorBoundary';
import { ToastProvider }    from './components/shared/Toast';
import Navbar               from './components/layout/Navbar';
import Footer               from './components/layout/Footer';
import ProtectedRoute       from './components/shared/ProtectedRoute';
import WhatsAppWidget      from './components/shared/WhatsAppWidget';
import RainBackground       from './components/shared/RainBackground';
import CookieConsent        from './components/ui/CookieConsent';

// ─── Customer pages (eager) ───────────────────────────────────────────────────
import Home                from './pages/customer/Home';
import Login               from './pages/customer/Login';
import Register            from './pages/customer/Register';
import Packages            from './pages/customer/Packages';
import Booking             from './pages/customer/Booking';
import BookingConfirmation from './pages/customer/BookingConfirmation';
import MyBookings          from './pages/customer/MyBookings';
import Profile             from './pages/customer/Profile';
import Referrals           from './pages/customer/Referrals';
import Plans               from './pages/customer/Plans';
import Careers             from './pages/customer/Careers';

// ─── Customer pages (lazy) ────────────────────────────────────────────────────
const MySubscription             = lazy(() => import('./pages/customer/MySubscription'));
const SubscriptionCheckout       = lazy(() => import('./pages/customer/SubscriptionCheckout'));
const AdminSubscriptionBookings  = lazy(() => import('./pages/admin/AdminSubscriptionBookings'));

// ─── Admin pages (lazy) ───────────────────────────────────────────────────────
const AdminDashboard         = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts          = lazy(() => import('./pages/admin/AdminProducts'));
const AdminServices          = lazy(() => import('./pages/admin/AdminServices'));
const AdminPackages          = lazy(() => import('./pages/admin/AdminPackages'));
const AdminBookings          = lazy(() => import('./pages/admin/AdminBookings'));
const AdminBookingDetail     = lazy(() => import('./pages/admin/AdminBookingDetail'));
const AdminReportFinancial   = lazy(() => import('./pages/admin/AdminReportFinancial'));
const AdminReportOperational = lazy(() => import('./pages/admin/AdminReportOperational'));
const AdminContent           = lazy(() => import('./pages/admin/AdminContent'));
const AdminOffers            = lazy(() => import('./pages/admin/AdminOffers'));
const AdminStaff             = lazy(() => import('./pages/admin/AdminStaff'));
const AdminNotifications     = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminWorkerSchedule    = lazy(() => import('./pages/admin/AdminWorkerSchedule'));
const AdminSettings          = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPlans             = lazy(() => import('./pages/admin/AdminPlans'));
const AdminJobPositions      = lazy(() => import('./pages/admin/AdminJobPositions'));
const AdminSkills            = lazy(() => import('./pages/admin/AdminSkills'));
const AdminWorkerManagement   = lazy(() => import('./pages/admin/AdminWorkerManagement'));
const AdminWorkerSales       = lazy(() => import('./pages/admin/AdminWorkerSales'));
const AdminPayroll           = lazy(() => import('./pages/admin/AdminPayroll'));
const LiveMapTracking        = lazy(() => import('./pages/admin/LiveMapTracking'));
const AdminDevSettings       = lazy(() => import('./pages/admin/AdminDevSettings'));
const AdminCrm               = lazy(() => import('./pages/admin/AdminCrm'));
const SubscriptionBooking    = lazy(() => import('./pages/customer/SubscriptionBooking'));

// ─── Admin fallback ───────────────────────────────────────────────────────────

function AdminFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[var(--border-color)] border-t-primary animate-spin" />
    </div>
  );
}

// ─── Customer fallback ───────────────────────────────────────────────────────

function CustomerFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[var(--border-color)] border-t-primary animate-spin" />
    </div>
  );
}

// ─── Admin route factory ──────────────────────────────────────────────────────
// ⚠️  This is a FUNCTION, not a component.
// React Router v6 requires all <Routes> children to be <Route> elements.
// A wrapper component inserts an extra React element and breaks the tree.
// Calling adminRoute() as a function returns the <Route> JSX directly.

function adminRoute(path, Component) {
  return (
    <Route
      key={path}
      path={path}
      element={
        <ProtectedRoute requireAdmin>
          <Suspense fallback={<AdminFallback />}>
            <Component />
          </Suspense>
        </ProtectedRoute>
      }
    />
  );
}

// ─── 404 ──────────────────────────────────────────────────────────────────────

import NotFound from './components/ui/not-found';

// function NotFound() {
//   return (
//     <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
//       {/* Ambient orbs */}
//       <div className="absolute top-10 left-1/4 w-72 h-72 rounded-full pointer-events-none"
//         style={{ background: 'rgba(200,169,107,0.07)', filter: 'blur(80px)' }} />
//       <div className="absolute bottom-10 right-1/4 w-56 h-56 rounded-full pointer-events-none"
//         style={{ background: 'rgba(14,165,160,0.06)', filter: 'blur(70px)' }} />
//       <div className="relative z-10 glass-card prism-glass p-12 md:p-16 max-w-md w-full mx-auto overflow-hidden"
//         onMouseMove={(e) => {
//           const r = e.currentTarget.getBoundingClientRect();
//           e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
//           e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
//         }}>
//         <div className="absolute top-0 left-[10%] right-[10%] h-[1.5px]"
//           style={{ background: 'linear-gradient(90deg,transparent,#c8a96b 40%,#0ea5a0 60%,transparent)' }} />
//         <div className="prism-ray" style={{ left: '20%', width: '25%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
//         <p className="premium-heading font-black text-primary mb-2 leading-none" style={{ fontSize: '7rem' }}>404</p>
//         <div className="spectrum-line mb-6" />
//         <h1 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-3">Page not found</h1>
//         <p className="text-[var(--muted-color)] mb-8 text-sm leading-relaxed">
//           The page you're looking for doesn't exist or has been moved.
//         </p>
//         <Link to="/" className="premium-btn inline-flex">
//           Go Home <ArrowRight size={16} />
//         </Link>
//       </div>
//     </div>
//   );
// }

// ─── Scroll to top on navigation ──────────────────────────────────────────────

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// ─── Route tree ───────────────────────────────────────────────────────────────

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -24px 0px' }
    );
    const t = setTimeout(() => {
      document
        .querySelectorAll('.reveal-up:not(.visible), .reveal-fade:not(.visible), .reveal-left:not(.visible), .reveal-right:not(.visible)')
        .forEach((el) => observer.observe(el));
    }, 60);
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [location.pathname]);

  return (
    <main key={location.pathname} className="relative z-10 flex-grow">
      <ScrollToTop />
      <Routes location={location}>

        {/* ── Public ─────────────────────────────────────────────────── */}
        <Route path="/"         element={<Home />}     />
        <Route path="/login"    element={<Login />}    />
        <Route path="/register" element={<Register />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/plans"    element={<Plans />}    />
        <Route path="/careers"  element={<Careers />}  />

        {/* ── Protected customer ─────────────────────────────────────── */}
        <Route path="/booking" element={
          <ProtectedRoute requireCustomer><Booking /></ProtectedRoute>
        } />
        <Route path="/booking-confirmation/:bookingNumber" element={
          <ProtectedRoute requireCustomer><BookingConfirmation /></ProtectedRoute>
        } />
        <Route path="/my-bookings" element={
          <ProtectedRoute requireCustomer><MyBookings /></ProtectedRoute>
        } />
        <Route path="/referrals" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><Referrals /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/my-subscription" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<AdminFallback />}><MySubscription /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/subscribe" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<AdminFallback />}><SubscriptionCheckout /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute requireCustomer><Profile /></ProtectedRoute>
        } />

        {/* ── Admin (lazy) — note: function calls, not JSX components ── */}
        {adminRoute('/admin',                     AdminDashboard)}
        {adminRoute('/admin/products',            AdminProducts)}
        {adminRoute('/admin/services',            AdminServices)}
        {adminRoute('/admin/packages',            AdminPackages)}
        {adminRoute('/admin/plans',               AdminPlans)}
        {adminRoute('/admin/bookings',            AdminBookings)}
        {adminRoute('/admin/bookings/:id',        AdminBookingDetail)}
        {adminRoute('/admin/reports/financial',   AdminReportFinancial)}
        {adminRoute('/admin/reports/operational', AdminReportOperational)}
        {adminRoute('/admin/content',             AdminContent)}
        {adminRoute('/admin/offers',              AdminOffers)}
        {adminRoute('/admin/staff',               AdminStaff)}
        {adminRoute('/admin/notifications',       AdminNotifications)}
        {adminRoute('/admin/workers/schedule',    AdminWorkerSchedule)}
        {adminRoute('/admin/settings',            AdminSettings)}
        {adminRoute('/admin/job-positions',       AdminJobPositions)}
        {adminRoute('/admin/skills',              AdminSkills)}
        {adminRoute('/admin/workers/management', AdminWorkerManagement)}
        {adminRoute('/admin/workers/sales',     AdminWorkerSales)}
        {adminRoute('/admin/subscription-bookings', AdminSubscriptionBookings)}
        {adminRoute('/admin/payroll',              AdminPayroll)}
        {adminRoute('/admin/live-map',             LiveMapTracking)}
        {adminRoute('/admin/dev-settings',         AdminDevSettings)}
        {adminRoute('/admin/crm',                 AdminCrm)}

        <Route path="/subscription-booking" element={
          <ProtectedRoute><Suspense fallback={<AdminFallback />}><SubscriptionBooking /></Suspense></ProtectedRoute>
        } />

        {/* ── Catch-all 404 ──────────────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
   useLenis();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const onMove = (e) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <Router>
      <LanguageProvider>
      <FeaturesProvider>
      <SettingsProvider>
      <AuthProvider>
        <PackagesProvider>
          <ErrorBoundary>
            <ToastProvider>
            <div className="relative flex flex-col min-h-screen [overflow:clip] app-shell">
              <RainBackground />
              <div className="cursor-spotlight" aria-hidden="true" />
              <div className="noise-grain"      aria-hidden="true" />
              <div className="scroll-progress-bar" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />
              <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl bg-orb-1" aria-hidden="true" />
              <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-secondary/20 blur-3xl bg-orb-2" aria-hidden="true" />
               <Navbar theme={theme} onToggleTheme={toggleTheme} />
               <AppRoutes />
               <Footer />
                <WhatsAppWidget />
              </div>
            </ToastProvider>
          </ErrorBoundary>
        </PackagesProvider>
      </AuthProvider>
      </SettingsProvider>
      </FeaturesProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;