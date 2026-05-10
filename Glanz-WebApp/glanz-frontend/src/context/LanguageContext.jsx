import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', dir: 'rtl', flag: '🇶🇦' },
  { code: 'de', label: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
];

const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'lang';

const flattenObject = (obj, prefix = '') => {
  const result = {};
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }
  return result;
};

const loadLocale = async (lang) => {
  try {
    const [common, navbar, notifications, bookings] = await Promise.all([
      import(`../locales/${lang}/common.json`),
      import(`../locales/${lang}/navbar.json`),
      import(`../locales/${lang}/notifications.json`),
      import(`../locales/${lang}/bookings.json`),
    ]);
    return {
      ...flattenObject(common.default),
      ...flattenObject(navbar.default),
      ...flattenObject(notifications.default),
      ...flattenObject(bookings.default),
    };
  } catch (e) {
    console.warn(`Failed to load locale ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
    if (lang !== DEFAULT_LANGUAGE) {
      return loadLocale(DEFAULT_LANGUAGE);
    }
    return {};
  }
};

const interpolate = (text, params) => {
  if (!params || typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
};

const getPluralForm = (lang, count) => {
  if (lang === 'ar') {
    if (count === 1) return 'one';
    if (count === 2) return 'two';
    return 'other';
  }
  return count === 1 ? 'one' : 'other';
};

const LanguageContext = createContext({
  lang: 'en',
  t: (key) => key,
  setLang: () => {},
  toggleLang: () => {},
  dir: 'ltr',
  isLoading: true,
});

export function LanguageProvider({ children }) {
  const browserLang = navigator.language?.split('-')[0];
  const defaultLang = localStorage.getItem(STORAGE_KEY) || 
    (LANGUAGES.some(l => l.code === browserLang) ? browserLang : DEFAULT_LANGUAGE);

  const [lang, setLangState] = useState(defaultLang);
  const [translations, setTranslations] = useState({});
  const [fallbackTranslations, setFallbackTranslations] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    loadLocale(lang).then((trans) => {
      setTranslations(trans);
      setIsLoading(false);
    });
  }, [lang]);

  useEffect(() => {
    if (lang !== DEFAULT_LANGUAGE) {
      loadLocale(DEFAULT_LANGUAGE).then(setFallbackTranslations);
    } else {
      setFallbackTranslations({});
    }
  }, [lang]);

  useEffect(() => {
    const langDef = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
    document.documentElement.lang = lang;
    document.documentElement.dir = langDef.dir;
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { lang } }));
  }, [lang]);

  const t = useCallback((key, params) => {
    let value = translations[key] ?? fallbackTranslations[key];

    if (value === undefined) {
      return key;
    }

    if (params?.count !== undefined) {
      const form = getPluralForm(lang, params.count);
      const pluralKey = `${key}_${form}`;
      const pluralValue = translations[pluralKey] ?? fallbackTranslations[pluralKey];
      if (pluralValue) {
        value = pluralValue;
      }
    }

    return interpolate(value, params);
  }, [translations, fallbackTranslations, lang]);

  const setLang = (code) => {
    if (LANGUAGES.some(l => l.code === code)) {
      setLangState(code);
    }
  };

  const toggleLang = () => {
    const idx = LANGUAGES.findIndex(l => l.code === lang);
    setLangState(LANGUAGES[(idx + 1) % LANGUAGES.length].code);
  };

  const currentLangDef = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  const dir = currentLangDef.dir;

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, toggleLang, dir, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const ADMIN_LABEL_KEYS = {
  Dashboard: 'navbar.dashboard',
  Bookings: 'navbar.bookings',
  Schedule: 'navbar.schedule',
  Staff: 'navbar.staff',
  Subscriptions: 'navbar.subscriptions',
  Reports: 'navbar.reports',
  Settings: 'common.settings',
};