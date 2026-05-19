import React, { lazy, Suspense, useEffect, useState } from 'react';
import useLenis from './hooks/useLenis';
import { useTenantBranding } from './hooks/useTenantBranding';
import {
  BrowserRouter as Router, Routes, Route, Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider }     from './context/AuthContext';
import { PackagesProvider } from './context/PackagesContext';
import { LanguageProvider } from './context/LanguageContext';
import { FeaturesProvider } from './context/FeaturesContext';
import { SettingsProvider } from './context/SettingsContext';
import { TenantProvider }   from './context/TenantContext';
import SiteAccessGate from './components/shared/SiteAccessGate';
import ErrorBoundary        from './components/shared/ErrorBoundary';
import { ToastProvider }    from './components/shared/Toast';
import Navbar               from './components/layout/Navbar';
import Footer               from './components/layout/Footer';
import ProtectedRoute       from './components/shared/ProtectedRoute';
import WhatsAppWidget      from './components/shared/WhatsAppWidget';
import CookieConsent       from './components/shared/CookieConsent';
import RainBackground       from './components/shared/RainBackground';
import LoadingCircle        from './components/shared/LoadingCircle';
import { usePageTracking } from './hooks/usePageTracking';

// ─── Customer pages — critical path (eager) ──────────────────────────────────
// Home and Login are the only guaranteed first-visit pages. Everything else
// is lazy so framer-motion / heavy components don't parse on initial load.
import Home  from './pages/customer/Home';
import Login from './pages/customer/Login';

// ─── Customer pages (lazy) ────────────────────────────────────────────────────
const Register            = lazy(() => import('./pages/customer/Register'));
const EmailVerification   = lazy(() => import('./pages/customer/EmailVerification'));
const ForgotPassword      = lazy(() => import('./pages/customer/ForgotPassword'));
const ResetPassword       = lazy(() => import('./pages/customer/ResetPassword'));
const Packages            = lazy(() => import('./pages/customer/Packages'));
const Plans               = lazy(() => import('./pages/customer/Plans'));
const Careers             = lazy(() => import('./pages/customer/Careers'));
const PrivacyPolicy       = lazy(() => import('./pages/customer/PrivacyPolicy'));
const Marketplace         = lazy(() => import('./pages/Marketplace'));
const BusinessProfile     = lazy(() => import('./pages/BusinessProfile'));
const Booking             = lazy(() => import('./pages/customer/Booking'));
const BookingConfirmation = lazy(() => import('./pages/customer/BookingConfirmation'));
const MyBookings          = lazy(() => import('./pages/customer/MyBookings'));
const Profile             = lazy(() => import('./pages/customer/Profile'));
const Referrals           = lazy(() => import('./pages/customer/Referrals'));
const MySubscription             = lazy(() => import('./pages/customer/MySubscription'));
const SubscriptionCheckout       = lazy(() => import('./pages/customer/SubscriptionCheckout'));
const RecurringBookings          = lazy(() => import('./pages/customer/RecurringBookings'));
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
const AdminAddStaff          = lazy(() => import('./pages/admin/AdminAddStaff'));
const AdminNotifications     = lazy(() => import('./pages/admin/AdminNotifications'));
const AdminWorkerSchedule    = lazy(() => import('./pages/admin/AdminWorkerSchedule'));
const AdminSettings          = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPlans             = lazy(() => import('./pages/admin/AdminPlans'));
const AdminJobPositions      = lazy(() => import('./pages/admin/AdminJobPositions'));
const AdminSkills            = lazy(() => import('./pages/admin/AdminSkills'));
const AdminWorkerManagement   = lazy(() => import('./pages/admin/AdminWorkerManagement'));
const AdminPayroll           = lazy(() => import('./pages/admin/AdminPayroll'));
const LiveMapTracking        = lazy(() => import('./pages/admin/LiveMapTracking'));
const AdminDevSettings       = lazy(() => import('./pages/admin/AdminDevSettings'));
const AdminCrm               = lazy(() => import('./pages/admin/AdminCrm'));
const AdminTranslations      = lazy(() => import('./pages/admin/AdminTranslations'));
const AdminAnalytics         = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminPurchaseOrders    = lazy(() => import('./pages/admin/AdminPurchaseOrders'));
const AdminResources         = lazy(() => import('./pages/admin/AdminResources'));
const AdminPos               = lazy(() => import('./pages/admin/AdminPos'));
const AdminWebhook           = lazy(() => import('./pages/admin/AdminWebhook'));
const AdminBranding          = lazy(() => import('./pages/admin/AdminBranding'));
const AdminCohort            = lazy(() => import('./pages/admin/AdminCohort'));
const AdminGdpr              = lazy(() => import('./pages/admin/AdminGdpr'));
const AdminSegmentation          = lazy(() => import('./pages/admin/AdminSegmentation'));
const AdminNotificationSettings  = lazy(() => import('./pages/admin/AdminNotificationSettings'));
const AdminAddOns                = lazy(() => import('./pages/admin/AdminAddOns'));
const AdminCertifications        = lazy(() => import('./pages/admin/AdminCertifications'));
const AdminAI                    = lazy(() => import('./pages/admin/AdminAI'));
const PayPage                    = lazy(() => import('./pages/customer/PayPage'));
const AdminSSO               = lazy(() => import('./pages/admin/AdminSSO'));
const AdminReseller          = lazy(() => import('./pages/admin/AdminReseller'));
const AdminWaitlist              = lazy(() => import('./pages/admin/AdminWaitlist'));
const AdminAssetSearch           = lazy(() => import('./pages/admin/AdminAssetSearch'));
const AdminCorporateAccounts     = lazy(() => import('./pages/admin/AdminCorporateAccounts'));
const SubscriptionBooking        = lazy(() => import('./pages/customer/SubscriptionBooking'));
const AdminRecurringBookings     = lazy(() => import('./pages/admin/AdminRecurringBookings'));
const AdminRKSV                  = lazy(() => import('./pages/admin/AdminRKSV'));
const AdminSEPA                  = lazy(() => import('./pages/admin/AdminSEPA'));
const AdminCampaigns             = lazy(() => import('./pages/admin/AdminCampaigns'));

