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

const localizedSiteContent = {
  ar: {
    homePageContent: {
      badge: 'غسيل وتلميع متنقل · قطر',
      title: 'تلميع دقيق يصل إلى باب منزلك',
      description:
        'نقدم عناية احترافية بسيارتك أمام منزلك مباشرة. أدوات دقيقة، منتجات عالية الجودة، ومواعيد مرنة تناسب يومك.',
      primaryCta: 'احجز خدمتك الآن',
      secondaryCta: 'استعرض الخدمات',
      curatedTitle: 'كل التفاصيل مغطاة.',
      curatedDescription:
        'من الغسيل السريع إلى التلميع والحماية الكاملة، كل باقة مصممة لتناسب الاستخدام اليومي في قطر.',
      curatedCta: 'استعرض كل الخدمات',
      finalTitle: 'سيارتك تستحق الأفضل.',
      finalDescription: 'احجز اليوم وشاهد الفرق الحقيقي في العناية المتنقلة الدقيقة.',
      finalCta: 'احجز الآن',
      features: [
        {
          key: 'signature',
          title: 'لمسة نهائية مميزة',
          description: 'كل جزء من السيارة يُعالج بعناية احترافية عالية.',
        },
        {
          key: 'protection',
          title: 'حماية الطلاء',
          description: 'أنظمة حماية وتلميع مناسبة لنوع الطلاء ومناخ قطر.',
        },
        {
          key: 'timing',
          title: 'مواعيد دقيقة',
          description: 'مواعيد واضحة، وصول في الوقت، وتحديثات لحظية.',
        },
        {
          key: 'team',
          title: 'فريق متخصص',
          description: 'فنيون مدربون على تقنيات احترافية ومنتجات عالية الجودة.',
        },
      ],
    },
    packagesPageContent: {
      title: 'باقاتنا',
      subtitle: 'باقات تلميع احترافية تناسب احتياجك',
      allTierLabel: 'الكل',
      emptyTierMessage: 'لا توجد باقات في هذه الفئة',
      includesLabel: 'تشمل:',
      fromOnlyLabel: 'ابتداءً من:',
      moreServicesText: 'خدمات إضافية',
    },
  },
  de: {
    homePageContent: {
      badge: 'Mobiles Detailing · Katar',
      title: 'Praezises Detailing bei Ihnen vor Ort',
      description:
        'Wir bringen professionelle Fahrzeugpflege direkt zu Ihnen. Hochwertige Produkte, praezise Arbeit und flexible Termine.',
      primaryCta: 'Jetzt Buchen',
      secondaryCta: 'Services Entdecken',
      curatedTitle: 'Jedes Detail abgedeckt.',
      curatedDescription:
        'Von der Express-Reinigung bis zur Komplettpflege: jedes Paket ist fuer den Alltag in Katar ausgelegt.',
      curatedCta: 'Alle Services ansehen',
      finalTitle: 'Ihr Auto verdient mehr.',
      finalDescription: 'Buchen Sie heute und erleben Sie den Unterschied professioneller mobiler Pflege.',
      finalCta: 'Jetzt buchen',
      features: [
        {
          key: 'signature',
          title: 'Premium Finish',
          description: 'Jede Flaeche wird mit hoechster Sorgfalt behandelt.',
        },
        {
          key: 'protection',
          title: 'Lackschutz',
          description: 'Schutz- und Korrektursysteme passend zu Lack und Klima.',
        },
        {
          key: 'timing',
          title: 'Praezise Zeitfenster',
          description: 'Verlaessliche Termine, puenktliche Ankunft und Live-Updates.',
        },
        {
          key: 'team',
          title: 'Experten-Team',
          description: 'Geschulte Spezialisten mit professionellen Techniken.',
        },
      ],
    },
    packagesPageContent: {
      title: 'Unsere Pakete',
      subtitle: 'Professionelle Detailing-Pakete fuer Ihre Anforderungen',
      allTierLabel: 'Alle',
      emptyTierMessage: 'Keine Pakete in dieser Kategorie',
      includesLabel: 'Enthaelt:',
      fromOnlyLabel: 'Ab:',
      moreServicesText: 'weitere Services',
    },
  },
};

const resolveLocalizedValue = (value, lang) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const languageKeys = ['en', 'ar', 'de'];
  const keys = Object.keys(value);
  const isLanguageMap = keys.some((k) => languageKeys.includes(k));

  if (!isLanguageMap) {
    return value;
  }

  return value[lang] ?? value.en ?? value.ar ?? value.de ?? '';
};

const resolveNestedLocalizedValues = (input, lang) => {
  if (Array.isArray(input)) {
    return input.map((item) => resolveNestedLocalizedValues(item, lang));
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  const localizedLeaf = resolveLocalizedValue(input, lang);
  if (localizedLeaf !== input) {
    return localizedLeaf;
  }

  const result = {};
  Object.entries(input).forEach(([key, value]) => {
    result[key] = resolveNestedLocalizedValues(value, lang);
  });
  return result;
};

const mergeFeaturesByKey = (baseFeatures = [], overrideFeatures = []) => {
  if (!Array.isArray(overrideFeatures) || overrideFeatures.length === 0) {
    return baseFeatures;
  }

  const baseByKey = new Map(
    (Array.isArray(baseFeatures) ? baseFeatures : [])
      .filter((item) => item && item.key)
      .map((item) => [item.key, item])
  );

  return overrideFeatures.map((item, index) => {
    const fallback = (item?.key && baseByKey.get(item.key)) || baseFeatures[index] || {};
    return {
      ...fallback,
      ...item,
    };
  });
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
      features: mergeFeaturesByKey(
        defaults.homePageContent.features,
        overrides?.homePageContent?.features
      ),
    },
    packagesPageContent: {
      ...defaults.packagesPageContent,
      ...overrides?.packagesPageContent,
    },
  };
};

export const getSiteContent = (lang = 'en') => {
  try {
    const raw = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    const localizedDefaults = mergeContent(defaultSiteContent, localizedSiteContent[lang] || {});
    if (!raw) return localizedDefaults;

    const parsed = JSON.parse(raw);
    const merged = mergeContent(localizedDefaults, parsed);
    return resolveNestedLocalizedValues(merged, lang);
  } catch {
    return mergeContent(defaultSiteContent, localizedSiteContent[lang] || {});
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
