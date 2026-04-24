/**
 * SettingsContext — system configuration loaded from the backend at startup.
 *
 * Exposes business-rule constants that must never be hardcoded in screens:
 *   - vehicleMultipliers:       price multipliers per vehicle type
 *   - defaultBufferMinutes:     same-day booking minimum customer lead time
 *   - workerTravelBufferMinutes: gap between consecutive worker bookings (travel/prep)
 *
 * Falls back to safe defaults if GET /Settings is unavailable or returns an
 * old response shape — backward-compatible during the backend migration.
 *
 * Default values mirror the previously hardcoded constants so behaviour is
 * unchanged until the backend starts returning the new fields.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsAPI } from '../api/settings';

export const DEFAULT_SETTINGS = {
  vehicleMultipliers:        { Motorcycle: 0.8, Sedan: 1.0, SUV: 1.25, Pickup: 1.5 },
  defaultBufferMinutes:      90,
  workerTravelBufferMinutes: 30,
};

const SettingsContext = createContext(DEFAULT_SETTINGS);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    settingsAPI.getSystemSettings()
      .then((data) => {
        if (cancelled || !data || typeof data !== 'object') return;
        setSettings((prev) => ({
          // New shape: { pricing: { vehicleMultipliers: {...} }, booking: { defaultBufferMinutes: N, workerTravelBufferMinutes: N } }
          // Old shape: { defaultBufferMinutes: N }   ← legacy flat response, still supported
          vehicleMultipliers: (
            data.pricing?.vehicleMultipliers &&
            typeof data.pricing.vehicleMultipliers === 'object'
          )
            ? { ...DEFAULT_SETTINGS.vehicleMultipliers, ...data.pricing.vehicleMultipliers }
            : prev.vehicleMultipliers,

          defaultBufferMinutes: Number.isFinite(data.booking?.defaultBufferMinutes)
            ? data.booking.defaultBufferMinutes
            : Number.isFinite(data.defaultBufferMinutes)
              ? data.defaultBufferMinutes // legacy flat shape
              : prev.defaultBufferMinutes,

          workerTravelBufferMinutes: Number.isFinite(data.booking?.workerTravelBufferMinutes)
            ? data.booking.workerTravelBufferMinutes
            : prev.workerTravelBufferMinutes,
        }));
      })
      .catch(() => {
        // Endpoint unavailable or old shape — keep defaults. No-op.
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
