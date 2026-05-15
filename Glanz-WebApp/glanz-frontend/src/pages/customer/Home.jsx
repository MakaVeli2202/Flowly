import React, { useEffect, useLayoutEffect, useRef, useState, Suspense } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, useNavigate } from 'react-router-dom';

import {
  ArrowRight, Star, Shield, Clock, Award, Sparkles, Zap,
  MapPin, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2,
  CalendarDays, Car, X, RefreshCw, AlertTriangle, Check,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { getSiteContent } from '../../config/siteContent';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { statsAPI } from '../../api/stats';
import { packagesAPI } from '../../api/packages';
import { servicesAPI } from '../../api/services';
import apiClient from '../../api/axios';
import SEO from '../../components/shared/SEO';
import { getBusiness } from '../../config/business';
import { Skeleton, CardSkeleton, BookingCardSkeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import LoadingCircle from '../../components/shared/LoadingCircle';

function buildLocalBusinessLd() {
  const biz = getBusiness();
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: biz.name,
    description: biz.tagline,
    telephone: biz.phone,
    email: biz.email,
    url: 'https://glanz.qa',
    image: 'https://glanz.qa/Logo.png',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Doha',
      addressCountry: 'QA',
    },
    areaServed: biz.serviceAreas || [],
    priceRange: '$$',
    sameAs: [],
  };
}

gsap.registerPlugin(ScrollTrigger);

