import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, Sparkles, Award, Shield, Star, Check, ChevronDown } from 'lucide-react';
import { formatQAR } from '../../utils/currency';
import { getSiteContent } from '../../config/siteContent';
import { useAuth } from '../../context/AuthContext';
import { usePackages } from '../../context/PackagesContext';
import { useLanguage } from '../../context/LanguageContext';
import SEO from '../../components/shared/SEO';
import { Skeleton, CardSkeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';

const tierConfig = {
  Standard: {
    Icon: Sparkles,
    accentClass: 'tier-accent-standard',
    badgeClass: 'bg-secondary/15 text-secondary border-secondary/30',
  },
  Gold: {
    Icon: Award,
    accentClass: 'tier-accent-gold',
    badgeClass: 'bg-primary/15 text-primary border-primary/30',
  },
  Platinum: {
    Icon: Shield,
    accentClass: 'tier-accent-platinum',
    badgeClass: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
  },
  Premium: {
    Icon: Star,
    accentClass: 'tier-accent-premium',
    badgeClass: 'bg-purple-400/15 text-purple-300 border-purple-400/30',
  },
};

const ALL_TIER_KEY = '__all__';

const normalizeLangCode = (lang) => (lang || 'en').toLowerCase().split('-')[0];

const pickLocalizedField = (item, baseKey, lang) => {
  if (!item || typeof item !== 'object') return '';

  const langCode = normalizeLangCode(lang);
  const suffix = langCode.charAt(0).toUpperCase() + langCode.slice(1);
  const candidates = [
    `${baseKey}${suffix}`,
    `${baseKey}_${langCode}`,
    `${baseKey}${langCode.toUpperCase()}`,
    `${baseKey}Localized`,
  ];

  for (const key of candidates) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const raw = item[baseKey];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw[langCode] ?? raw.en;
    if (typeof value === 'string' && value.trim()) return value;
  }

  const translations = item.translations || item.translation || item.localizations;
  if (Array.isArray(translations)) {
    const row = translations.find((t) => normalizeLangCode(t?.language || t?.lang || t?.code) === langCode)
      || translations.find((t) => normalizeLangCode(t?.language || t?.lang || t?.code) === 'en');
    if (row) {
      const fromRow = row[baseKey] || row[baseKey.toLowerCase()] || row.value || row.text;
      if (typeof fromRow === 'string' && fromRow.trim()) return fromRow;
    }
  }

  return typeof raw === 'string' ? raw : '';
};

/* ── Service expandable component ──────────────────────────── */
function ServicesList({ services = [], maxVisible = 4, isExpanded, onToggle, labels, lang }) {
  if (!services || services.length === 0) {
    return (
      <div className="mb-6 flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-color)] mb-3 font-semibold">
          {labels.servicesIncluded}
        </p>
        <p className="text-sm text-[var(--muted-color)]">{labels.noServicesListed}</p>
      </div>
    );
  }

  const hasMore = services.length > maxVisible;
  const visibleServices = isExpanded ? services : services.slice(0, maxVisible);

  return (
    <div className="mb-6 flex-1">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-color)] mb-3 font-semibold">
        {labels.servicesIncluded}
      </p>
      <div className="space-y-1.5 max-h-[500px] overflow-hidden transition-all duration-300">
        {visibleServices.map((service, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-[var(--text-color)]"
          >
            <Check size={14} className="text-secondary mt-0.5 flex-shrink-0" />
            <span>{
              pickLocalizedField(service, 'serviceName', lang)
              || pickLocalizedField(service, 'name', lang)
              || service?.serviceName
              || service?.name
              || labels.serviceFallback
            }</span>
          </li>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={onToggle}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
          {isExpanded ? labels.showLess : `+ ${services.length - maxVisible} ${labels.more}`}
        </button>
      )}
    </div>
  );
}