// ─── Admin fallback ───────────────────────────────────────────────────────────

function AdminFallback() {
  return (
    <LoadingCircle className="min-h-[60vh]" label="Loading page..." />
  );
}

// ─── Customer fallback ───────────────────────────────────────────────────────

function CustomerFallback() {
  return (
    <LoadingCircle className="min-h-[60vh]" label="Loading page..." />
  );
}

// ─── Admin route factory ──────────────────────────────────────────────────────
// ⚠️  This is a FUNCTION, not a component.
// React Router v6 requires all <Routes> children to be <Route> elements.
// A wrapper component inserts an extra React element and breaks the tree.
// Calling adminRoute() as a function returns the <Route> JSX directly.

function adminRoute(path, _PageComponent) {
  const PageComponent = _PageComponent;
  return (
    <Route
      key={path}
      path={path}
      element={
        <ProtectedRoute requireAdmin>
          <Suspense fallback={<AdminFallback />}>
            <PageComponent />
          </Suspense>
        </ProtectedRoute>
      }
    />
  );
}

// ─── 404 / misc lazy ──────────────────────────────────────────────────────────

const NotFound            = lazy(() => import('./components/ui/not-found'));
const ForceChangePassword = lazy(() => import('./pages/shared/ForceChangePassword'));
const OrgRegister             = lazy(() => import('./pages/shared/OrgRegister'));
const AdminOnboarding         = lazy(() => import('./pages/admin/AdminOnboarding'));
const AdminBilling            = lazy(() => import('./pages/admin/AdminBilling'));
const AdminOrgSettings        = lazy(() => import('./pages/admin/AdminOrgSettings'));
const PublicBookingPortal     = lazy(() => import('./pages/customer/PublicBookingPortal'));

// ─── Scroll to top on navigation ──────────────────────────────────────────────

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// ─── Route tree ───────────────────────────────────────────────────────────────

