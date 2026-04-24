/**
 * FeaturesContext — global runtime feature flag system.
 *
 * Flags are loaded once at startup from GET /Config/features.
 * If the endpoint is unavailable (404/network error) the safe defaults
 * remain — the app continues working exactly as before.
 *
 * Architecture rule (identical to mobile):
 *   - Only check flags in TWO places:
 *     1. This context  (defining them)
 *     2. The single component that owns the relevant UI element
 *   - Never scatter `if (features.X)` inside shared utilities or api files.
 *
 * To toggle a flag without a frontend re-deploy:
 *   Backend:  UPDATE AppSettings SET value='true' WHERE key='feature.payments';
 *   Effect takes place on next app load (no rebuild needed).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/axios';

// ── Default flags — all OFF (safe baseline) ──────────────────────────────────
const DEFAULT_FLAGS = {
  payments:         false,  // Stripe real payment flow
  subscriptions:    false,  // Customer-facing subscription plans
  slotReservation:  false,  // 15-min slot hold (Phase 3 slot system)
  smartAssignment:  false,  // Automatic worker assignment
  loyalty:          false,  // Loyalty tiers + redemption
  favoriteDetailer: false,  // Favourite detailer preference
};

const FeaturesContext = createContext(DEFAULT_FLAGS);

export function FeaturesProvider({ children }) {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/Config/features')
      .then((res) => {
        if (!cancelled && res?.data && typeof res.data === 'object') {
          const merged = { ...DEFAULT_FLAGS };
          Object.keys(DEFAULT_FLAGS).forEach((key) => {
            if (key in res.data) {
              // Accept both boolean true and string "true"
              merged[key] = res.data[key] === true || res.data[key] === 'true';
            }
          });
          setFlags(merged);
        }
      })
      .catch(() => {
        // Endpoint unavailable — keep defaults, app is fully functional
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <FeaturesContext.Provider value={flags}>
      {children}
    </FeaturesContext.Provider>
  );
}

/** Use inside any component to read feature flags. */
export function useFeatures() {
  return useContext(FeaturesContext);
}
