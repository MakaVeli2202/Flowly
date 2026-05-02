import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { packagesAPI } from '../api/packages';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PackagesContext = createContext(null);

export function PackagesProvider({ children }) {
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState('');
  const packagesByLangRef = useRef({});
  const lastFetchByLangRef = useRef({});
  const inFlightByLangRef = useRef({});
  const currentLangRef = useRef(localStorage.getItem('lang') || navigator.language?.split('-')[0] || 'en');

  const fetchPackages = useCallback(async (langCode, force = false) => {
    const lang = langCode || currentLangRef.current || localStorage.getItem('lang') || 'en';
    currentLangRef.current = lang;

    const now = Date.now();
    const cached = packagesByLangRef.current[lang];
    const lastFetch = lastFetchByLangRef.current[lang] || 0;

    if (!force && Array.isArray(cached) && now - lastFetch < CACHE_TTL) {
      setPackages(cached);
      setPackagesLoading(false);
      return cached;
    }
    if (inFlightByLangRef.current[lang]) return inFlightByLangRef.current[lang];

    const request = (async () => {
      setPackagesLoading(true);
      setPackagesError('');
      try {
        const data = await packagesAPI.getAll(lang);
        const safeData = Array.isArray(data) ? data : [];
        packagesByLangRef.current[lang] = safeData;
        lastFetchByLangRef.current[lang] = Date.now();
        if (currentLangRef.current === lang) {
          setPackages(safeData);
        }
        return safeData;
      } catch (err) {
        if (currentLangRef.current === lang) {
          setPackagesError(err?.response?.data?.message || 'Failed to load packages.');
        }
        return [];
      } finally {
        if (currentLangRef.current === lang) {
          setPackagesLoading(false);
        }
        delete inFlightByLangRef.current[lang];
      }
    })();

    inFlightByLangRef.current[lang] = request;
    return request;
  }, []);

  useEffect(() => {
    const onLanguageChanged = (event) => {
      const nextLang = event?.detail?.lang || localStorage.getItem('lang') || 'en';
      currentLangRef.current = nextLang;
      fetchPackages(nextLang);
    };

    window.addEventListener('app-language-changed', onLanguageChanged);
    fetchPackages(currentLangRef.current);

    return () => window.removeEventListener('app-language-changed', onLanguageChanged);
  }, [fetchPackages]);

  return (
    <PackagesContext.Provider value={{ packages, packagesLoading, packagesError, fetchPackages }}>
      {children}
    </PackagesContext.Provider>
  );
}

export function usePackages() {
  const ctx = useContext(PackagesContext);
  if (!ctx) throw new Error('usePackages must be used within PackagesProvider');
  return ctx;
}
