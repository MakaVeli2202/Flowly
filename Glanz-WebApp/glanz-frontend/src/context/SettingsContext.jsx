/**
 * SettingsContext â€” system configuration loaded from the backend at startup.
 *
 * Exposes business-rule constants that must never be hardcoded in pages:
 *   - vehicleMultipliers: price multipliers per vehicle type
 *   - defaultBufferMinutes: same-day booking minimum lead time
 *
 * Falls back to safe defaults if GET /Settings is unavailable â€” backward-
 * compatible during the backend migration period.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsAPI } from '../api/settings';

export const DEFAULT_SETTINGS = {
  vehicleMultipliers:      { Motorcycle: 0.8, Sedan: 1.0, SUV: 1.25, Pickup: 1.5 },
  defaultBufferMinutes:    90, // customer same-day lead time
  workerTravelBufferMinutes: 30, // gap between worker jobs
  sitePublished: false,
  siteLaunchDate: new Date('2026-06-01T00:00:00Z').toISOString(),
};

const CACHE_KEY = 'flowly.settings.v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(s) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch {}
}

function mergeData(data, prev) {
  return {
    vehicleMultipliers: (
      data.pricing?.vehicleMultipliers &&
      typeof data.pricing.vehicleMultipliers === 'object'
    )
      ? { ...DEFAULT_SETTINGS.vehicleMultipliers, ...data.pricing.vehicleMultipliers }
      : prev.vehicleMultipliers,

    defaultBufferMinutes: Number.isFinite(data.booking?.defaultBufferMinutes)
      ? data.booking.defaultBufferMinutes
      : prev.defaultBufferMinutes,

    workerTravelBufferMinutes: Number.isFinite(data.booking?.workerTravelBufferMinutes)
      ? data.booking.workerTravelBufferMinutes
      : prev.workerTravelBufferMinutes,

    sitePublished: typeof data.site?.published === 'boolean'
      ? data.site.published
      : prev.sitePublished,

    siteLaunchDate: typeof data.site?.launchDate === 'string' && data.site.launchDate
      ? data.site.launchDate
      : prev.siteLaunchDate,
  };
}

const SettingsContext = createContext(DEFAULT_SETTINGS);

export function SettingsProvider({ children }) {
  const cached = readCache();
  const [settings, setSettings] = useState(cached ?? DEFAULT_SETTINGS);
  // If we have a cached value, treat as already loaded â€” no blocking spinner.
  const [isLoaded, setIsLoaded] = useState(!!cached);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = () => {
      settingsAPI.getSystemSettings()
        .then((data) => {
          if (cancelled || !data || typeof data !== 'object') return;
          setSettings((prev) => {
            const next = mergeData(data, prev);
            writeCache(next);
            return next;
          });
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsLoaded(true);
        });
    };

    loadSettings();
    window.addEventListener('system-settings-changed', loadSettings);
    return () => {
      cancelled = true;
      window.removeEventListener('system-settings-changed', loadSettings);
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
