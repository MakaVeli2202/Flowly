/**
 * Central source of truth for business identity.
 * Change these values to rebrand across the entire app.
 * Use getBusiness() for live/admin-editable values.
 * Use saveBusiness() in Admin Settings to persist overrides.
 */
export const BUSINESS = {
  /** Full brand name — used in copyright lines, page titles, etc. */
  name: 'Flowly',
  /** Logo URL - used in navbar, footer, payslip, emails, etc. */
  logo: '',
  /** First part of the logo word-mark (unstyled) */
  namePrefix: 'Fl',
  /** Second part of the logo word-mark (receives gradient / accent colour) */
  nameSuffix: 'owly',
  tagline: '',
  phone: '+974 4444 4444',
  email: 'info@flowly.qa',
  location: 'Doha, Qatar',
  serviceAreas: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Lusail', 'Al Khor', 'Dukhan', 'Al Shahaniya'],
  socialLinks: {
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
  },
};

const STORAGE_KEY = 'businessConfig';
const LEGACY_DEFAULT_TAGLINE = 'Professional car detailing services in Qatar. Quality you can trust.';

function normalizeBusinessConfig(config) {
  if (!config || typeof config !== 'object') return { ...BUSINESS };

  return {
    ...config,
    tagline: config.tagline === LEGACY_DEFAULT_TAGLINE ? '' : (config.tagline || ''),
  };
}

/** Returns BUSINESS defaults merged with any admin-saved overrides from localStorage. */
export function getBusiness() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...BUSINESS, ...normalizeBusinessConfig(JSON.parse(stored)) };
    }
  } catch { /* ignore corrupt storage */ }
  return { ...BUSINESS };
}

/** Returns the logo URL with fallback to default project logo. */
export function getLogoUrl() {
  const business = getBusiness();
  // If admin has set a logo URL, use it; otherwise fall back to project default
  return business.logo && business.logo.trim() !== '' ? business.logo : '/GlanzLogo.png';
}

/**
 * Persists partial overrides (name, logo, phone, email, location, tagline) to localStorage.
 * Fires a custom event so components can reactively update.
 */
export function saveBusiness(updates) {
  try {
    const current = getBusiness();
    const merged = normalizeBusinessConfig({ ...current, ...updates });
    // Only persist the overridable fields
    const { name, logo, namePrefix, nameSuffix, tagline, phone, email, location, serviceAreas, socialLinks } = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, logo, namePrefix, nameSuffix, tagline, phone, email, location, serviceAreas, socialLinks }));
    window.dispatchEvent(new CustomEvent('businessConfigChanged', { detail: merged }));
    return merged;
  } catch {
    return getBusiness();
  }
}