function AppRoutes() {
  usePageTracking();
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
    <main className="relative z-10 flex-grow">
      <ScrollToTop />
      <Routes>

        {/* ── Public ─────────────────────────────────────────────────── */}
        <Route path="/"               element={<Home />}             />
        <Route path="/login"           element={<Login />}            />
        <Route path="/register"        element={
          <Suspense fallback={<CustomerFallback />}><Register /></Suspense>
        } />
        <Route path="/verify-email"    element={
          <Suspense fallback={<CustomerFallback />}><EmailVerification /></Suspense>
        } />
        <Route path="/forgot-password" element={
          <Suspense fallback={<CustomerFallback />}><ForgotPassword /></Suspense>
        } />
        <Route path="/reset-password"  element={
          <Suspense fallback={<CustomerFallback />}><ResetPassword /></Suspense>
        } />
        <Route path="/packages" element={
          <Suspense fallback={<CustomerFallback />}><Packages /></Suspense>
        } />
        <Route path="/plans" element={
          <Suspense fallback={<CustomerFallback />}><Plans /></Suspense>
        } />
        <Route path="/careers" element={
          <Suspense fallback={<CustomerFallback />}><Careers /></Suspense>
        } />
        <Route path="/privacy" element={
          <Suspense fallback={<CustomerFallback />}><PrivacyPolicy /></Suspense>
        } />
        <Route path="/marketplace" element={
          <Suspense fallback={<CustomerFallback />}><Marketplace /></Suspense>
        } />
        <Route path="/business/:slug" element={
          <Suspense fallback={<CustomerFallback />}><BusinessProfile /></Suspense>
        } />

        {/* ── Protected customer ─────────────────────────────────────── */}
        <Route path="/booking" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><Booking /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/booking-confirmation/:bookingNumber" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><BookingConfirmation /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/my-bookings" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><MyBookings /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/my-subscription" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><MySubscription /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/recurring-bookings" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><RecurringBookings /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/subscribe" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><SubscriptionCheckout /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><Profile /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/referrals" element={
          <ProtectedRoute requireCustomer>
            <Suspense fallback={<CustomerFallback />}><Referrals /></Suspense>
          </ProtectedRoute>
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
        {adminRoute('/admin/staff/add',           AdminAddStaff)}
        {adminRoute('/admin/notifications',       AdminNotifications)}
        {adminRoute('/admin/workers/schedule',    AdminWorkerSchedule)}
        {adminRoute('/admin/settings',            AdminSettings)}
        {adminRoute('/admin/job-positions',       AdminJobPositions)}
        {adminRoute('/admin/skills',              AdminSkills)}
        {adminRoute('/admin/workers/management', AdminWorkerManagement)}
        {adminRoute('/admin/subscription-bookings', AdminSubscriptionBookings)}
        {adminRoute('/admin/payroll',              AdminPayroll)}
        {adminRoute('/admin/live-map',             LiveMapTracking)}
        {adminRoute('/admin/dev-settings',         AdminDevSettings)}
        {adminRoute('/admin/crm',                 AdminCrm)}
        {adminRoute('/admin/translations',        AdminTranslations)}
        {adminRoute('/admin/analytics',           AdminAnalytics)}

        <Route path="/subscription-booking" element={
          <ProtectedRoute><Suspense fallback={<AdminFallback />}><SubscriptionBooking /></Suspense></ProtectedRoute>
        } />

        {/* ── Org registration (SaaS sign-up) ────────────────────────── */}
        <Route path="/org/register" element={
          <Suspense fallback={<CustomerFallback />}><OrgRegister /></Suspense>
        } />

        {/* ── Public booking portal ───────────────────────────────────── */}
        <Route path="/book/:slug" element={
          <Suspense fallback={<CustomerFallback />}><PublicBookingPortal /></Suspense>
        } />

        {/* ── Public payment page ─────────────────────────────────────── */}
        <Route path="/pay/:token" element={
          <Suspense fallback={<CustomerFallback />}><PayPage /></Suspense>
        } />

        {/* ── Admin onboarding wizard ─────────────────────────────────── */}
        {adminRoute('/admin/onboarding', AdminOnboarding)}
        {adminRoute('/admin/billing',         AdminBilling)}
        {adminRoute('/admin/org-settings',    AdminOrgSettings)}
        {adminRoute('/admin/purchase-orders', AdminPurchaseOrders)}
        {adminRoute('/admin/resources',       AdminResources)}
        {adminRoute('/admin/pos',             AdminPos)}
        {adminRoute('/admin/webhooks',         AdminWebhook)}
        {adminRoute('/admin/branding',         AdminBranding)}
        {adminRoute('/admin/cohort',           AdminCohort)}
        {adminRoute('/admin/gdpr',             AdminGdpr)}
        {adminRoute('/admin/segmentation',         AdminSegmentation)}
        {adminRoute('/admin/notification-settings', AdminNotificationSettings)}
        {adminRoute('/admin/add-ons',              AdminAddOns)}
        {adminRoute('/admin/certifications',       AdminCertifications)}
        {adminRoute('/admin/ai',                   AdminAI)}
        {adminRoute('/admin/sso',             AdminSSO)}
        {adminRoute('/admin/reseller',        AdminReseller)}
        {adminRoute('/admin/waitlist',             AdminWaitlist)}
        {adminRoute('/admin/asset-search',         AdminAssetSearch)}
        {adminRoute('/admin/corporate-accounts',   AdminCorporateAccounts)}
        {adminRoute('/admin/recurring-bookings',   AdminRecurringBookings)}
        {adminRoute('/admin/rksv',                 AdminRKSV)}
        {adminRoute('/admin/sepa',                 AdminSEPA)}
        {adminRoute('/admin/campaigns',            AdminCampaigns)}

        {/* ── Force password change (staff first login) ───────────────── */}
        <Route path="/force-change-password" element={
          <Suspense fallback={<CustomerFallback />}><ForceChangePassword /></Suspense>
        } />

        {/* ── Catch-all 404 ──────────────────────────────────────────── */}
        <Route path="*" element={
          <Suspense fallback={<CustomerFallback />}><NotFound /></Suspense>
        } />
      </Routes>
    </main>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
   useLenis();
   useTenantBranding();
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
        <TenantProvider>
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
               <SiteAccessGate>
                 <Navbar theme={theme} onToggleTheme={toggleTheme} />
                 <AppRoutes />
                 <Footer />
                 <WhatsAppWidget />
                 <CookieConsent />
               </SiteAccessGate>
              </div>
            </ToastProvider>
          </ErrorBoundary>
        </PackagesProvider>
        </TenantProvider>
      </AuthProvider>
      </SettingsProvider>
      </FeaturesProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;