/* ── Fallback Hardcoded Reviews ────────────────────────────────────── */
const FALLBACK_REVIEWS = [
  { id: 1, author: 'jack stoker', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjUZTLRAS10KNOwUGa7UlniVgxZBSd6CeXLZ4wNTZ7u1eSh3RSPowQ=w80-h80-c-rp-mo-ba3-br100', fallbackInitials: 'JS', rating: 5, date: '6 days ago', text: 'Noah and Bert are the bomb! They came out and made my car look better than when I first bought it! I would use these guys again and again!' },
  { id: 2, author: 'Jaden Reynolds', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjVl-8iYeGys1-Y_sH4qLenRZxbAinRyVbKEQeYn5v2822Exyi6JKw=w80-h80-c-rp-mo-br100', fallbackInitials: 'JR', rating: 5, date: '1 week ago', text: 'Thank you Bert and Noah for working with me on 2 separate days in getting the vehicle cleaned. Everything turned out great and CLEAN 🧼.' },
  { id: 3, author: "Drew D'Armond", avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjWpnP-klxJ73HEyajqUTqrYEjd959PIK6e3wubBHv3wP7foWvY=w80-h80-c-rp-mo-br100', fallbackInitials: 'DA', rating: 5, date: '2 weeks ago', text: 'Thorough and meticulous interior cleaning. Looks fantastic, thanks!' },
  { id: 4, author: 'Kamryn Schoeffler', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjXhLt0wpdvhkSrLyfbmQ_BAvVtKIWReScZ7ehGJmaPxdBs6wzbU=w80-h80-c-rp-mo-br100', fallbackInitials: 'KS', rating: 5, date: '1 month ago', text: 'Excellent service, would use again!' },
  { id: 5, author: 'Troy', avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJ_n0-jYhV2tl1ULCdEsCuCX0cR3UJwKrTwdFZI9gdjlcjp5Os=w80-h80-c-rp-mo-br100', fallbackInitials: 'T', rating: 5, date: '1 month ago', text: 'Did an amazing job, quick and fast.. truck looks great.' },
  { id: 6, author: 'William Norman', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjU8jMgWZJRu14ZpU2BTHxn96M4jMjRTs23yrc21lNaUC1zoJTWP=w80-h80-c-rp-mo-ba3-br100', fallbackInitials: 'WN', rating: 5, date: '1 month ago', text: "Now I have the cleanest 2002 Honda Pilot. My friends were making fun of me for spending $400 to clean a $3000 car, but who's laughing now?!" },
  { id: 7, author: 'Paul Panzica', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjUCaTaheLP3shn7yc2CytvkpiMShGId4Cei2FEsKrDIDP_E8q0=w80-h80-c-rp-mo-br100', fallbackInitials: 'PP', rating: 5, date: '1 month ago', text: 'Great service, quick, courteous and responsive. Full 1 year coat applied and shining on my Lucid and Tesla.' },
  { id: 8, author: 'Tim Bosworth', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjVLZ1e0HzRTYCdgSnv4zj6N9FY-4kBHVsRQr6dwAO5aCv0HFeBG=w80-h80-c-rp-mo-br100', fallbackInitials: 'TB', rating: 5, date: '1 month ago', text: 'Easy to book with, fast response, and really worked with my schedule. The guys showed up on time and did an amazing job!' },
  { id: 9, author: 'Sean Gregg', avatar: 'https://lh3.googleusercontent.com/a-/ALV-UjWh_GK5UQ55wa0CVx1irt1q29HXCLlBSxCXu81hoSWF4N03ei4c=w80-h80-c-rp-mo-br100', fallbackInitials: 'SG', rating: 5, date: '1 month ago', text: 'The detailers did a very good job. They got my truck looking like I bought it yesterday.' },
];

/* ── Reviews API (Real + Fallback Logic) ─────────────────────────────── */
const reviewsAPI = {
  getPublic: async () => {
    try {
      const response = await apiClient.get('/Reviews/public');
      const data = response.data;
      const apiReviews = Array.isArray(data?.reviews) ? data.reviews : [];
      // Return real reviews or empty array (fallback handled in component)
      return apiReviews;
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      return [];
    }
  },
};

/* ── Prismatic cursor orb — RAF + lerp ───────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let curX = mouseX, curY = mouseY, rafId;
    const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const tick = () => {
      curX += (mouseX - curX) * 0.09;
      curY += (mouseY - curY) * 0.09;
      // Ride lavender (#a888ff) ↔ cyan (#5cc7f5) — works on both light and dark backgrounds
      const t = mouseX / window.innerWidth;
      const r = Math.round(168 -  76 * t);
      const g = Math.round(136 +  63 * t);
      const b = Math.round(255 -  10 * t);
      el.style.transform  = `translate3d(${curX}px, ${curY}px, 0)`;
      el.style.background = `radial-gradient(circle, rgba(${r},${g},${b},.13) 0%, rgba(${r},${g},${b},.05) 55%, transparent 72%)`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 380, height: 380, top: '-190px', left: '-190px' }} />;
}

function AdvBubbles({ dense = false }) {
  const baseBubbles = [
    { left: '24%', top: '66%', size: '16px', delay: '0.8s', duration: '8.8s', bubbleA: '-4px', bubbleB: '9px', bubbleC: '-7px', bubbleD: '4px' },
    { left: '78%', top: '72%', size: '12px', delay: '3.2s', duration: '9.6s', bubbleA: '3px', bubbleB: '-6px', bubbleC: '7px', bubbleD: '-4px' },
  ];
  const extraBubbles = [
    { left: '52%', top: '64%', size: '18px', delay: '1.8s', duration: '10.4s', bubbleA: '-5px', bubbleB: '8px', bubbleC: '-6px', bubbleD: '5px' },
    { left: '86%', top: '58%', size: '14px', delay: '4.4s', duration: '9.2s', bubbleA: '4px', bubbleB: '-5px', bubbleC: '6px', bubbleD: '-3px' },
  ];

  const bubbles = dense ? [...baseBubbles, ...extraBubbles] : baseBubbles;

  return (
    <div className="adv-card__droplets">
      {bubbles.map((b, i) => (
        <div
          key={`${b.left}-${b.top}-${i}`}
          className="adv-card__droplet adv-card__droplet--bubble"
          style={{
            left: b.left,
            top: b.top,
            '--drop-size': b.size,
            '--bubble-drift-a': b.bubbleA,
            '--bubble-drift-b': b.bubbleB,
            '--bubble-drift-c': b.bubbleC,
            '--bubble-drift-d': b.bubbleD,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
  );
}

/* ── Review Card ──────────────────────────────────────────── */
function ReviewCard({ review }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef(null);
  const fallbackInitials = review.fallbackInitials || review.author.split(' ').map(n => n[0]).join('');
  const onMouse = (e) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
    el.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
  };
  return (
    <div ref={cardRef} className="review-liquid prism-glass rounded-2xl p-6 flex flex-col h-full relative overflow-hidden" onMouseMove={onMouse}>
      <AdvBubbles />
      <span aria-hidden="true" className="absolute -top-1 right-4 text-8xl leading-none font-serif pointer-events-none select-none"
        style={{ background: 'linear-gradient(135deg,rgba(255,0,100,.18),rgba(255,165,0,.18),rgba(0,255,100,.18),rgba(0,150,255,.18))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
        &ldquo;
      </span>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-11 h-11 flex-shrink-0">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">{fallbackInitials}</span>
            </div>
          )}
          {review.avatar && (
            <img src={review.avatar} alt={review.author}
              className={`w-11 h-11 rounded-full object-cover ${imageLoaded ? 'block' : 'hidden'}`}
              onLoad={() => setImageLoaded(true)} onError={() => setImageLoaded(false)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--heading-color)] text-sm capitalize leading-tight">{review.author}</p>
          <p className="text-xs text-[var(--muted-color)] mt-0.5">{review.date}</p>
        </div>
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 flex-shrink-0" style={{ opacity: 0.35 }}
          onError={e => { e.target.style.display = 'none'; }} />
      </div>
      <div className="flex gap-0.5 mb-3">
        {[...Array(review.rating || 5)].map((_, i) => <Star key={i} size={13} className="fill-primary text-primary" />)}
      </div>
      <p className="text-sm text-[var(--text-color)] leading-relaxed flex-1 relative z-10">{review.text}</p>
    </div>
  );
}

/* ── Count-up hook ────────────────────────────────────────── */
function useCountUp(target, duration = 2000, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!started || target === 0) { setValue(target); return; }
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, started]);
  return value;
}

/* ── Stat card ────────────────────────────────────────────── */
function StatCard({ number, suffix, label, started }) {
  const count = useCountUp(number, 2000, started);
  return (
    <div className="stat-card stat-holo">
      <span className="stat-number">{count}{suffix}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/* ── WordReveal ───────────────────────────────────────────── */
function WordReveal({ text, baseDelay = 0, className = '' }) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((word, i) => (
        <React.Fragment key={i}>
          <span className="word-clip">
            <span style={{ animationDelay: `${(baseDelay + i * 0.08).toFixed(2)}s` }}>{word}</span>
          </span>
          {i < words.length - 1 && '\u00A0'}
        </React.Fragment>
      ))}
    </span>
  );
}

/* ── Constants ─────────────────────────────────────────────── */
const MARQUEE_ITEMS = [
  'Exterior Detailing','Ceramic Coating','Interior Deep Clean',
  'Paint Protection','Machine Polish','Hand Wax Finish',
  'Engine Bay Clean','Rim Detailing','Headlight Restoration',
  'Odor Elimination','Upholstery Treatment','Glass Sealing',
];
const featureIcons  = { Star, Shield, Clock, Award };
const SERVICE_AREAS_DEFAULT_BY_LANG = {
  en: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Lusail', 'Al Khor', 'Dukhan', 'Al Shahaniya'],
  ar: ['الدوحة', 'الريان', 'الوكرة', 'لوسيل', 'الخور', 'دخان', 'الشحانية'],
  de: ['Doha', 'Ar-Rayyan', 'Al-Wakra', 'Lusail', 'Al-Khor', 'Dukhan', 'Asch-Schahaniyya'],
};
const SERVICE_AREA_LABELS = {
  Doha: { ar: 'الدوحة', de: 'Doha' },
  'Al Rayyan': { ar: 'الريان', de: 'Ar-Rayyan' },
  'Al Wakrah': { ar: 'الوكرة', de: 'Al-Wakra' },
  Lusail: { ar: 'لوسيل', de: 'Lusail' },
  'Al Khor': { ar: 'الخور', de: 'Al-Khor' },
  Dukhan: { ar: 'دخان', de: 'Dukhan' },
  'Al Shahaniya': { ar: 'الشحانية', de: 'Asch-Schahaniyya' },
};
const CARD_ACCENTS  = ['var(--primary)', 'var(--secondary)'];
const SERVICE_HIGHLIGHTS_FALLBACK_BY_LANG = {
  en: [
    { title: 'Exterior Detailing', description: 'Deep exterior wash, decontamination, and high-gloss finish.', features: ['Foam wash', 'Wheel and tire clean', 'Paint-safe drying', 'Gloss protection'] },
    { title: 'Interior Detailing', description: 'Thorough cabin cleaning for seats, dashboard, and hard-to-reach areas.', features: ['Vacuum and extraction', 'Dashboard treatment', 'Leather-safe clean', 'Odor neutralization'] },
    { title: 'Ceramic Protection', description: 'Long-lasting hydrophobic protection for easier maintenance and premium shine.', features: ['Surface prep', 'Panel application', 'Cure guidance', 'Water-repellent finish'] },
  ],
  ar: [
    { title: 'تنظيف خارجي احترافي', description: 'غسيل خارجي عميق مع إزالة الشوائب ولمعة نهائية قوية.', features: ['غسيل رغوي', 'تنظيف الجنوط والإطارات', 'تجفيف آمن للطلاء', 'حماية ولمعان'] },
    { title: 'تنظيف داخلي شامل', description: 'تنظيف دقيق للمقصورة والمقاعد والأسطح الداخلية.', features: ['شفط وتنظيف عميق', 'العناية بالطبلون', 'تنظيف آمن للجلد', 'إزالة الروائح'] },
    { title: 'حماية سيراميك', description: 'حماية طويلة الأمد بخصائص طاردة للماء ولمعة مميزة.', features: ['تجهيز السطح', 'تطبيق احترافي', 'إرشادات ما بعد الخدمة', 'حماية طاردة للماء'] },
  ],
  de: [
    { title: 'Aussenaufbereitung', description: 'Intensive Aussenreinigung mit Dekontamination und Hochglanz-Finish.', features: ['Schaumwaesche', 'Felgen- und Reifenpflege', 'Lackschonendes Trocknen', 'Glanzschutz'] },
    { title: 'Innenaufbereitung', description: 'Gruendliche Reinigung von Sitzen, Armaturen und schwer erreichbaren Bereichen.', features: ['Saugen und Tiefenreinigung', 'Cockpit-Pflege', 'Lederfreundliche Reinigung', 'Geruchsneutralisierung'] },
    { title: 'Keramikschutz', description: 'Lang anhaltender hydrophober Schutz fuer einfachere Pflege und starken Glanz.', features: ['Oberflaechenvorbereitung', 'Auftrag pro Panel', 'Hinweise zur Aushartung', 'Wasserabweisendes Finish'] },
  ],
};
const BRAND_VALUE_BY_LANG = {
  en: {
    title: "We Come to You. We Don't Cut Corners.",
    description: "Other shops make you drive there, drop your car, and hope for the best. We schedule around your life, arrive fully equipped at your home or office, and work with the same precision whether it's a daily driver or a weekend supercar. Every vehicle leaves looking exactly how it should.",
  },
  ar: {
    title: 'نصل إليك أينما كنت. والجودة ليست محل تفاوض.',
    description: 'ورش كثيرة تطلب منك القيادة والانتظار. نحن نرتب المواعيد حسب وقتك، ونصل إلى منزلك أو مقر عملك بكامل المعدات، وننفذ الخدمة بنفس الدقة لكل سيارة، من الاستخدام اليومي حتى السيارات الفاخرة.',
  },
  de: {
    title: 'Wir kommen zu Ihnen. Ohne Kompromisse bei der Qualitaet.',
    description: 'Andere Anbieter verlangen Anfahrt und Wartezeit. Wir richten uns nach Ihrem Termin, kommen voll ausgestattet zu Ihnen und arbeiten mit derselben Praezision bei jedem Fahrzeug.',
  },
};
const HOW_IT_WORKS_BY_LANG = {
  en: [
    {
      step: '01',
      Icon: CalendarDays,
      title: 'Book in Minutes',
      description: 'Choose your service, pick a date and time that suits your schedule, and confirm your location anywhere in Qatar.',
      accent: '#c8a96b',
    },
    {
      step: '02',
      Icon: Car,
      title: 'We Arrive Equipped',
      description: 'Our team shows up fully loaded with professional tools, premium products, and everything needed to deliver a flawless result.',
      accent: '#0ea5a0',
    },
    {
      step: '03',
      Icon: Sparkles,
      title: 'Drive in Brilliance',
      description: 'Collect your keys and experience a finish that turns heads. No queues. No drop-offs. No compromise.',
      accent: '#c8a96b',
    },
  ],
  ar: [
    {
      step: '01',
      Icon: CalendarDays,
      title: 'احجز خلال دقائق',
      description: 'اختر الخدمة المناسبة، وحدد اليوم والوقت المناسبين لك، ثم أكد موقعك في أي منطقة داخل قطر.',
      accent: '#c8a96b',
    },
    {
      step: '02',
      Icon: Car,
      title: 'نصل إليك مجهزين بالكامل',
      description: 'فريقنا يصل بكل المعدات والمواد الاحترافية اللازمة لتنفيذ خدمة دقيقة بنتيجة ممتازة.',
      accent: '#0ea5a0',
    },
    {
      step: '03',
      Icon: Sparkles,
      title: 'استلم سيارتك بأفضل مظهر',
      description: 'استلم المفاتيح واستمتع بنتيجة تبرز سيارتك. بدون طوابير، بدون تسليم السيارة في الورشة، وبدون تنازلات.',
      accent: '#c8a96b',
    },
  ],
  de: [
    {
      step: '01',
      Icon: CalendarDays,
      title: 'In Minuten buchen',
      description: 'Waehlen Sie Ihre Leistung, den passenden Termin und bestaetigen Sie Ihren Standort in Katar.',
      accent: '#c8a96b',
    },
    {
      step: '02',
      Icon: Car,
      title: 'Wir kommen voll ausgestattet',
      description: 'Unser Team erscheint mit professionellen Werkzeugen und Premium-Produkten fuer ein makelloses Ergebnis.',
      accent: '#0ea5a0',
    },
    {
      step: '03',
      Icon: Sparkles,
      title: 'Fahren mit Glanz',
      description: 'Nehmen Sie Ihre Schluessel entgegen und geniessen Sie ein Ergebnis, das auffaellt. Ohne Wartezeiten und ohne Kompromisse.',
      accent: '#c8a96b',
    },
  ],
};
const DOTS = [
  { top: '12%', left: '8%',   size: 3, color: 'color-mix(in srgb, var(--primary) 50%, transparent)',   anim: 'floatA', delay: '0s'   },
  { top: '70%', left: '5%',   size: 2, color: 'color-mix(in srgb, var(--secondary) 40%, transparent)', anim: 'floatB', delay: '1s'   },
  { top: '30%', right: '6%',  size: 4, color: 'color-mix(in srgb, var(--primary) 30%, transparent)',   anim: 'floatB', delay: '0.5s' },
  { top: '80%', right: '10%', size: 2, color: 'color-mix(in srgb, var(--secondary) 50%, transparent)', anim: 'floatA', delay: '2s'   },
  { top: '50%', left: '15%',  size: 2, color: 'rgba(255,255,255,0.2)',                                  anim: 'floatA', delay: '1.5s' },
  { top: '20%', right: '20%', size: 3, color: 'color-mix(in srgb, var(--primary) 40%, transparent)',   anim: 'floatB', delay: '3s'   },
  { top: '60%', left: '25%',  size: 2, color: 'color-mix(in srgb, var(--secondary) 30%, transparent)', anim: 'floatA', delay: '0.8s' },
  { top: '85%', right: '25%', size: 3, color: 'color-mix(in srgb, var(--primary) 25%, transparent)',   anim: 'floatB', delay: '2.5s' },
];
const PAGE_BG = [
  'radial-gradient(circle at 10% 15%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 34%)',
  'radial-gradient(circle at 85% 8%, color-mix(in srgb, var(--secondary) 14%, transparent), transparent 30%)',
].join(', ');

const HOME_UI_BY_LANG = {
  en: {
    ourServices: 'Our Services',
    sectionLabel: 'Full-Service Detailing',
    sectionTitle: 'Exterior & Interior Care',
    sectionDescription: 'We bring professional-grade detailing to your driveway. Scroll to explore every service we offer.',
    scrollToExplore: 'Scroll to explore',
    moreServices: 'more services',
    viewAllDetails: 'View all details',
    whatsIncluded: "What's Included",
    bookNow: 'Book Now',
    howItWorksLabel: 'The Process',
    howItWorksTitle: 'How It Works',
    howItWorksDescription: 'Three steps. Zero hassle. A finish that speaks for itself.',
    serviceAreasTitle: 'We Come to You. Anywhere in Qatar.',
    serviceAreasDescription: 'Professional mobile detailing across every major district.',
    heroRating: 'Rating',
    heroHappyClients: 'Happy Clients',
    heroMobileService: 'Mobile Service · Qatar',
    heroScroll: 'Scroll',
    statsHappyClients: 'Happy Clients',
    statsCarsDetailed: 'Cars Detailed',
    statsAverageRating: 'Average Rating',
    statsYearsExcellence: 'Years of Excellence',
    featuresLabel: 'Why Choose Us',
    featuresTitle: 'Crafted for Perfection',
  },
  ar: {
    ourServices: 'خدماتنا',
    sectionLabel: 'تلميع متكامل',
    sectionTitle: 'عناية خارجية وداخلية',
    sectionDescription: 'نقدم تلميعاً احترافياً لسيارتك في موقعك. مرر لاستعراض جميع الخدمات.',
    scrollToExplore: 'مرر للاستكشاف',
    moreServices: 'خدمات إضافية',
    viewAllDetails: 'عرض كل التفاصيل',
    whatsIncluded: 'ما الذي تتضمنه الخدمة',
    bookNow: 'احجز الآن',
    howItWorksLabel: 'الآلية',
    howItWorksTitle: 'كيف تعمل الخدمة',
    howItWorksDescription: 'ثلاث خطوات فقط. بدون تعقيد. ونتيجة تتحدث عن نفسها.',
    serviceAreasTitle: 'نصل إليك في أي مكان داخل قطر.',
    serviceAreasDescription: 'خدمة تفصيل متنقلة احترافية في جميع المناطق الرئيسية.',
    heroRating: 'تقييم',
    heroHappyClients: 'عميل سعيد',
    heroMobileService: 'خدمة متنقلة · قطر',
    heroScroll: 'مرر',
    statsHappyClients: 'عميل سعيد',
    statsCarsDetailed: 'سيارة تم خدمتها',
    statsAverageRating: 'متوسط التقييم',
    statsYearsExcellence: 'سنوات من التميز',
    featuresLabel: 'لماذا تختارنا',
    featuresTitle: 'مصمم للإتقان',
  },
  de: {
    ourServices: 'Unsere Services',
    sectionLabel: 'Full-Service Detailing',
    sectionTitle: 'Aussen- und Innenpflege',
    sectionDescription: 'Wir bringen professionelle Fahrzeugpflege direkt zu Ihnen. Scrollen Sie, um alle Services zu sehen.',
    scrollToExplore: 'Zum Entdecken scrollen',
    moreServices: 'weitere Services',
    viewAllDetails: 'Alle Details anzeigen',
    whatsIncluded: 'Was enthalten ist',
    bookNow: 'Jetzt buchen',
    howItWorksLabel: 'Ablauf',
    howItWorksTitle: 'So funktioniert es',
    howItWorksDescription: 'Drei Schritte. Kein Aufwand. Ein Ergebnis, das fuer sich spricht.',
    serviceAreasTitle: 'Wir kommen zu Ihnen. Ueberall in Katar.',
    serviceAreasDescription: 'Professionelle mobile Fahrzeugpflege in allen wichtigen Gebieten.',
    heroRating: 'Bewertung',
    heroHappyClients: 'Zufriedene Kunden',
    heroMobileService: 'Mobiler Service · Katar',
    heroScroll: 'Scrollen',
    statsHappyClients: 'Zufriedene Kunden',
    statsCarsDetailed: 'Fahrzeuge aufbereitet',
    statsAverageRating: 'Durchschnittsbewertung',
    statsYearsExcellence: 'Jahre Exzellenz',
    featuresLabel: 'Warum wir',
    featuresTitle: 'Fuer Perfektion gemacht',
  },
};

const normalizeLangCode = (lang) => (lang || 'en').toLowerCase().split('-')[0];

const getDefaultServiceAreasForLang = (lang) => {
  const normalizedLang = normalizeLangCode(lang);
  return SERVICE_AREAS_DEFAULT_BY_LANG[normalizedLang] || SERVICE_AREAS_DEFAULT_BY_LANG.en;
};

const localizeServiceArea = (area, lang) => {
  const normalizedLang = normalizeLangCode(lang);
  if (normalizedLang === 'en') return area;
  const mapped = SERVICE_AREA_LABELS[area]?.[normalizedLang];
  return mapped || area;
};

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

/* ════════════════════════════════════════════════════════════
   HOME PAGE
════════════════════════════════════════════════════════════ */
function Home() {
  const { lang } = useLanguage();
  const normalizedLang = normalizeLangCode(lang);
  const ui = HOME_UI_BY_LANG[normalizedLang] || HOME_UI_BY_LANG.en;

  const howItWorks = (HOW_IT_WORKS_BY_LANG[normalizedLang] || HOW_IT_WORKS_BY_LANG.en)
    .map((item, i) => ({ ...item, accent: i % 2 === 0 ? 'var(--primary)' : 'var(--secondary)' }));
  const brandValue = BRAND_VALUE_BY_LANG[normalizedLang] || BRAND_VALUE_BY_LANG.en;
  const { homePageContent } = getSiteContent(lang);
  const theme = useTheme();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const primaryCtaTarget   = isAdmin ? '/admin/bookings' : '/booking';
  const primaryCtaLabel    = isAdmin ? 'Edit Bookings'   : homePageContent.primaryCta;
  const finalCtaTarget     = isAdmin ? '/admin/bookings' : '/booking';
  const finalCtaLabel      = isAdmin ? 'Edit Bookings'   : homePageContent.finalCta;
  const secondaryCtaTarget = isAdmin ? '/booking'        : '/packages';
  const secondaryCtaLabel  = isAdmin ? 'Create Customer Booking' : homePageContent.secondaryCta;

  /* ── State ── */
  const [stats, setStats]                           = useState({ carsDetailed: 0, happyClients: 0, activePackages: 0, yearsActive: 0 });
  const [statsStarted, setStatsStarted]             = useState(false);
  const [reviews, setReviews]                       = useState(FALLBACK_REVIEWS);
  const [packages, setPackages]                     = useState([]);
  const [services, setServices]                     = useState([]);
  const [serviceAreas, setServiceAreas]             = useState(() => getBusiness().serviceAreas || getDefaultServiceAreasForLang(normalizedLang));
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [visibleReviewCount, setVisibleReviewCount] = useState(1);
  const [isDragging, setIsDragging]                 = useState(false);
  const [dragStart, setDragStart]                   = useState(0);
  const [showFloatingCta, setShowFloatingCta]       = useState(false);
  const [expandedService, setExpandedService]       = useState(null);

  /* ── Refs ── */
  const statsRef          = useRef(null);
  const carouselRef       = useRef(null);
  const heroSectionRef    = useRef(null);
  const heroCardRef       = useRef(null);
  const areasSectionRef   = useRef(null);
  const serviceSectionRef = useRef(null);
  const serviceTrackRef   = useRef(null);
  const progressRef       = useRef(null);
  const cardCounterRef    = useRef(null);
  const featuresRef       = useRef(null);
  const brandRef          = useRef(null);
  const processRef        = useRef(null);
  // Tracks live package count for GSAP counter callback (avoids stale closure)
  const packageCountRef   = useRef(2);


  /* ── Data fetching — parallelized ── */
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const data = await reviewsAPI.getPublic();
        const real = Array.isArray(data) ? data : [];
        setReviews(real.length > 0 ? real : FALLBACK_REVIEWS);
      } catch {
        setReviews(FALLBACK_REVIEWS);
      }
    };

    Promise.allSettled([
      statsAPI.getPublic().then(data => { setStats(data || {}); return data; }).catch(() => {}),
      fetchReviews(),
      packagesAPI.getAll(lang).then(data => {
        const active = (data || []).filter(p => p.isActive);
        packageCountRef.current = active.length || 3;
        setPackages(active);
        return active;
      }).catch(() => []),
      servicesAPI.getAll(lang).then(data => {
        const active = (data || []).filter(s => s.isActive !== false);
        setServices(active);
        return active;
      }).catch(() => []),
    ])
      .catch((err) => {
        console.error('Home page data fetch error:', err);
      });
  }, [lang]);

  // Reload service areas when admin updates business config
  useEffect(() => {
    const handler = () => setServiceAreas(getBusiness().serviceAreas || getDefaultServiceAreasForLang(normalizedLang));
    window.addEventListener('businessConfigChanged', handler);
    return () => window.removeEventListener('businessConfigChanged', handler);
  }, [normalizedLang]);

  // Recalculate GSAP pin-spacer height after package count is known
  useEffect(() => {
    if (packages.length > 0) ScrollTrigger.refresh();
  }, [packages]);

  useEffect(() => {
    const onResize = () => {
      if      (window.innerWidth >= 1024) setVisibleReviewCount(4);
      else if (window.innerWidth >= 768)  setVisibleReviewCount(2);
      else                                setVisibleReviewCount(1);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (reviews.length === 0 || isDragging) return;
    const maxIdx = Math.max(0, reviews.length - visibleReviewCount);
    const iv = setInterval(() => setCurrentReviewIndex(p => (p >= maxIdx ? 0 : p + 1)), 6000);
    return () => clearInterval(iv);
  }, [visibleReviewCount, reviews.length, isDragging]);

  useEffect(() => {
    if (isAdmin) return;
    const onScroll = () => setShowFloatingCta(window.scrollY > 520);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isAdmin]);

  useEffect(() => {
    const onMove = (e) => {
      document.documentElement.style.setProperty('--mouse-hue', `${(e.clientX / window.innerWidth) * 360}deg`);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  /* ── GSAP — Hero scrub ── */
  useEffect(() => {
    if (!heroSectionRef.current || !heroCardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(heroCardRef.current, {
        yPercent: -18, opacity: 0.08, ease: 'none',
        scrollTrigger: {
          trigger: heroSectionRef.current,
          start: 'top top', end: 'bottom top', scrub: 0.8,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  /* ── GSAP — Service areas ── */
  useEffect(() => {
    if (!areasSectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.areas-heading', {
        y: 45, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: areasSectionRef.current, start: 'top 80%' },
      });
      gsap.from('.area-chip', {
        y: 32, opacity: 0, scale: 0.86, duration: 0.65, ease: 'power3.out',
        stagger: { amount: 0.55, from: 'center' },
        scrollTrigger: { trigger: areasSectionRef.current, start: 'top 75%' },
      });
    }, areasSectionRef);
    return () => ctx.revert();
  }, []);

  /* ── GSAP — Stats ── */
  useEffect(() => {
    if (!statsRef.current || !stats || stats.length === 0) return;
    const elements = statsRef.current.querySelectorAll('.stat-card');
    if (elements.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.from(elements, {
        y: 60, opacity: 0, scale: 0.82, duration: 1, ease: 'power3.out', stagger: 0.15,
        scrollTrigger: {
          trigger: statsRef.current, start: 'top 80%',
          onEnter: () => setStatsStarted(true),
        },
      });
    }, statsRef);
    return () => ctx.revert();
  }, [stats]);

  /* ─────────────────────────────────────────────────────────
     GSAP — Services: horizontal pin
     
     WHY useLayoutEffect:
     Runs synchronously BEFORE the browser paints the first
     frame. The pin-spacer GSAP injects is therefore part of
     the initial painted layout — the CLS algorithm has no
     "previous frame" to compare against → CLS = 0.

     WHY anticipatePin: 1:
     GSAP starts the pin calculation 1 screen-worth early so
     there is no single-frame gap/jump when the pin activates.
  ───────────────────────────────────────────────────────── */
  useLayoutEffect(() => {
    const section = serviceSectionRef.current;
    const track   = serviceTrackRef.current;
    if (!section || !track) return;

    let cancelled = false;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 768px)', () => {
        const getTotal = () => Math.max(0, track.scrollWidth - window.innerWidth);

        /*
          CSS sticky approach — no GSAP pin, no pin-spacer injection → CLS = 0.
          We set the outer section's height to (scroll distance + viewport height)
          so the page has enough scroll room. The inner wrapper is position:sticky,
          handled entirely by the browser before any paint.
        */
        const setHeight = () => {
          section.style.height = `${getTotal() + window.innerHeight}px`;
        };
        setHeight();

        gsap.to(track, {
          x: () => -getTotal(),
          ease: 'none',
          scrollTrigger: {
            trigger:             section,
            start:               'top top',
            end:                 'bottom bottom',
            scrub:               0.5,
            invalidateOnRefresh: true,
            onRefresh:           setHeight,
            onUpdate: (self) => {
              if (progressRef.current)
                progressRef.current.style.width = `${self.progress * 100}%`;
              if (cardCounterRef.current) {
                const n   = packageCountRef.current;
                const idx = Math.min(Math.ceil(self.progress * (n + 0.25)), n);
                const fmt = v => String(v).padStart(2, '0');
                cardCounterRef.current.textContent = `${fmt(Math.max(1, idx))} / ${fmt(n)}`;
              }
            },
          },
        });
      });

      // Reset inline height on mobile so the section collapses naturally
      mm.add('(max-width: 767px)', () => {
        section.style.height = '';
      });
    });

    // Refresh after fonts load so track.scrollWidth is font-accurate
    document.fonts.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });

    return () => { cancelled = true; ctx.revert(); section.style.height = ''; };
  }, []);

  /* ── GSAP — Features fly-in ── */
  useEffect(() => {
    if (!featuresRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.feature-card', {
        y: 80, opacity: 0, rotateX: 16, scale: 0.9,
        duration: 1.1, ease: 'power3.out', stagger: 0.17,
        transformOrigin: 'top center',
        scrollTrigger: { trigger: featuresRef.current, start: 'top 76%' },
      });
    }, featuresRef);
    return () => ctx.revert();
  }, []);

  /* ── GSAP — Brand reveal ── */
  useEffect(() => {
    if (!brandRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(brandRef.current, {
        scale: 0.93, opacity: 0, duration: 1.1, ease: 'power2.out',
        scrollTrigger: { trigger: brandRef.current, start: 'top 82%' },
      });
    });
    return () => ctx.revert();
  }, []);

  /* ── GSAP — How It Works ── */
  useEffect(() => {
    if (!processRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.process-heading', {
        y: 40, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: processRef.current, start: 'top 82%' },
      });
      gsap.from('.process-card', {
        y: 65, opacity: 0, scale: 0.91, duration: 1.05, ease: 'power3.out',
        stagger: 0.18,
        scrollTrigger: { trigger: processRef.current, start: 'top 78%' },
      });
    }, processRef);
    return () => ctx.revert();
  }, []);

  /* ── Review carousel ── */
  const handleMouseDown  = e => { setIsDragging(true); setDragStart(e.clientX); };
  const handleMouseUp    = e => {
    if (!isDragging) return; setIsDragging(false);
    const dist = dragStart - e.clientX; if (Math.abs(dist) < 50) return;
    const max = Math.max(0, reviews.length - visibleReviewCount);
    if (dist > 0) setCurrentReviewIndex(p => (p >= max ? 0 : p + 1));
    else          setCurrentReviewIndex(p => (p === 0 ? max : p - 1));
  };
  const handleTouchStart = e => { setIsDragging(true); setDragStart(e.touches[0].clientX); };
  const handleTouchEnd   = e => {
    if (!isDragging) return; setIsDragging(false);
    const dist = dragStart - e.changedTouches[0].clientX; if (Math.abs(dist) < 50) return;
    const max = Math.max(0, reviews.length - visibleReviewCount);
    if (dist > 0) setCurrentReviewIndex(p => (p >= max ? 0 : p + 1));
    else          setCurrentReviewIndex(p => (p === 0 ? max : p - 1));
  };
  const handlePrevReview = () => {
    const max = Math.max(0, reviews.length - visibleReviewCount);
    setCurrentReviewIndex(p => (p === 0 ? max : p - 1));
  };
  const handleNextReview = () => {
    const max = Math.max(0, reviews.length - visibleReviewCount);
    setCurrentReviewIndex(p => (p >= max ? 0 : p + 1));
  };

  const marqueeSource  = services.length > 0
    ? services.map((s) => pickLocalizedField(s, 'name', lang) || s.name).filter(Boolean)
    : MARQUEE_ITEMS;
  const marqueeItems    = [...marqueeSource, ...marqueeSource];
  const marqueeDuration = 28;
  const reviewDotsCount = Math.ceil(reviews.length / visibleReviewCount);

  const fallbackHighlights = SERVICE_HIGHLIGHTS_FALLBACK_BY_LANG[normalizedLang]
    || SERVICE_HIGHLIGHTS_FALLBACK_BY_LANG.en;

  // Service highlights: prefer real API packages, fallback to static cards.
  const serviceHighlights = packages.length > 0
    ? packages.map((pkg, index) => ({
        title: pickLocalizedField(pkg, 'name', lang) || pkg.name,
        description: pickLocalizedField(pkg, 'description', lang) || pkg.description || '',
        features: pkg.services?.map(s => (
          pickLocalizedField(s, 'serviceName', lang)
          || pickLocalizedField(s, 'name', lang)
          || s.serviceName
          || s.name
        )).filter(Boolean) || [],
        cta: ui.bookNow,
        link: '/booking',
        pkg,
        price: pkg.price ?? null,
        popular: pkg.popular ?? false,
      }))
    : fallbackHighlights.map((item, index) => ({
        ...item,
        cta: ui.bookNow,
        link: '/booking',
        pkg: null,
        price: item.price ?? null,
        popular: index === 1,
      }));

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="text-[var(--text-color)]">
      <SEO
        title="Professional Car Detailing in Qatar"
        description="Glanz offers premium mobile car detailing across Qatar — exterior, interior, ceramic coating and more. We come to you. Book online today."
        jsonLd={buildLocalBusinessLd()}
      />
      <PrismaticCursorOrb />

      {/* ══ HERO — Video (both themes) ══ */}
      <section ref={heroSectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* YouTube background video */}
        <div className={`absolute inset-0 overflow-hidden ${theme === 'light' ? 'bg-transparent' : 'bg-black'}`} style={{ pointerEvents: 'none' }}>
          <iframe
            className="absolute"
            style={{
              top: '50%', left: '50%',
              width: '100vw', height: '56.25vw',
              minHeight: '100vh', minWidth: '177.77777778vh',
              transform: 'translate(-50%, -50%)',
              border: 0,
            }}
            src="https://www.youtube-nocookie.com/embed/ZeES31xz7CE?autoplay=1&mute=1&loop=1&playlist=ZeES31xz7CE&controls=0&rel=0&playsinline=1&modestbranding=1&enablejsapi=0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            title="Hero background"
          />
        </div>
        {/* Cinematic overlay — dark only; light = no veil so video shows raw */}
        {theme !== 'light' && (
          <div className="absolute inset-0" style={{
            background: [
              'radial-gradient(ellipse 90% 80% at 50% 55%, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.60) 100%)',
              'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 38%, rgba(0,0,0,0.70) 100%)',
            ].join(', '),
          }} />
        )}
        {/* Ambient orbs — dark only */}
        {theme !== 'light' && (
          <>
            <div className="absolute -top-28 -right-28 w-[560px] h-[560px] rounded-full pointer-events-none" style={{
              background: 'conic-gradient(from 0deg,rgba(200,169,107,.18),rgba(168,132,60,.08),rgba(200,169,107,.14),rgba(240,208,128,.10))',
              filter: 'blur(88px)', animation: 'spectrum-float 16s ease-in-out infinite',
            }} />
            <div className="absolute -bottom-36 -left-24 w-[460px] h-[460px] rounded-full pointer-events-none" style={{
              background: 'conic-gradient(from 180deg,rgba(168,132,60,.14),rgba(200,169,107,.12),rgba(240,208,128,.08),rgba(200,169,107,.14))',
              filter: 'blur(88px)', animation: 'spectrum-float 19s ease-in-out 5s infinite',
            }} />
          </>
        )}

        <div className="container mx-auto px-4 relative z-10 py-16 md:py-20 flex flex-col items-center">
          <div ref={heroCardRef} className={`${theme === 'light' ? 'hero-glass-light' : 'hero-glass'} max-w-5xl w-full mx-auto`} style={{ willChange: 'transform' }}>
            <AdvBubbles dense />
            <div className="absolute top-0 left-[10%] right-[10%] h-[1.5px] hero-animate hero-animate-1" style={{
              background: theme === 'light'
                ? 'linear-gradient(90deg,transparent,#a888ff 30%,#5cc7f5 70%,transparent)'
                : 'linear-gradient(90deg,transparent,#c8a96b 30%,#f0d080 70%,transparent)',
            }} />
            <div className="relative z-10 px-8 md:px-16 py-10 md:py-12 text-center flex flex-col items-center">
              <div className="mb-6 hero-animate hero-animate-1">
                <img src={getBusiness().logo || '/GlanzLogo.png'} alt="Glanz" className="h-24 sm:h-28 md:h-36 w-auto object-contain mx-auto drop-shadow-xl" />
              </div>
              {/* Badge */}
              <div className="flex items-center gap-3 mb-6 hero-animate hero-animate-1">
                <span className="flex-shrink-0 h-px w-12" style={{ background: theme === 'light' ? 'linear-gradient(90deg,transparent,#a888ff)' : 'linear-gradient(90deg,transparent,#c8a96b)' }} />
                {theme === 'light' ? (
                  <p className="uppercase text-[0.68rem] font-bold whitespace-nowrap" style={{
                    letterSpacing: '0.30em',
                    background: 'linear-gradient(90deg,#ff7eb4,#a888ff,#5cc7f5,#8ef7ca,#a888ff)',
                    backgroundSize: '200% 100%',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'holo-flow 8s ease-in-out infinite',
                  }}>{homePageContent.badge}</p>
                ) : (
                  <p className="uppercase tracking-[0.30em] text-primary text-[0.68rem] font-bold whitespace-nowrap">{homePageContent.badge}</p>
                )}
                <span className="flex-shrink-0 h-px w-12" style={{ background: theme === 'light' ? 'linear-gradient(90deg,#a888ff,transparent)' : 'linear-gradient(90deg,#c8a96b,transparent)' }} />
              </div>
              {/* Headline */}
              <h1 className={`${theme === 'light' ? 'hero-chrome-title' : 'hero-gold-title'} premium-heading text-6xl sm:text-7xl md:text-8xl font-bold mb-7 leading-[0.90] tracking-tight`}>
                <WordReveal text={homePageContent.title} baseDelay={0.12} />
              </h1>
              <div className="w-20 h-px mb-7 hero-animate hero-animate-2" style={{
                background: theme === 'light'
                  ? 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)'
                  : 'linear-gradient(90deg,transparent,#c8a96b,transparent)',
              }} />
              <p className="text-base md:text-lg text-white/75 mb-10 max-w-2xl leading-relaxed hero-animate hero-animate-3">
                {homePageContent.description}
              </p>
              {/* Buttons */}
              <div className="flex flex-wrap justify-center gap-4 mb-8 hero-animate hero-animate-4">
                <Link to={primaryCtaTarget} className="btn-chrome text-base px-8 py-4">
                  {primaryCtaLabel}<ArrowRight size={18} />
                </Link>
                <Link to={secondaryCtaTarget} className="btn-ghost-chrome btn-ghost-chrome--on-video text-base">
                  {secondaryCtaLabel}
                </Link>
              </div>
              {/* Trust strip */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 hero-animate hero-animate-4">
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={12} className="fill-primary text-primary" />)}
                  <span className="text-white/45 text-xs ml-1 font-medium">4.9 {ui.heroRating}</span>
                </div>
                <span className="h-3 w-px bg-white/15 hidden sm:block" />
                <span className="text-white/45 text-xs font-medium">{stats.happyClients > 0 ? `${stats.happyClients}+` : '100+'} {ui.heroHappyClients}</span>
                <span className="h-3 w-px bg-white/15 hidden sm:block" />
                <span className="flex items-center gap-1 text-white/45 text-xs font-medium"><MapPin size={10} />{ui.heroMobileService}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-2 hero-animate hero-animate-4">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.18)' }}>
            <ChevronDown size={14} className="text-white/40 animate-bounce" />
          </div>
          <span className="text-white/30 text-[0.55rem] tracking-[0.22em] uppercase font-semibold">{ui.heroScroll}</span>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="py-[14px] border-y border-[var(--border-color)]"
        style={{ background: 'rgba(0,0,0,0.12)' }} aria-hidden="true">
        <div className="marquee-outer">
          <div className="marquee-inner" style={{ animationDuration: `${marqueeDuration}s` }}>
            {marqueeItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2.5 px-5 text-[0.72rem] font-semibold tracking-[0.18em] uppercase whitespace-nowrap" style={{ color: 'var(--muted-color)' }}>
                <span style={{ color: 'var(--primary)', fontSize: '0.9rem', lineHeight: 1 }}>✦</span>{item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══ STATS ══ */}
      <section className="py-8 md:py-10" ref={statsRef}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard number={stats.happyClients} suffix="+"   label={ui.statsHappyClients}   started={statsStarted} />
            <StatCard number={stats.carsDetailed} suffix="+"   label={ui.statsCarsDetailed}    started={statsStarted} />
            <StatCard number={4}                  suffix=".9★" label={ui.statsAverageRating}   started={statsStarted} />
            <StatCard number={stats.yearsActive}  suffix="+"   label={ui.statsYearsExcellence} started={statsStarted} />
          </div>
        </div>
      </section>

      <div className="py-3 px-0"><div className="spectrum-line" /></div>

      {/* ══ HOW IT WORKS ══ */}
      <section ref={processRef} className="py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 process-heading">
            <p className="uppercase tracking-[0.26em] text-primary text-[0.68rem] font-bold mb-3">{ui.howItWorksLabel}</p>
            <h2 className="premium-heading metallic-heading text-4xl md:text-5xl font-bold">{ui.howItWorksTitle}</h2>
            <p className="text-[var(--muted-color)] text-base md:text-lg mt-4 max-w-xl mx-auto leading-relaxed">
              {ui.howItWorksDescription}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
            <div className="hidden md:block absolute top-[3.5rem] left-[calc(33.33%_+_2rem)] right-[calc(33.33%_+_2rem)] h-px"
              style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--primary) 50%, transparent), color-mix(in srgb, var(--secondary) 50%, transparent))' }} />
            {howItWorks.map((item) => {
              const StepIcon = item.Icon;
              return (
                <div key={item.step}
                  className="process-card glass-card prism-glass p-8 text-center relative overflow-hidden"
                  onMouseMove={e => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
                    e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
                  }}
                >
                  <div className="relative z-10">
                    <span className="block text-[0.6rem] font-black tracking-[0.32em] mb-5"
                      style={{ color: item.accent, opacity: 0.6 }}>
                      {item.step}
                    </span>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                      style={{ background: `color-mix(in srgb, ${item.accent} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${item.accent} 28%, transparent)` }}>
                      <StepIcon size={22} style={{ color: item.accent }} />
                    </div>
                    <h3 className="premium-heading metallic-heading text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-sm text-[var(--muted-color)] leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SERVICE HIGHLIGHTS — DESKTOP
          Plain section — no wrapper div.
          useLayoutEffect above applies pin: true before paint.
      ══════════════════════════════════════════════════════ */}
      {/*
        Outer section: tall enough for the full horizontal scroll distance.
        Height is set imperatively in useLayoutEffect via section.style.height.
        No GSAP pin — no pin-spacer injection — CLS = 0.
      */}
      <section
        ref={serviceSectionRef}
        className="hidden md:block relative"
        style={{ background: PAGE_BG, direction: 'ltr' }}
        dir="ltr"
      >
        {/* Sticky inner: browser positions this before any paint */}
        <div className="sticky top-0 h-screen flex items-center overflow-hidden" style={{ background: PAGE_BG }}>
          <div className="absolute top-10 left-12 z-30 flex items-center gap-3">
            <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, var(--primary))' }} />
            <p className="uppercase tracking-[0.28em] text-primary text-[0.65rem] font-semibold">{ui.ourServices}</p>
          </div>
          <div className="absolute top-10 right-12 z-30">
            <p ref={cardCounterRef} className="text-[var(--muted-color)] text-xs font-mono tracking-[0.18em]">01 / 02</p>
          </div>

          <div
            ref={serviceTrackRef}
            className="flex items-center gap-10 h-full"
            style={{ paddingLeft: '10vw', paddingRight: '10vw', width: 'max-content' }}
          >
            <div className="w-[36vw] max-w-[500px] flex-shrink-0 flex flex-col justify-center pr-8">
              <p className="text-[0.62rem] font-bold tracking-[0.28em] uppercase text-primary mb-5">{ui.sectionLabel}</p>
              <h2 className="premium-heading metallic-heading text-4xl lg:text-5xl font-bold leading-[0.95] mb-6">
                {ui.sectionTitle}
              </h2>
              <p className="text-[var(--muted-color)] text-base leading-relaxed mb-8">
                {ui.sectionDescription}
              </p>
              <div className="flex items-center gap-2 text-[var(--muted-color)]">
                <ArrowRight size={14} className="text-primary" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                <span className="text-xs tracking-[0.18em] uppercase font-semibold">{ui.scrollToExplore}</span>
              </div>
            </div>

            {serviceHighlights.map((service, index) => {
              const total = serviceHighlights.length;
              const cardContent = (
                <>
                  <div className="pkg-card__head">
                    <span className="pkg-card__num">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
                  </div>
                  <h3 className="pkg-card__title">{service.title}</h3>
                  <p className="pkg-card__desc line-clamp-2">{service.description}</p>
                  <ul className="pkg-card__features">
                    {service.features.slice(0, 5).map(feat => (
                      <li key={feat}><Check size={15} />{feat}</li>
                    ))}
                    {service.features.length > 5 && (
                      <li>
                        <button onClick={() => setExpandedService(service)} className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity">
                          <ChevronRight size={11} />+{service.features.length - 5} {ui.moreServices}
                        </button>
                      </li>
                    )}
                  </ul>
                  <div className="pkg-card__foot">
                    <div>
                      <span className="pkg-card__price-label">Starting at</span>
                      <span className="pkg-card__price">{service.price != null ? `QR ${service.price}` : '—'}</span>
                    </div>
                    <button onClick={() => navigate(service.link, service.pkg ? { state: { selectedPackage: service.pkg } } : {})} className={service.popular ? 'btn-holo-sm' : 'btn-chrome btn-chrome--sm'}>
                      Book <ArrowRight size={14} />
                    </button>
                  </div>
                  <span className="pkg-card__watermark" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                </>
              );
              return service.popular ? (
                <article key={service.title} className="pkg-card pkg-card--holo flex-shrink-0" style={{ width: '480px' }}>
                  <div className="pkg-card__inner">{cardContent}</div>
                </article>
              ) : (
                <article key={service.title} className="pkg-card pkg-card--showroom flex-shrink-0" style={{ width: '480px' }}>
                  <div className="pkg-card__inner">{cardContent}</div>
                </article>
              );
            })}

            {/* End spacer: wide enough so the last card rests near centre when fully scrolled */}
            <div className="flex-shrink-0" style={{ width: '30vw' }} />
          </div>

          <div className="absolute bottom-10 left-12 right-12 z-30">
            <div className="h-px relative overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div ref={progressRef} style={{
                position: 'absolute', left: 0, top: 0, height: '100%', width: '0%',
                background: `linear-gradient(90deg, ${CARD_ACCENTS[0]}, ${CARD_ACCENTS[1]})`,
                borderRadius: '9999px',
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* ══ SERVICE HIGHLIGHTS — MOBILE ══ */}
      <section className="md:hidden py-8">
        <div className="container mx-auto px-4">
          {serviceHighlights.map((service, index) => {
            const total = serviceHighlights.length;
            const cardContent = (
              <>
                <div className="pkg-card__head">
                  <span className="pkg-card__num">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
                  {service.popular && <span className="pkg-badge">Most Popular</span>}
                </div>
                <h3 className="pkg-card__title">{service.title}</h3>
                <p className="pkg-card__desc">{service.description}</p>
                <ul className="pkg-card__features">
                  {service.features.map(feat => (
                    <li key={feat}><Check size={14} />{feat}</li>
                  ))}
                </ul>
                <div className="pkg-card__foot">
                  <div>
                    <span className="pkg-card__price-label">Starting at</span>
                    <span className="pkg-card__price">{service.price != null ? `QR ${service.price}` : '—'}</span>
                  </div>
                  <button onClick={() => navigate(service.link, service.pkg ? { state: { selectedPackage: service.pkg } } : {})} className={service.popular ? 'btn-holo-sm' : 'btn-chrome btn-chrome--sm'}>
                    Book <ArrowRight size={14} />
                  </button>
                </div>
              </>
            );
            return service.popular ? (
              <article key={service.title} className="pkg-card pkg-card--holo mb-6 last:mb-0">
                <div className="pkg-card__inner">{cardContent}</div>
              </article>
            ) : (
              <article key={service.title} className="pkg-card pkg-card--showroom mb-6 last:mb-0">
                <div className="pkg-card__inner">{cardContent}</div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="py-2 px-0"><div className="spectrum-line" /></div>

      {/* ══ SERVICE AREAS ══ */}
      <section ref={areasSectionRef} className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 areas-heading">
            <h2 className="premium-heading metallic-heading text-3xl md:text-4xl font-bold mb-4">
              {ui.serviceAreasTitle}
            </h2>
            <p className="text-[var(--muted-color)] text-base md:text-lg">{ui.serviceAreasDescription}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {serviceAreas.map((city) => (
              <div key={city}
                className="area-chip glass-card area-chip-glow px-5 py-4 flex items-center gap-2.5 cursor-pointer group"
                style={{ background: 'rgba(200, 210, 235, 0.10)', borderColor: 'rgba(200, 210, 235, 0.20)' }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                  e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                }}>
                <MapPin size={16} className="transition-colors duration-200 group-hover:text-primary" style={{ color: 'var(--muted-color)' }} />
                <span className="text-sm font-semibold text-[var(--heading-color)]">{localizeServiceArea(city, normalizedLang)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ BRAND VALUE ══ */}
      <section className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div ref={brandRef} className="cta-prism-glow rounded-2xl">
            <div className="glass-card p-8 md:p-12 text-center relative overflow-hidden">
              <AdvBubbles dense />
              <h2 className="premium-heading metallic-heading text-3xl md:text-4xl font-bold mb-6 relative z-10">{brandValue.title}</h2>
              <p className="text-base md:text-lg text-[var(--muted-color)] leading-relaxed max-w-3xl mx-auto relative z-10">{brandValue.description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section ref={featuresRef} className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="uppercase tracking-[0.26em] text-primary text-[0.68rem] font-bold mb-3">{ui.featuresLabel}</p>
            <h2 className="premium-heading metallic-heading text-4xl md:text-5xl font-bold">{ui.featuresTitle}</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {homePageContent.features.map((feature, index) => {
              const FeatureIcon = featureIcons[feature.icon] || Star;
              return (
                <div key={feature.key}>
                  <div className="glass-card feature-card p-7 text-center h-full relative overflow-hidden">
      <AdvBubbles />
                    {/* Top accent line per card */}
                    <div className="absolute top-0 left-[20%] right-[20%] h-[1.5px]"
                      style={{ background: index % 2 === 0
                        ? 'linear-gradient(90deg,transparent,color-mix(in srgb,var(--primary) 60%,transparent),transparent)'
                        : 'linear-gradient(90deg,transparent,color-mix(in srgb,var(--secondary) 60%,transparent),transparent)' }} />
                    <span className="absolute top-4 right-4 text-[0.55rem] font-bold tracking-[0.18em]"
                      style={{ color: 'var(--muted-color)', opacity: 0.35 }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className={`${feature.iconBgClass} w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5`}>
                      <FeatureIcon className={feature.iconColorClass} size={26} />
                    </div>
                    <h3 className="premium-heading metallic-heading text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-[var(--muted-color)] text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="py-2 px-0"><div className="spectrum-line" /></div>

      {/* ══ REVIEWS ══ */}
      <section className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12 reveal-up">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={20}
                    style={{
                      color: ['#ff7eb4','#a888ff','#5cc7f5','#8ef7ca','#ff7eb4'][i],
                      fill:  ['#ff7eb4','#a888ff','#5cc7f5','#8ef7ca','#ff7eb4'][i],
                      filter: `drop-shadow(0 0 5px ${ ['rgba(255,126,180,0.6)','rgba(168,136,255,0.6)','rgba(92,199,245,0.6)','rgba(142,247,202,0.6)','rgba(255,126,180,0.6)'][i] })`,
                    }} />
                ))}
              </div>
              <p className="text-xl font-bold text-[var(--heading-color)]">EXCELLENT</p>
            </div>
            <p className="text-[var(--muted-color)] text-sm mb-3">
              Based on <span className="font-semibold text-primary">{reviews.length}+ reviews</span>
            </p>
            <div className="flex flex-col items-center gap-3">
              <img src="https://cdn.trustindex.io/assets/platform/Google/logo-dark.svg" alt="Google Reviews" className="h-8"
                onError={e => { e.target.style.display = 'none'; }} />
              <a href="https://g.page/r/CbY8wgSE0iXGEAE/review" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all duration-200">
                <Star size={14} className="fill-primary" />
                Leave a Review
              </a>
            </div>
          </div>

          {/* Carousel */}
          <div className="reviews-viewport"
            ref={carouselRef}
            onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={() => setIsDragging(false)}
            onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <div className="reviews-track"
              style={{ transform: `translateX(-${currentReviewIndex * (100 / visibleReviewCount)}%)`, transition: 'transform 0.6s cubic-bezier(0.2,0.8,0.2,1)' }}>
              {reviews.map((review) => (
                <div key={review.id} className="reviews-slide" style={{ width: `${100 / visibleReviewCount}%` }}>
                  {theme === 'light' ? (
                    <article className="review-card">
                      <span className="review-card__quote" aria-hidden="true">&ldquo;</span>
                      <div className="review-card__stars" aria-label={`${review.rating ?? 5} out of 5 stars`}>
                        {[...Array(review.rating ?? 5)].map((_, j) => <Star key={j} size={14} />)}
                      </div>
                      <p className="review-card__text">{review.text}</p>
                      <div className="review-card__meta">
                        <div className="review-card__avatar" aria-hidden="true">
                          {review.fallbackInitials || review.author.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="review-card__name">{review.author}</div>
                          <div className="review-card__date">{review.date}</div>
                        </div>
                      </div>
                    </article>
                  ) : (
                    <ReviewCard review={review} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="reviews-controls">
            <button type="button" className="reviews-arrow" aria-label="Previous reviews"
              onClick={handlePrevReview}
              disabled={currentReviewIndex === 0}>
              <ChevronLeft size={18} />
            </button>
            {reviewDotsCount > 1 && (
              <div className="reviews-dots">
                {[...Array(reviewDotsCount)].map((_, i) => (
                  <button key={i} type="button"
                    className={`reviews-dot${i === Math.floor(currentReviewIndex / visibleReviewCount) ? ' reviews-dot--active' : ''}`}
                    aria-label={`Go to review group ${i + 1}`}
                    onClick={() => setCurrentReviewIndex(i * visibleReviewCount)} />
                ))}
              </div>
            )}
            <button type="button" className="reviews-arrow" aria-label="Next reviews"
              onClick={handleNextReview}
              disabled={currentReviewIndex >= Math.max(0, reviews.length - visibleReviewCount)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="text-center mt-3 text-xs" style={{ color: 'var(--primary)' }}>
            {currentReviewIndex + 1}–{Math.min(currentReviewIndex + visibleReviewCount, reviews.length)} of {reviews.length} reviews
          </p>
        </div>
      </section>

      {/* ══ CURATED PACKAGES ══ */}
      <section className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="cta-prism-glow rounded-2xl reveal-up">
            <div className="glass-card p-8 md:p-12 text-center relative overflow-hidden">
              <AdvBubbles dense />
              <div className="flex items-center justify-center gap-3 mb-4">
                <Sparkles className="text-primary" size={22} />
                <h2 className="premium-heading metallic-heading text-4xl md:text-5xl font-bold">{homePageContent.curatedTitle}</h2>
                <Sparkles className="text-primary" size={22} />
              </div>
              <p className="text-[var(--muted-color)] mb-10 text-base md:text-lg max-w-2xl mx-auto">{homePageContent.curatedDescription}</p>
              <Link to="/packages" className="btn-chrome">{homePageContent.curatedCta}<ArrowRight size={20} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <div className="cta-prism-glow rounded-2xl reveal-up">
            <div className="glass-card p-8 md:p-12 text-center relative overflow-hidden">
              <AdvBubbles dense />
              {DOTS.map((d, i) => (
                <div key={i} className="pointer-events-none absolute rounded-full"
                  style={{ top: d.top, left: d.left, right: d.right, width: d.size, height: d.size, background: d.color, animation: `${d.anim} ${6 + i}s ease-in-out ${d.delay} infinite` }} />
              ))}
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-2 mb-5">
                  <Zap className="text-primary" size={18} />
                  <span className="uppercase tracking-[0.24em] text-primary text-[0.68rem] font-bold">Ready to Transform Your Vehicle</span>
                  <Zap className="text-primary" size={18} />
                </div>
                <h2 className="premium-heading metallic-heading text-4xl md:text-5xl font-bold mb-4">{homePageContent.finalTitle}</h2>
                <p className="text-base md:text-lg text-[var(--muted-color)] mb-9 max-w-xl mx-auto">{homePageContent.finalDescription}</p>
                <Link to={finalCtaTarget} className="btn-chrome">{finalCtaLabel}<ArrowRight size={20} /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SERVICE EXPAND MODAL ══ */}
      {expandedService && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={() => setExpandedService(null)}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
          <div
            className="relative z-10 glass-card w-full max-w-lg rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <AdvBubbles />
            {/* Top accent line */}
            <div className="h-[2px] flex-shrink-0"
              style={{ background: `linear-gradient(90deg, transparent, ${CARD_ACCENTS[0]}, ${CARD_ACCENTS[1]}, transparent)` }} />
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
              <h3 className="premium-heading metallic-heading text-xl font-bold leading-tight pr-4">
                {expandedService.title}
              </h3>
              <button
                onClick={() => setExpandedService(null)}
                className="flex-shrink-0 p-1.5 rounded-full border border-[var(--border-color)] hover:border-primary transition-colors"
              >
                <X size={15} className="text-[var(--muted-color)]" />
              </button>
            </div>
            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 pb-6">
              {expandedService.description && (
                <p className="text-sm text-[var(--muted-color)] leading-relaxed mb-6">
                  {expandedService.description}
                </p>
              )}
              <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-primary mb-4">
                What's Included
              </p>
              <ul className="space-y-3 mb-8">
                {expandedService.features.map(feat => (
                  <li key={feat} className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                    <CheckCircle2 size={13} className="text-primary flex-shrink-0" style={{ opacity: 0.8 }} />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={expandedService.link}
                onClick={() => setExpandedService(null)}
                className="btn-chrome inline-flex items-center justify-center gap-2 text-sm w-full"
              >
                {expandedService.cta}<ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══ FLOATING CTA ══ */}
      {!isAdmin && (
        <Link to="/booking" aria-label="Book your detailing service"
          className={`floating-cta-btn${showFloatingCta ? ' visible' : ''}`}>
          <Sparkles size={15} />Book Now
        </Link>
      )}
    </div>
  );
}

export default Home;
