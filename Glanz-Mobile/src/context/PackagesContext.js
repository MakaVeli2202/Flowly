import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { packagesAPI } from '../api/packages';
import i18n from '../i18n/i18n';

const PackagesContext = createContext(null);

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function usePackages() {
  const ctx = useContext(PackagesContext);
  if (!ctx) throw new Error('usePackages must be used within PackagesProvider');
  return ctx;
}

export function PackagesProvider({ children }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const packagesByLangRef = useRef({});
  const lastFetchByLangRef = useRef({});
  const inFlightByLangRef = useRef({});
  const currentLangRef = useRef((i18n.language || 'en').split('-')[0].toLowerCase());

  const fetchPackages = useCallback(async (langOrForce = false, forceMaybe = false) => {
    const lang = typeof langOrForce === 'string'
      ? langOrForce.split('-')[0].toLowerCase()
      : currentLangRef.current;
    const force = typeof langOrForce === 'boolean' ? langOrForce : forceMaybe;

    currentLangRef.current = lang;
    const now = Date.now();
    const cached = packagesByLangRef.current[lang] || [];
    const lastFetch = lastFetchByLangRef.current[lang] || 0;

    if (!force && cached.length > 0 && now - lastFetch < CACHE_TTL) {
      setPackages(cached);
      return cached;
    }

    if (inFlightByLangRef.current[lang]) {
      return inFlightByLangRef.current[lang];
    }

    const request = (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await packagesAPI.getAll(lang);
        const result = data || [];
        packagesByLangRef.current[lang] = result;
        lastFetchByLangRef.current[lang] = Date.now();
        if (currentLangRef.current === lang) {
          setPackages(result);
        }
        return result;
      } catch {
        if (currentLangRef.current === lang) {
          setError('Failed to load packages');
        }
        return packagesByLangRef.current[lang] || [];
      } finally {
        setLoading(false);
        delete inFlightByLangRef.current[lang];
      }
    })();

    inFlightByLangRef.current[lang] = request;
    return request;
  }, []); // stable — no state deps, uses refs

  useEffect(() => {
    const onLanguageChanged = (lng) => {
      const normalized = (lng || 'en').split('-')[0].toLowerCase();
      currentLangRef.current = normalized;
      fetchPackages(normalized);
    };

    i18n.on('languageChanged', onLanguageChanged);
    fetchPackages(currentLangRef.current);

    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, [fetchPackages]);

  const value = useMemo(() => ({
    packages,
    packagesLoading: loading,
    packagesError: error,
    fetchPackages,
  }), [packages, loading, error, fetchPackages]);

  return <PackagesContext.Provider value={value}>{children}</PackagesContext.Provider>;
}
