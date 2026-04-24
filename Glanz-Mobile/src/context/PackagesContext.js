import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { packagesAPI } from '../api/packages';

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
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(null);
  const packagesRef = useRef([]); // mirror of packages state for stable closure access

  const fetchPackages = useCallback(async (force = false) => {
    const now = Date.now();
    const cached = packagesRef.current;

    if (!force && cached.length > 0 && now - lastFetchRef.current < CACHE_TTL) {
      return cached;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const request = (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await packagesAPI.getAll();
        const result = data || [];
        packagesRef.current = result;
        setPackages(result);
        lastFetchRef.current = Date.now();
        return result;
      } catch {
        setError('Failed to load packages');
        return packagesRef.current;
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, []); // stable — no state deps, uses refs

  const value = useMemo(() => ({
    packages,
    packagesLoading: loading,
    packagesError: error,
    fetchPackages,
  }), [packages, loading, error, fetchPackages]);

  return <PackagesContext.Provider value={value}>{children}</PackagesContext.Provider>;
}
