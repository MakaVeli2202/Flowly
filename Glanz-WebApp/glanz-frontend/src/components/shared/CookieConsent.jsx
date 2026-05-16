import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

const STORAGE_KEY = 'glanz_cookie_consent';

export default function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 z-[9000] mx-auto max-w-2xl"
    >
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="flex-1 text-sm text-[var(--text-color)] leading-relaxed">
          {t('common.cookieConsent.message')}{' '}
          <Link to="/privacy-policy" className="underline text-primary hover:opacity-80 transition-opacity">
            {t('common.cookieConsent.privacyLink')}
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border-color)] text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
          >
            {t('common.cookieConsent.decline')}
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t('common.cookieConsent.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
