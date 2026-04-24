const SITE_CONTENT_STORAGE_KEY = 'siteContentOverrides';

export const defaultSiteContent = {
  bookingPageConfig: {
  // Minimum advance notice for same-day bookings is backend-driven via GET /Settings (booking.defaultBufferMinutes).
    // Do NOT add sameDayBufferMinutes here — it must never be a static fallback.
    earliestBookingOffsetDays: 0,
    timeSlots: [
      '09:00-10:00',
      '10:00-11:00',
      '11:00-12:00',
      '12:00-13:00',
      '14:00-15:00',
      '15:00-16:00',
      '16:00-17:00',
      '17:00-18:00',
    ],
  },
  homePageContent: {
  badge: 'Mobile Detailing · Qatar',
  title: 'Precision Detailing, Delivered to You',
  description:
    'We bring showroom-quality detailing to your driveway. Precision tools, premium products, and concierge scheduling — for car owners who expect more.',
  primaryCta: 'Book Your Detail',
  secondaryCta: 'Explore Services',
  features: [
    {
      key: 'signature',
      title: 'Signature Finish',
      description: 'Every panel, every edge — treated with the same care as a show car.',
      icon: 'Star',
      iconBgClass: 'bg-primary/15',
      iconColorClass: 'text-primary',
    },
    {
      key: 'protection',
      title: 'Paint Protection',
      description: 'Ceramic and correction systems calibrated for your specific finish and climate.',
      icon: 'Shield',
      iconBgClass: 'bg-secondary/20',
      iconColorClass: 'text-secondary',
    },
    {
      key: 'timing',
      title: 'Precision Timing',
      description: 'Fixed appointment windows, on-time arrivals, and real-time job updates.',
      icon: 'Clock',
      iconBgClass: 'bg-white/10',
      iconColorClass: 'text-primary',
    },
    {
      key: 'team',
      title: 'Elite Team',
      description: 'Specialists trained in UK-developed techniques and professional-grade product systems.',
      icon: 'Award',
      iconBgClass: 'bg-primary/15',
      iconColorClass: 'text-primary',
    },
  ],
  curatedTitle: 'Every Detail, Covered.',
  curatedDescription:
    'From express maintenance washes to machine polishing and full ceramic protection — every package is engineered for real-world ownership in Qatar.',
  curatedCta: 'Explore All Services',
  finalTitle: 'Your Car Deserves Better.',
  finalDescription: 'Book today and experience what precision mobile detailing actually looks like.',
  finalCta: 'Book Now',
  },

  packagesPageContent: {
    title: 'Our Packages',
    subtitle: 'Professional detailing packages tailored to your needs',
    allTierLabel: 'All',
    emptyTierMessage: 'No packages found in this tier',
    includesLabel: 'Includes:',
    fromOnlyLabel: 'From only:',
    moreServicesText: 'more services',
  },
};

const mergeContent = (defaults, overrides) => {
  return {
    ...defaults,
    ...overrides,
    bookingPageConfig: {
      ...defaults.bookingPageConfig,
      ...overrides?.bookingPageConfig,
    },
    homePageContent: {
      ...defaults.homePageContent,
      ...overrides?.homePageContent,
      features: overrides?.homePageContent?.features || defaults.homePageContent.features,
    },
    packagesPageContent: {
      ...defaults.packagesPageContent,
      ...overrides?.packagesPageContent,
    },
  };
};

export const getSiteContent = () => {
  try {
    const raw = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!raw) {
      return defaultSiteContent;
    }

    const parsed = JSON.parse(raw);
    return mergeContent(defaultSiteContent, parsed);
  } catch {
    return defaultSiteContent;
  }
};

export const saveSiteContent = (content) => {
  const merged = mergeContent(defaultSiteContent, content);
  localStorage.setItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(merged));
  return merged;
};

export const resetSiteContent = () => {
  localStorage.removeItem(SITE_CONTENT_STORAGE_KEY);
  return defaultSiteContent;
};
