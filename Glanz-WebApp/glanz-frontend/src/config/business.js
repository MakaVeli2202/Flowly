/**
 * Central source of truth for business identity.
 * Change these values to rebrand across the entire app.
 * Use getBusiness() for live/admin-editable values.
 * Use saveBusiness() in Admin Settings to persist overrides.
 */
export const BUSINESS = {
  /** Full brand name — used in copyright lines, page titles, etc. */
  name: 'Glanz',
  /** Logo URL - used in navbar, footer, payslip, emails, etc. */
  logo: '',
  /** First part of the logo word-mark (unstyled) */
  namePrefix: 'G',
  /** Second part of the logo word-mark (receives gradient / accent colour) */
  nameSuffix: 'lanz',
  tagline: 'Professional car detailing services in Qatar. Quality you can trust.',
  phone: '+974 4444 4444',
  email: 'info@Glanz.qa',
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

/** Returns BUSINESS defaults merged with any admin-saved overrides from localStorage. */
export function getBusiness() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...BUSINESS, ...JSON.parse(stored) };
    }
  } catch { /* ignore corrupt storage */ }
  return { ...BUSINESS };
}

/**
 * Persists partial overrides (name, logo, phone, email, location, tagline) to localStorage.
 * Fires a custom event so components can reactively update.
 */
export function saveBusiness(updates) {
  try {
    const current = getBusiness();
    const merged = { ...current, ...updates };
    // Only persist the overridable fields
    const { name, logo, namePrefix, nameSuffix, tagline, phone, email, location, serviceAreas, socialLinks } = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, logo, namePrefix, nameSuffix, tagline, phone, email, location, serviceAreas, socialLinks }));
    window.dispatchEvent(new CustomEvent('businessConfigChanged', { detail: merged }));
    return merged;
  } catch {
    return getBusiness();
  }
}
