import React, { createContext, useContext, useEffect, useState } from 'react';
import { organizationsAPI } from '../api/organizations';
import { useAuth } from './AuthContext';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState(null);
  const [org, setOrg] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (user?.role !== 'Admin') {
      setIsLoaded(true);
      return;
    }

    let cancelled = false;
    Promise.all([
      organizationsAPI.getMe().catch(() => null),
      organizationsAPI.getBranding().catch(() => null),
      organizationsAPI.getOnboarding().catch(() => null),
    ]).then(([orgData, brandingData, onboardingData]) => {
      if (cancelled) return;
      setOrg(orgData);
      setBranding(brandingData);
      setOnboarding(onboardingData);
      if (brandingData) applyBrandColors(brandingData);
      setIsLoaded(true);
    });

    return () => { cancelled = true; };
  }, [user]);

  const refreshOnboarding = async () => {
    try {
      const data = await organizationsAPI.getOnboarding();
      setOnboarding(data);
    } catch {}
  };

  const updateBranding = async (data) => {
    const updated = await organizationsAPI.updateBranding(data);
    setBranding(updated);
    applyBrandColors(updated);
    return updated;
  };

  return (
    <TenantContext.Provider value={{ org, branding, onboarding, isLoaded, refreshOnboarding, updateBranding }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

function applyBrandColors(branding) {
  if (!branding) return;
  const root = document.documentElement;
  if (branding.primaryColor) root.style.setProperty('--brand-primary', branding.primaryColor);
  if (branding.secondaryColor) root.style.setProperty('--brand-secondary', branding.secondaryColor);
}
