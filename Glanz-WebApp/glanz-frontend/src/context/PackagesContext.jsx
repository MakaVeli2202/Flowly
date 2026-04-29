import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { packagesAPI } from '../api/packages';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PackagesContext = createContext(null);

export function PackagesProvider({ children }) {
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState('');
  const lastFetchRef = useRef(0);
  const packagesCountRef = useRef(0);
  const inFlightRef = useRef(null);
  const packagesRef = useRef(packages);
  packagesRef.current = packages; // keep ref in sync

  const fetchPackages = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && packagesCountRef.current > 0 && now - lastFetchRef.current < CACHE_TTL) {
      return packagesRef.current;
    }
    if (inFlightRef.current) return inFlightRef.current;

    const request = (async () => {
      setPackagesLoading(true);
      setPackagesError('');
      try {
        const data = await packagesAPI.getAll();
        const safeData = Array.isArray(data) ? data : [];
        setPackages(safeData);
        packagesRef.current = safeData;
        packagesCountRef.current = safeData.length;
        lastFetchRef.current = Date.now();
        return safeData;
      } catch (err) {
        setPackagesError(err?.response?.data?.message || 'Failed to load packages.');
        return [];
      } finally {
        setPackagesLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, []);

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
