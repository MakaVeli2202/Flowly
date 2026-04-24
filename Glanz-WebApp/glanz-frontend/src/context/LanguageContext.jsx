import React, { createContext, useContext, useState, useEffect } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English',  dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية',   dir: 'rtl', flag: '🇶🇦' },
  { code: 'de', label: 'Deutsch',  dir: 'ltr', flag: '🇩🇪' },
];

const translations = {
  en: {
    // Nav
    home: 'Home',
    packages: 'Packages',
    plans: 'Plans',
    myBookings: 'My Bookings',
    admin: 'Admin',
    dashboard: 'Dashboard',
    bookings: 'Bookings',
    schedule: 'Schedule',
    staff: 'Staff',
    subscriptions: 'Subscriptions',
    reports: 'Reports',
    settings: 'Settings',
    profile: 'Profile',
    logout: 'Logout',
    login: 'Login',
    signUp: 'Sign Up',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    // Notifications
    notifications: 'Notifications',
    markAll: 'Mark all',
    viewAllNotifications: 'View all notifications →',
    noNotifications: 'No notifications',
    unread: 'unread',
    loading: 'Loading…',
    reconnecting: 'Reconnecting…',
    live: 'Live',
    // Bookings page
    requestCancellation: 'Request Cancellation',
    submitting: 'Submitting…',
    requestCancellationTitle: 'Request Cancellation',
    requestCancellationDesc: 'Submit a cancellation request for',
    cancellationReason: 'Reason for cancellation',
    cancellationReasonPlaceholder: 'Please tell us why you want to cancel…',
    keepBooking: 'Keep Booking',
    submitRequest: 'Submit Request',
    cancellationRequestedSuccess: 'Cancellation request submitted. Our team will review it shortly.',
    cancellationFeeWarning: 'Cancellation fee may apply',
    freeCancellation: 'Free cancellation — no charge will be applied.',
    checkingPolicy: 'Checking cancellation policy…',
    edit: 'Edit',
    bookAgain: 'Book Again',
    viewDetails: 'View Details',
  },
  ar: {
    // Nav
    home: 'الرئيسية',
    packages: 'الباقات',
    plans: 'الخطط',
    myBookings: 'حجوزاتي',
    admin: 'المشرف',
    dashboard: 'لوحة التحكم',
    bookings: 'الحجوزات',
    schedule: 'الجدول الزمني',
    staff: 'الموظفون',
    subscriptions: 'الاشتراكات',
    reports: 'التقارير',
    settings: 'الإعدادات',
    profile: 'الملف الشخصي',
    logout: 'تسجيل الخروج',
    login: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الداكن',
    // Notifications
    notifications: 'الإشعارات',
    markAll: 'تحديد الكل',
    viewAllNotifications: 'عرض كل الإشعارات ←',
    noNotifications: 'لا توجد إشعارات',
    unread: 'غير مقروءة',
    loading: 'جاري التحميل…',
    reconnecting: 'إعادة الاتصال…',
    live: 'مباشر',
    // Bookings page
    requestCancellation: 'طلب إلغاء',
    submitting: 'جاري الإرسال…',
    requestCancellationTitle: 'طلب إلغاء الحجز',
    requestCancellationDesc: 'إرسال طلب إلغاء لـ',
    cancellationReason: 'سبب الإلغاء',
    cancellationReasonPlaceholder: 'يرجى إخبارنا بسبب رغبتك في الإلغاء…',
    keepBooking: 'الاحتفاظ بالحجز',
    submitRequest: 'إرسال الطلب',
    cancellationRequestedSuccess: 'تم إرسال طلب الإلغاء. سيراجعه فريقنا قريباً.',
    cancellationFeeWarning: 'قد تُطبَّق رسوم إلغاء',
    freeCancellation: 'إلغاء مجاني — لن يتم تحصيل أي رسوم.',
    checkingPolicy: 'جاري التحقق من سياسة الإلغاء…',
    edit: 'تعديل',
    bookAgain: 'احجز مجدداً',
    viewDetails: 'عرض التفاصيل',
  },
  de: {
    // Nav
    home: 'Startseite',
    packages: 'Pakete',
    plans: 'Pläne',
    myBookings: 'Meine Buchungen',
    admin: 'Admin',
    dashboard: 'Dashboard',
    bookings: 'Buchungen',
    schedule: 'Zeitplan',
    staff: 'Personal',
    subscriptions: 'Abonnements',
    reports: 'Berichte',
    settings: 'Einstellungen',
    profile: 'Profil',
    logout: 'Abmelden',
    login: 'Anmelden',
    signUp: 'Registrieren',
    lightMode: 'Hellmodus',
    darkMode: 'Dunkelmodus',
    // Notifications
    notifications: 'Benachrichtigungen',
    markAll: 'Alle markieren',
    viewAllNotifications: 'Alle Benachrichtigungen →',
    noNotifications: 'Keine Benachrichtigungen',
    unread: 'ungelesen',
    loading: 'Lädt…',
    reconnecting: 'Verbinde erneut…',
    live: 'Live',
    // Bookings page
    requestCancellation: 'Stornierung anfragen',
    submitting: 'Wird gesendet…',
    requestCancellationTitle: 'Stornierung anfragen',
    requestCancellationDesc: 'Stornierungsanfrage für',
    cancellationReason: 'Stornierungsgrund',
    cancellationReasonPlaceholder: 'Bitte teilen Sie uns Ihren Stornierungsgrund mit…',
    keepBooking: 'Buchung behalten',
    submitRequest: 'Anfrage senden',
    cancellationRequestedSuccess: 'Stornierungsanfrage eingereicht. Unser Team wird sie bald prüfen.',
    cancellationFeeWarning: 'Stornierungsgebühr kann anfallen',
    freeCancellation: 'Kostenlose Stornierung — keine Gebühr.',
    checkingPolicy: 'Stornierungsrichtlinie wird geprüft…',
    edit: 'Bearbeiten',
    bookAgain: 'Erneut buchen',
    viewDetails: 'Details anzeigen',
  },
};

const ADMIN_LABEL_KEYS = {
  Dashboard: 'dashboard',
  Bookings: 'bookings',
  Schedule: 'schedule',
  Staff: 'staff',
  Subscriptions: 'subscriptions',
  Reports: 'reports',
  Settings: 'settings',
};

export { ADMIN_LABEL_KEYS };

const LanguageContext = createContext({
  lang: 'en',
  t: (key) => key,
  setLang: () => {},
  toggleLang: () => {},
});

export function LanguageProvider({ children }) {
  const browserLang = navigator.language?.split('-')[0];
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || (LANGUAGES.some(l => l.code === browserLang) ? browserLang : 'en'));

  useEffect(() => {
    const langDef = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
    document.documentElement.lang = lang;
    document.documentElement.dir = langDef.dir;
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key;

  const setLang = (code) => {
    if (LANGUAGES.some(l => l.code === code)) {
      setLangState(code);
    }
  };

  const toggleLang = () => {
    const idx = LANGUAGES.findIndex(l => l.code === lang);
    setLangState(LANGUAGES[(idx + 1) % LANGUAGES.length].code);
  };

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
