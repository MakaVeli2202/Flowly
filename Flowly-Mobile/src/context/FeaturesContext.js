/**
 * FeaturesContext — global feature flag system.
 *
 * Flags are loaded once at startup from GET /Config/features.
 * If the endpoint doesn't exist yet (404/network error) the defaults
 * kick in and the app works exactly as before — safe for active dev.
 *
 * To toggle a flag without a code deploy:
 *   Backend:  UPDATE AppSettings SET value='true' WHERE key='feature.payments';
 *   Restart the app (or pull-to-refresh on any screen that triggers reload).
 *
 * Rule: only check flags in TWO places —
 *   1. This context (defining them)
 *   2. The single component that owns the relevant UI element
 *
 * Never scatter `if (feature.X)` deep inside shared utilities.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/axios';

// ── Default state — all features OFF ────────────────────────────────────────
// This is the safe baseline. Everything that existed before still works.
const DEFAULT_FLAGS = {
  payments:          false,  // Stripe real payment flow (Phase 2)
  subscriptions:     false,  // Customer-facing subscription plans (Phase 1D → backend needed)
  loyalty:           false,  // Loyalty tiers + redemption (Phase 3)
  favoriteDetailer:  false,  // Favorite detailer preference (Phase 3)
  slotReservation:   false,  // 10-min slot hold countdown (Phase 3)
  smartAssignment:   false,  // Automatic worker assignment (Phase 3)
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
          // Merge — only override known flags, ignore unknown keys from backend
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
        // Endpoint doesn't exist yet — that's fine, use defaults
        // All features stay OFF, app behaviour is unchanged
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