function Packages() {
  const { lang } = useLanguage();
  const { packagesPageContent } = getSiteContent(lang);
  const { isAdmin } = useAuth();
  const { packages = [], packagesLoading: loading, packagesError: error, fetchPackages } = usePackages();
  const navigate = useNavigate();

  const [selectedTier, setSelectedTier] = useState(ALL_TIER_KEY);
  const [expandedPackageId, setExpandedPackageId] = useState(null);

  const labelsByLang = {
    en: {
      servicesIncluded: 'Services Included',
      noServicesListed: 'No services listed',
      serviceFallback: 'Service',
      showLess: 'Show Less',
      more: 'More',
      failedToLoadPackages: 'Failed to load packages',
      tryAgain: 'Try Again',
      noPackagesAvailable: 'No packages available',
      checkBackSoon: 'Check back soon for our detailing packages.',
      premiumAutoCare: 'Premium Auto Care',
      noPackagesForTier: 'No packages found for',
      tierSuffix: 'tier',
      minutesShort: 'min',
      startingAt: 'Starting at',
      createCustomerBooking: 'Create Customer Booking',
      bookNow: 'Book Now',
    },
    ar: {
      servicesIncluded: 'الخدمات المشمولة',
      noServicesListed: 'لا توجد خدمات مدرجة',
      serviceFallback: 'خدمة',
      showLess: 'عرض أقل',
      more: 'المزيد',
      failedToLoadPackages: 'فشل تحميل الباقات',
      tryAgain: 'حاول مرة أخرى',
      noPackagesAvailable: 'لا توجد باقات متاحة',
      checkBackSoon: 'تحقق لاحقاً للاطلاع على باقاتنا.',
      premiumAutoCare: 'عناية سيارات فاخرة',
      noPackagesForTier: 'لا توجد باقات في الفئة',
      tierSuffix: '',
      minutesShort: 'دقيقة',
      startingAt: 'ابتداءً من',
      createCustomerBooking: 'إنشاء حجز للعميل',
      bookNow: 'احجز الآن',
    },
    de: {
      servicesIncluded: 'Enthaltene Services',
      noServicesListed: 'Keine Services aufgefuehrt',
      serviceFallback: 'Service',
      showLess: 'Weniger anzeigen',
      more: 'mehr',
      failedToLoadPackages: 'Pakete konnten nicht geladen werden',
      tryAgain: 'Erneut versuchen',
      noPackagesAvailable: 'Keine Pakete verfuegbar',
      checkBackSoon: 'Schauen Sie bald wieder vorbei fuer neue Pakete.',
      premiumAutoCare: 'Premium Fahrzeugpflege',
      noPackagesForTier: 'Keine Pakete in der Kategorie',
      tierSuffix: '',
      minutesShort: 'Min',
      startingAt: 'Ab',
      createCustomerBooking: 'Kundenbuchung erstellen',
      bookNow: 'Jetzt buchen',
    },
  };

  const ui = labelsByLang[lang] || labelsByLang.en;

  useEffect(() => {
    fetchPackages(lang);
  }, [fetchPackages, lang]);

  // Get unique tiers from packages
  const tiers = useMemo(() => {
    const uniqueTiers = [...new Set(packages.map(p => p.tier).filter(Boolean))];
    return [ALL_TIER_KEY, ...uniqueTiers];
  }, [packages]);

  // Filter packages - MEMOIZED with dependencies
  const filteredPackages = useMemo(() => {
    if (!packages || packages.length === 0) return [];

    if (selectedTier === ALL_TIER_KEY) {
      return packages;
    }

    return packages.filter(p => p.tier === selectedTier);
  }, [packages, selectedTier]);

  const handleBookNow = (pkg) => {
    navigate('/booking', { state: { selectedPackage: pkg } });
  };

  const togglePackageExpand = (pkgId) => {
    setExpandedPackageId(expandedPackageId === pkgId ? null : pkgId);
  };

  if (loading) {
    return (
      <div className="text-[var(--text-color)]" style={{ background: 'radial-gradient(circle at 10% 15%, rgba(200,169,107,0.12), transparent 34%), radial-gradient(circle at 85% 8%, rgba(14,165,160,0.10), transparent 30%), linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)' }}>
        <section className="pt-14 pb-10 md:pt-20 md:pb-14">
          <div className="container mx-auto px-4">
            <div className="glass-card prism-glass p-10 md:p-16 text-center">
              <Skeleton variant="text" className="w-64 h-10 mx-auto mb-4" />
              <Skeleton variant="text" className="w-96 h-6 mx-auto mb-2" />
              <Skeleton variant="text" className="w-72 h-5 mx-auto" />
            </div>
          </div>
        </section>
        <section className="pb-10">
          <div className="container mx-auto px-4">
            <div className="flex justify-center gap-2 mb-8">
              {['All', 'Standard', 'Gold', 'Platinum', 'Premium'].map(tier => (
                <Skeleton key={tier} variant="button" className="w-24 h-10" />
              ))}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState
          icon="alert"
          title={ui.failedToLoadPackages}
          description={error}
          actionLabel={ui.tryAgain}
          onAction={() => fetchPackages(lang, true)}
        />
      </div>
    );
  }

  if (!packages || packages.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState
          icon="package"
          title={ui.noPackagesAvailable}
          description={ui.checkBackSoon}
        />
      </div>
    );
  }

  const PAGE_BG = [
    'radial-gradient(circle at 10% 15%, rgba(200,169,107,0.12), transparent 34%)',
    'radial-gradient(circle at 85% 8%,  rgba(14,165,160,0.10),  transparent 30%)',
    'linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)',
  ].join(', ');

  const TIER_ACCENT = {
    Standard: 'linear-gradient(90deg, transparent, #0ea5a0, transparent)',
    Gold:     'linear-gradient(90deg, transparent, #c8a96b, transparent)',
    Platinum: 'linear-gradient(90deg, transparent, #93c5fd, transparent)',
    Premium:  'linear-gradient(90deg, transparent, #c084fc, transparent)',
  };

  return (
    <div className="text-[var(--text-color)]" style={{ background: PAGE_BG }}>
      <SEO
        title="Detailing Packages & Pricing"
        description="Browse Flowly's car detailing packages for every budget — from express washes to full ceramic coating. Transparent pricing, mobile service across Qatar."
      />

      {/* ── Hero ── */}
      <section className="pt-14 pb-10 md:pt-20 md:pb-14">
        <div className="container mx-auto px-4">
          <div className="glass-card prism-glass p-10 md:p-16 text-center relative overflow-hidden"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
              e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
            }}>
            {/* Top accent */}
            <div className="absolute top-0 left-[10%] right-[10%] h-[1.5px]"
              style={{ background: 'linear-gradient(90deg,transparent,#c8a96b 30%,#0ea5a0 70%,transparent)' }} />
            {/* Prism rays */}
            <div className="prism-ray" style={{ left: '8%',  width: '18%', animation: 'prism-ray-sweep 16s ease-in-out 0s infinite' }} />
            <div className="prism-ray" style={{ left: '65%', width: '12%', animation: 'prism-ray-sweep 11s ease-in-out 5s infinite' }} />
            {/* Ambient orbs */}
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(200,169,107,0.12)' }} />
            <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(14,165,160,0.10)' }} />
            <div className="relative z-10">
              {/* Eyebrow badge */}
              <div className="flex items-center justify-center gap-3 mb-5">
                <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="uppercase tracking-[0.28em] text-primary text-[0.68rem] font-bold whitespace-nowrap">{ui.premiumAutoCare}</p>
                <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <h1 className="premium-heading text-5xl md:text-6xl font-bold mb-5 text-[var(--heading-color)]">
                {packagesPageContent.title}
              </h1>
              <p className="text-lg md:text-xl text-[var(--muted-color)] max-w-xl mx-auto leading-relaxed">
                {packagesPageContent.subtitle}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Spectrum divider */}
      <div className="py-1"><div className="container mx-auto px-4"><div className="spectrum-line" /></div></div>

      {/* ── Tier filters ── */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-center gap-3">
          {tiers.map(tier => (
            <button
              key={tier}
              onClick={() => { setSelectedTier(tier); setExpandedPackageId(null); }}
              className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 border ${
                selectedTier === tier
                  ? 'bg-primary text-[#101823] border-primary shadow-lg shadow-primary/30 scale-105'
                  : 'border-[var(--border-color)] bg-[var(--cta-soft-bg)] text-[var(--text-color)] hover:border-primary/50 hover:bg-[var(--cta-soft-hover-bg)]'
              }`}
            >
              {tier === ALL_TIER_KEY ? packagesPageContent.allTierLabel : tier}
            </button>
          ))}
        </div>
      </div>

      {/* ── Package cards ── */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          {filteredPackages.length === 0 ? (
            <div className="glass-card text-center py-20 relative overflow-hidden">
              <div className="prism-ray" style={{ left: '30%', width: '40%', animation: 'prism-ray-sweep 12s ease-in-out infinite' }} />
              <p className="text-[var(--muted-color)] text-lg relative z-10">
                {packages.length === 0
                  ? ui.noPackagesAvailable
                  : `${ui.noPackagesForTier} ${selectedTier} ${ui.tierSuffix}`.trim()}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {filteredPackages.map((pkg, index) => {
                const total = filteredPackages.length;
                const isMiddle = index === 1;
                const isExpanded = expandedPackageId === pkg.id;
                const isPopular = pkg.popular ?? isMiddle;
                const numLabel = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
                const packageName = pickLocalizedField(pkg, 'name', lang) || pkg.name;
                const packageDescription = pickLocalizedField(pkg, 'description', lang) || pkg.description;
                const services = pkg.services || [];
                const visibleServices = isExpanded ? services : services.slice(0, 4);
                const hasMore = services.length > 4;

                const CardContent = (
                  <>
                    <div className="pkg-card__head">
                      <span className="pkg-card__num">{numLabel}</span>
                      {isPopular && <span className="pkg-badge">Most Popular</span>}
                    </div>
                    <h3 className="pkg-card__title">{packageName}</h3>
                    <p className="pkg-card__desc">{packageDescription}</p>
                    <div className="pkg-card__meta">
                      <Clock size={13} />
                      <span>{pkg.estimatedDurationMinutes} {ui.minutesShort}</span>
                    </div>
                    <ul className="pkg-card__features">
                      {visibleServices.map((svc, i) => (
                        <li key={i}>
                          <Check size={15} />
                          {pickLocalizedField(svc, 'serviceName', lang)
                            || pickLocalizedField(svc, 'name', lang)
                            || svc?.serviceName || svc?.name || ui.serviceFallback}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button className="pkg-card__expand-btn" onClick={() => togglePackageExpand(pkg.id)}>
                        <ChevronDown size={13} className={isExpanded ? 'rotate-180' : ''} style={{ transition: 'transform 0.3s' }} />
                        {isExpanded ? ui.showLess : `+ ${services.length - 4} ${ui.more}`}
                      </button>
                    )}
                    <div className="pkg-card__foot">
                      <div>
                        <span className="pkg-card__price-label">{ui.startingAt}</span>
                        <span className="pkg-card__price">{formatQAR(pkg.price)}</span>
                      </div>
                      <button onClick={() => handleBookNow(pkg)} className="btn-chrome btn-chrome--sm">
                        {isAdmin ? ui.createCustomerBooking : ui.bookNow}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    <span className="pkg-card__watermark" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </>
                );

                if (isMiddle) {
                  return (
                    <article key={pkg.id} className="pkg-card pkg-card--holo">
                      <div className="pkg-card__inner">{CardContent}</div>
                    </article>
                  );
                }

                return (
                  <article key={pkg.id} className="pkg-card pkg-card--showroom">
                    {CardContent}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Packages;