import { useEffect } from 'react';
import { publicAPI } from '../api/public';

// Detects the org slug from the hostname (e.g. acme.flowly.io -> "acme",
// or a custom domain via the ?__org= query param for local testing).
function detectSlug() {
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('__org')) return searchParams.get('__org');
  // subdomain pattern: <slug>.flowly.io
  const match = hostname.match(/^([a-z0-9-]+)\.flowly\.(io|qa)$/);
  if (match) return match[1];
  return null;
}

function applyBranding(data) {
  if (!data) return;
  const root = document.documentElement;
  Object.entries(data.cssVars || {}).forEach(([k, v]) => root.style.setProperty(k, v));
  if (data.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = data.faviconUrl;
  }
  if (data.whiteLabelEnabled && data.orgName) {
    document.title = data.orgName;
  }
}

export function useTenantBranding() {
  useEffect(() => {
    const slug = detectSlug();
    if (!slug) return;
    publicAPI.getBranding(slug).then(applyBranding).catch(() => {});
  }, []);
}
