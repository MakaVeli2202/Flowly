import React, { useEffect, useLayoutEffect, useRef, useState, Suspense, lazy } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, useNavigate } from 'react-router-dom';

import {
  ArrowRight, Star, Shield, Clock, Award, Sparkles, Zap,
  MapPin, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2,
  CalendarDays, Car, X, RefreshCw, AlertTriangle,
} from 'lucide-react';
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

/* ── PRISM CSS — Liquid Glass Edition ─────────────────────── */
const PRISM_CSS = `
/* ── Keyframes ── */
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg);          opacity: 0.28; }
  33%      { transform: translate(18px,-24px) rotate(120deg); opacity: 0.55; }
  66%      { transform: translate(-12px,12px) rotate(240deg); opacity: 0.38; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.55),  0 0 32px rgba(255,165,0,.25), 0 0 60px rgba(0,255,100,.18), 0 0 100px rgba(0,100,255,.12); }
  25%      { box-shadow: 0 0 0 1.5px rgba(255,210,0,.55),  0 0 32px rgba(0,255,150,.25), 0 0 60px rgba(0,150,255,.18), 0 0 100px rgba(200,0,255,.12); }
  50%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.55),  0 0 32px rgba(160,0,255,.25), 0 0 60px rgba(255,0,100,.18), 0 0 100px rgba(255,220,0,.12); }
  75%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.55),  0 0 32px rgba(255,0,100,.25), 0 0 60px rgba(255,210,0,.18), 0 0 100px rgba(0,255,150,.12); }
}
@keyframes prism-card-glow {
  0%,100% { box-shadow: 0 0 0 1px rgba(255,100,80,.4),  0 0 24px rgba(255,165,0,.18), 0 0 50px rgba(0,255,100,.14); }
  33%      { box-shadow: 0 0 0 1px rgba(0,160,255,.4),   0 0 24px rgba(160,0,255,.18), 0 0 50px rgba(255,0,100,.14); }
  66%      { box-shadow: 0 0 0 1px rgba(0,255,150,.4),   0 0 24px rgba(255,255,0,.18),  0 0 50px rgba(0,100,255,.14); }
}

/* ── NEW: Liquid glass animations ── */
@keyframes liquid-shimmer {
  0%,100% { background-position: 0% 50%; opacity: 0.75; }
  50%      { background-position: 100% 50%; opacity: 1; }
}
@keyframes rain-drop {
  0%   { transform: translateY(-110%) scaleY(0.6); opacity: 0; }
  8%   { opacity: 0.55; transform: translateY(0%) scaleY(1); }
  80%  { opacity: 0.18; }
  100% { transform: translateY(700%) scaleY(0.4); opacity: 0; }
}
@keyframes wet-pulse {
  0%,100% { opacity: 0.55; }
  50%      { opacity: 0.85; }
}
@keyframes surface-ripple {
  0%   { transform: scale(0); opacity: 0.6; }
  100% { transform: scale(3); opacity: 0; }
}

/* ── Adv bubbles ── */
@keyframes adv-bubble-float {
  0% {
    transform: translate3d(0, 16px, 0) scale(0.88);
    opacity: 0;
  }
  16% {
    transform: translate3d(var(--bubble-drift-a, -4px), 4px, 0) scale(0.98);
    opacity: 0.42;
  }
  44% {
    transform: translate3d(var(--bubble-drift-b, 8px), -12px, 0) scale(1.04);
    opacity: 0.52;
  }
  72% {
    transform: translate3d(var(--bubble-drift-c, -6px), -28px, 0) scale(1.08);
    opacity: 0.44;
  }
  100% {
    transform: translate3d(var(--bubble-drift-d, 4px), -42px, 0) scale(1.14);
    opacity: 0;
  }
}

.adv-card__droplets {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.adv-card__droplet {
  --drop-size: 12px;
  position: absolute;
  opacity: 0;
}

.adv-card__droplet--bubble {
  --drop-scale-x: 1;
  --drop-scale-y: 1;
  --bubble-drift-a: -4px;
  --bubble-drift-b: 8px;
  --bubble-drift-c: -6px;
  --bubble-drift-d: 4px;
  width: var(--drop-size);
  height: var(--drop-size);
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.18) 16%, rgba(164,214,255,0.12) 44%, rgba(236,184,255,0.09) 63%, rgba(120,155,190,0.05) 78%, transparent 100%),
    radial-gradient(circle at 68% 72%, rgba(130,255,220,0.08), transparent 52%);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.22),
    inset 0 -2px 5px rgba(100,130,160,0.10),
    0 0 12px rgba(255,255,255,0.10),
    0 0 20px rgba(184,223,255,0.10);
  filter: blur(0.2px) saturate(1.08);
  animation: adv-bubble-float 8.5s ease-in-out infinite;
}

.adv-card__droplet--bubble::before {
  top: 18%;
  left: 20%;
  width: 30%;
  height: 30%;
  opacity: 0.72;
}

.adv-card__droplet--bubble::after {
  display: none;
}

/* ── Cursor orb ── */
.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(100px); mix-blend-mode: screen;
  will-change: transform, background;
}

/* ══ LIQUID GLASS — .glass-card override ══ */
.glass-card {
  background: rgba(4, 7, 14, 0.44) !important;
  backdrop-filter: blur(36px) saturate(210%) brightness(1.08) !important;
  -webkit-backdrop-filter: blur(36px) saturate(210%) brightness(1.08) !important;
  border: 1px solid rgba(255,255,255,0.09) !important;
  box-shadow:
    inset 0 1.5px 0 rgba(255,255,255,0.14),
    inset 0 -1px 0 rgba(0,0,0,0.14),
    inset -1px 0 0 rgba(255,255,255,0.04),
    0 0 0 0.5px rgba(200,169,107,0.22),
    0 28px 70px rgba(0,0,0,0.55),
    0 0 90px rgba(200,169,107,0.07),
    0 0 60px rgba(14,165,160,0.05) !important;
  position: relative;
}

/* Wet-glass top specular — mimics light through rain-streaked glass */
.lq-top {
  position: absolute; top: 0; left: 0; right: 0; height: 42%; pointer-events: none; z-index: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.025) 55%, transparent 100%);
  border-radius: inherit;
  animation: wet-pulse 7s ease-in-out infinite;
}

/* Iridescent top shimmer line */
.lq-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 1.5px; pointer-events: none; z-index: 1;
  background: linear-gradient(90deg,
    transparent 0%, rgba(200,169,107,0.9) 18%, rgba(255,255,255,1) 38%,
    rgba(14,165,160,0.9) 58%, rgba(200,169,107,0.7) 80%, transparent 100%);
  background-size: 200% 100%;
  animation: liquid-shimmer 5s ease-in-out infinite;
}

/* Rain-drop streak decorators */
.lq-r1, .lq-r2, .lq-r3, .lq-r4 {
  position: absolute; pointer-events: none; z-index: 0;
  width: 1px; border-radius: 999px;
  background: linear-gradient(180deg,
    transparent 0%, rgba(255,255,255,0.50) 35%, rgba(200,169,107,0.28) 70%, transparent 100%);
}
.lq-r1 { animation: rain-drop 3.0s ease-in infinite 0.3s;  height: 65px; top: -65px; left: 12%; }
.lq-r2 { animation: rain-drop 3.8s ease-in infinite 1.5s;  height: 85px; top: -85px; left: 38%; }
.lq-r3 { animation: rain-drop 2.7s ease-in infinite 0.9s;  height: 55px; top: -55px; left: 64%; }
.lq-r4 { animation: rain-drop 4.1s ease-in infinite 2.2s;  height: 75px; top: -75px; left: 82%; }

/* ── Hero glass card ── */
.hero-glass {
  background: rgba(4, 6, 12, 0.48);
  backdrop-filter: blur(36px) saturate(200%) brightness(1.06);
  -webkit-backdrop-filter: blur(36px) saturate(200%) brightness(1.06);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,0.12),
    inset -1px 0 0 rgba(255,255,255,0.035),
    0 0 0 0.5px rgba(200,169,107,0.20),
    0 36px 90px -16px rgba(0,0,0,0.80),
    0 0 130px -28px rgba(200,169,107,0.22),
    0 0 90px  -16px rgba(14,165,160,0.14);
}
.hero-glass::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit; pointer-events: none; z-index: 0;
  background: linear-gradient(
    135deg,
    rgba(255,255,255,0.08) 0%,
    rgba(255,255,255,0.02) 28%,
    transparent 55%,
    rgba(200,169,107,0.05) 100%
  );
}

/* ── Service cards: premium liquid glass ── */
.service-liquid-card,
.service-liquid-card-mobile {
  background: rgba(5, 10, 18, 0.50) !important;
  backdrop-filter: blur(38px) saturate(215%) brightness(1.08) !important;
  -webkit-backdrop-filter: blur(38px) saturate(215%) brightness(1.08) !important;
  border: 1px solid rgba(255,255,255,0.14) !important;
  box-shadow:
    inset 0 1.5px 0 rgba(255,255,255,0.20),
    inset 0 -1px 0 rgba(0,0,0,0.20),
    0 0 0 0.5px rgba(200,169,107,0.24),
    0 32px 72px rgba(0,0,0,0.52),
    0 0 84px rgba(200,169,107,0.10),
    0 0 66px rgba(14,165,160,0.08) !important;
}

.service-liquid-card::before,
.service-liquid-card-mobile::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(
    145deg,
    rgba(255,255,255,0.14) 0%,
    rgba(255,255,255,0.045) 24%,
    transparent 56%,
    rgba(14,165,160,0.05) 100%
  );
}

.service-liquid-card:hover,
.service-liquid-card-mobile:hover {
  border-color: rgba(255,255,255,0.2) !important;
  box-shadow:
    inset 0 1.5px 0 rgba(255,255,255,0.22),
    inset 0 -1px 0 rgba(0,0,0,0.22),
    0 0 0 0.5px rgba(200,169,107,0.32),
    0 36px 88px rgba(0,0,0,0.56),
    0 0 104px rgba(200,169,107,0.14),
    0 0 78px rgba(14,165,160,0.10) !important;
}

/* ── Prism ray ── */
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.065) 15%, rgba(255,200,0,.09) 30%,
    rgba(0,255,145,.08) 50%, rgba(0,145,255,.08) 70%,
    rgba(195,0,255,.06) 85%, transparent 100%);
}

/* ── Prism glass hover ── */
.prism-glass { position: relative; overflow: hidden; transition: box-shadow 0.45s ease; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(
    circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.22) 0%, rgba(80,255,160,.16) 25%,
    rgba(40,130,255,.15) 50%, rgba(200,40,255,.11) 70%, transparent 86%
  );
  opacity: 0; transition: opacity 0.3s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.prism-glass:hover        { animation: prism-card-glow 4s ease-in-out infinite; }

/* ── Area chips ── */
.area-chip-glow { position: relative; overflow: hidden; transition: transform 0.25s ease, box-shadow 0.3s ease; }
.area-chip-glow::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(135deg,rgba(255,0,100,0) 0%,rgba(255,165,0,0) 33%,rgba(0,255,100,0) 66%,rgba(0,150,255,0) 100%);
  opacity: 0; transition: opacity 0.35s, background 0.45s;
}
.area-chip-glow:hover {
  transform: translateY(-4px) scale(1.08); border-color: rgba(255,255,255,.40) !important;
  box-shadow: 0 0 24px rgba(255,100,0,.36), 0 0 44px rgba(0,255,150,.26),
    0 0 64px rgba(0,100,255,.20), inset 0 0 22px rgba(255,220,0,.10);
}
.area-chip-glow:hover::before {
  background: linear-gradient(135deg,rgba(255,0,100,.18) 0%,rgba(255,165,0,.18) 33%,rgba(0,255,100,.18) 66%,rgba(0,150,255,.18) 100%);
  opacity: 1;
}

/* ── Feature cards — static, no hover ── */
.feature-card                { cursor: default; }
.feature-card:hover          { transform: none !important; animation: none !important; }
.feature-card:hover::after   { opacity: 0 !important; }

/* ── Stat holo ── */
.stat-holo { position: relative; overflow: hidden; }
.stat-holo::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(125deg,
    rgba(255,0,100,.11) 0%, rgba(255,165,0,.11) 20%, rgba(255,255,0,.11) 40%,
    rgba(0,255,100,.11) 60%, rgba(0,150,255,.11) 80%, rgba(150,0,255,.11) 100%);
  background-size: 300% 300%;
  animation: holo-sweep 8s ease infinite; mix-blend-mode: screen; opacity: 0; transition: opacity 0.4s;
}
.stat-holo:hover::before { opacity: 1; }

/* ── CTA / spectrum ── */
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; border-radius: inherit; }
.cta-prism-glow > .glass-card {
  border: none !important;
}
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.85) 12%, rgba(255,165,0,.9) 24%,
    rgba(255,255,0,.9) 36%, rgba(0,255,100,.9) 48%,
    rgba(0,150,255,.9) 60%, rgba(150,0,255,.85) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite;
  animation-delay: 0s;
  opacity: 0.55;
  width: 100%;
}

/* ── Review card liquid glass ── */
.review-liquid {
  background: rgba(4,7,14,0.50) !important;
  backdrop-filter: blur(36px) saturate(200%) brightness(1.06) !important;
  -webkit-backdrop-filter: blur(36px) saturate(200%) brightness(1.06) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow:
    inset 0 1.5px 0 rgba(255,255,255,0.12),
    0 0 0 0.5px rgba(200,169,107,0.18),
    0 16px 44px rgba(0,0,0,0.50),
    0 0 60px rgba(200,169,107,0.055) !important;
  position: relative; overflow: hidden;
}
`;

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
      // Shift gently between brand gold (#c8a96b) and brand teal (#0ea5a0)
      const t = mouseX / window.innerWidth;
      const r = Math.round(200 - 186 * t);
      const g = Math.round(169 -   4 * t);
      const b = Math.round(107 +  53 * t);
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
    <div className={`stat-card stat-holo${started ? ' stat-glow' : ''}`}>
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
const CARD_ACCENTS  = ['#c8a96b','#0ea5a0'];
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
  { top: '12%', left: '8%',   size: 3, color: 'rgba(200,169,107,0.5)',  anim: 'floatA', delay: '0s'   },
  { top: '70%', left: '5%',   size: 2, color: 'rgba(14,165,160,0.4)',   anim: 'floatB', delay: '1s'   },
  { top: '30%', right: '6%',  size: 4, color: 'rgba(200,169,107,0.3)',  anim: 'floatB', delay: '0.5s' },
  { top: '80%', right: '10%', size: 2, color: 'rgba(14,165,160,0.5)',   anim: 'floatA', delay: '2s'   },
  { top: '50%', left: '15%',  size: 2, color: 'rgba(255,255,255,0.2)',  anim: 'floatA', delay: '1.5s' },
  { top: '20%', right: '20%', size: 3, color: 'rgba(200,169,107,0.4)',  anim: 'floatB', delay: '3s'   },
  { top: '60%', left: '25%',  size: 2, color: 'rgba(14,165,160,0.3)',   anim: 'floatA', delay: '0.8s' },
  { top: '85%', right: '25%', size: 3, color: 'rgba(200,169,107,0.25)', anim: 'floatB', delay: '2.5s' },
];
const PAGE_BG = `
  radial-gradient(circle at 10% 15%, rgba(200,169,107,0.18), transparent 34%),
  radial-gradient(circle at 85% 8%,  rgba(14,165,160,0.14),  transparent 30%),
  linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)
`.trim();

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

  const howItWorks = HOW_IT_WORKS_BY_LANG[normalizedLang] || HOW_IT_WORKS_BY_LANG.en;
  const brandValue = BRAND_VALUE_BY_LANG[normalizedLang] || BRAND_VALUE_BY_LANG.en;
  const { homePageContent } = getSiteContent(lang);
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
  const [useRealReviews, setUseRealReviews]         = useState(() => {
    // Check if dev flag is enabled, default to true (use real reviews)
    return localStorage.getItem('DEV_REVIEWS_TOGGLE') !== 'true' ? true : false;
  });
  const [reviews, setReviews]                       = useState([]);
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

  // Loading states
  const [loading, setLoading] = useState({
    stats: true,
    reviews: true,
    packages: true,
    services: true,
  });
  
  // Error states with retry
  const [errors, setErrors] = useState({
    stats: null,
    reviews: null,
    packages: null,
    services: null,
  });

  const retryFetch = (type) => {
    setErrors(prev => ({ ...prev, [type]: null }));
    setLoading(prev => ({ ...prev, [type]: true }));
    
    const fetchMap = {
      stats: () => statsAPI.getPublic(),
      reviews: () => reviewsAPI.getPublic(),
      packages: () => packagesAPI.getAll(lang).then(data => data.filter(p => p.isActive)),
      services: () => servicesAPI.getAll(lang).then(data => (data || []).filter(s => s.isActive !== false)),
    };
    
    fetchMap[type]()
      .then(data => {
        if (type === 'stats') setStats(data);
        else if (type === 'reviews') setReviews(data);
        else if (type === 'packages') {
          packageCountRef.current = Array.isArray(data) && data.length > 0 ? data.length : 3;
          setPackages(data);
        } else if (type === 'services') {
          setServices(Array.isArray(data) ? data : []);
        }
      })
      .catch(err => setErrors(prev => ({ ...prev, [type]: err.message })))
      .finally(() => setLoading(prev => ({ ...prev, [type]: false })));
  };

  /* ── Data fetching — parallelized ── */
  useEffect(() => {
    // Handle review fetching with toggle and fallback logic
    const fetchReviews = async () => {
      if (useRealReviews) {
        try {
          const data = await reviewsAPI.getPublic();
          const realReviews = Array.isArray(data) ? data : [];
          // Fallback to hardcoded if no real reviews
          setReviews(realReviews.length > 0 ? realReviews : FALLBACK_REVIEWS);
        } catch {
          // On error, use fallback
          setReviews(FALLBACK_REVIEWS);
        }
      } else {
        // Toggle is OFF: use hardcoded reviews
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
      .then(() => {
        setLoading({ stats: false, reviews: false, packages: false, services: false });
      })
      .catch((err) => {
        console.error('Home page data fetch error:', err);
        setLoading({ stats: false, reviews: false, packages: false, services: false });
      });
  }, [lang, useRealReviews]);

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

  const handleToggleReviews = () => {
    setUseRealReviews(!useRealReviews);
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
    ? packages.map(pkg => ({
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
      }))
    : fallbackHighlights.map(item => ({
        ...item,
        cta: ui.bookNow,
        link: '/booking',
        pkg: null,
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
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      {/* ══ HERO ══ */}
      <section ref={heroSectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* YouTube background video */}
        <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
          <iframe
            className="absolute"
            style={{
              top: '50%',
              left: '50%',
              width: '177.77777778vh',
              height: '56.25vw',
              minWidth: '100%',
              minHeight: '100%',
              transform: 'translate(-50%, -50%)',
              border: 0,
            }}
            src="https://www.youtube.com/embed/ZeES31xz7CE?autoplay=1&mute=1&loop=1&playlist=ZeES31xz7CE&controls=0&showinfo=0&rel=0&modestbranding=1"
            allow="autoplay; encrypted-media"
            title="Hero background"
          />
        </div>

        {/* Cinematic layered overlay — dark vignette + subtle centre window */}
        <div className="absolute inset-0" style={{
          background: [
            'radial-gradient(ellipse 90% 80% at 50% 55%, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.60) 100%)',
            'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 38%, rgba(0,0,0,0.70) 100%)',
          ].join(', '),
        }} />

        {/* Ambient spectral orbs */}
        <div className="absolute -top-28 -right-28 w-[560px] h-[560px] rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.14),rgba(14,165,160,.10),rgba(200,169,107,.08),rgba(14,165,160,.14))', filter: 'blur(88px)', animation: 'spectrum-float 16s ease-in-out infinite' }} />
        <div className="absolute -bottom-36 -left-24 w-[460px] h-[460px] rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 180deg,rgba(14,165,160,.12),rgba(200,169,107,.10),rgba(14,165,160,.10),rgba(200,169,107,.12))', filter: 'blur(88px)', animation: 'spectrum-float 19s ease-in-out 5s infinite' }} />

        <div className="container mx-auto px-4 relative z-10 py-16 md:py-20 flex flex-col items-center">
          <div ref={heroCardRef} className="hero-glass max-w-5xl w-full mx-auto" style={{ willChange: 'transform' }}>
            <AdvBubbles dense />

            {/* Top edge accent line */}
            <div className="absolute top-0 left-[10%] right-[10%] h-[1.5px] hero-animate hero-animate-1"
              style={{ background: 'linear-gradient(90deg,transparent,#c8a96b 30%,#0ea5a0 70%,transparent)' }} />

            <div className="relative z-10 px-8 md:px-16 py-10 md:py-12 text-center flex flex-col items-center">
              {/* Logo */}
              <div className="mb-6 hero-animate hero-animate-1">
                <img src={getBusiness().logo || '/GlanzLogo.png'} alt="Glanz" className="h-14 sm:h-16 md:h-20 w-auto object-contain mx-auto" />
              </div>

              {/* Badge */}
              <div className="flex items-center gap-3 mb-6 hero-animate hero-animate-1">
                <span className="flex-shrink-0 h-px w-12" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
                <p className="uppercase tracking-[0.30em] text-primary text-[0.68rem] font-bold whitespace-nowrap">{homePageContent.badge}</p>
                <span className="flex-shrink-0 h-px w-12" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
              </div>

              {/* Headline — larger, more cinematic */}
              <h1 className="premium-heading text-6xl sm:text-7xl md:text-8xl font-bold mb-7 leading-[0.90] text-white tracking-tight">
                <WordReveal text={homePageContent.title} baseDelay={0.12} />
              </h1>

              {/* Horizontal gold rule under headline */}
              <div className="w-20 h-px mb-7 hero-animate hero-animate-2"
                style={{ background: 'linear-gradient(90deg,transparent,#c8a96b,transparent)' }} />

              {/* Description */}
              <p className="text-base md:text-lg text-white/75 mb-10 max-w-2xl leading-relaxed hero-animate hero-animate-3">
                {homePageContent.description}
              </p>

              {/* CTAs — centred */}
              <div className="flex flex-wrap justify-center gap-4 mb-8 hero-animate hero-animate-4">
                <Link to={primaryCtaTarget} className="premium-btn text-base px-8 py-4">{primaryCtaLabel}<ArrowRight size={18} /></Link>
                <Link to={secondaryCtaTarget} className="secondary-cta text-base">{secondaryCtaLabel}</Link>
              </div>

              {/* Trust strip — centred */}
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

        {/* Scroll indicator */}
        <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-2 hero-animate hero-animate-4">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.18)' }}>
            <ChevronDown size={14} className="text-white/40 animate-bounce" />
          </div>
          <span className="text-white/30 text-[0.55rem] tracking-[0.22em] uppercase font-semibold">{ui.heroScroll}</span>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="py-[14px] border-y border-[var(--border-color)]"
        style={{ background: 'color-mix(in srgb, var(--surface-bg-alt) 70%, transparent)' }} aria-hidden="true">
        <div className="marquee-outer">
          {loading.services ? (
            <LoadingCircle label="Loading services..." className="py-2" sizeClass="h-6 w-6" />
          ) : (
            <div className="marquee-inner" style={{ animationDuration: `${marqueeDuration}s` }}>
              {marqueeItems.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2.5 px-5 text-[0.72rem] font-semibold tracking-[0.18em] uppercase whitespace-nowrap" style={{ color: 'var(--muted-color)' }}>
                  <span style={{ color: '#c8a96b', fontSize: '0.9rem', lineHeight: 1 }}>✦</span>{item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ STATS ══ */}
      <section className="py-8 md:py-10" ref={statsRef}>
        <div className="container mx-auto px-4">
          {loading.stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="glass-card p-6 text-center">
                  <Skeleton variant="text" className="w-16 h-10 mx-auto mb-2" />
                  <Skeleton variant="text" className="w-24 h-4 mx-auto" />
                </div>
              ))}
            </div>
          ) : errors.stats ? (
            <EmptyState
              icon="alert"
              title="Failed to load stats"
              description={errors.stats}
              actionLabel="Try Again"
              onAction={() => retryFetch('stats')}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard number={stats.happyClients} suffix="+"   label={ui.statsHappyClients}      started={statsStarted} />
              <StatCard number={stats.carsDetailed} suffix="+"   label={ui.statsCarsDetailed}       started={statsStarted} />
              <StatCard number={4}                  suffix=".9★" label={ui.statsAverageRating}      started={statsStarted} />
              <StatCard number={stats.yearsActive}  suffix="+"   label={ui.statsYearsExcellence} started={statsStarted} />
            </div>
          )}
        </div>
      </section>

      <div className="py-3 px-0"><div className="spectrum-line" /></div>

      {/* ══ HOW IT WORKS ══ */}
      <section ref={processRef} className="py-10 md:py-14">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 process-heading">
            <p className="uppercase tracking-[0.26em] text-primary text-[0.68rem] font-bold mb-3">{ui.howItWorksLabel}</p>
            <h2 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.howItWorksTitle}</h2>
            <p className="text-[var(--muted-color)] text-base md:text-lg mt-4 max-w-xl mx-auto leading-relaxed">
              {ui.howItWorksDescription}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
            <div className="hidden md:block absolute top-[3.5rem] left-[calc(33.33%_+_2rem)] right-[calc(33.33%_+_2rem)] h-px"
              style={{ background: 'linear-gradient(90deg, rgba(200,169,107,0.5), rgba(14,165,160,0.5))' }} />
            {howItWorks.map((item, i) => {
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
                      style={{ background: `${item.accent}18`, border: `1px solid ${item.accent}28` }}>
                      <StepIcon size={22} style={{ color: item.accent }} />
                    </div>
                    <h3 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-3">{item.title}</h3>
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
            <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
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
              <h2 className="premium-heading text-4xl lg:text-5xl font-bold text-[var(--heading-color)] leading-[0.95] mb-6">
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

            {loading.packages ? (
              <div className="w-[50vw] min-w-[520px] flex-shrink-0">
                <LoadingCircle label="Loading services..." className="h-[420px]" sizeClass="h-10 w-10" />
              </div>
            ) : serviceHighlights.map((service, index) => {
              const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
              return (
              <div
                key={service.title}
                className="service-h-card service-liquid-card glass-card prism-glass flex-shrink-0 flex flex-col justify-between relative overflow-hidden"
                style={{ width: '500px', height: '540px', padding: '40px' }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                  e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                }}
              >
                <AdvBubbles dense />
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}, ${accent === '#c8a96b' ? '#fff' : '#c8a96b'}, ${accent}, transparent)`, animation: 'liquid-shimmer 5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
                <span className="absolute bottom-4 right-6 font-black pointer-events-none select-none"
                  style={{ fontSize: '9rem', lineHeight: 1, color: accent, opacity: 0.045 }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-[0.6rem] font-bold tracking-[0.2em] uppercase"
                    style={{ border: `1px solid ${accent}45`, color: accent, background: `${accent}12` }}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h3 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-4 leading-tight">{service.title}</h3>
                  <p className="text-sm text-[var(--muted-color)] leading-relaxed mb-6 line-clamp-3">{service.description}</p>
                </div>
                <div className="relative z-10">
                  <ul className="space-y-2.5 mb-4">
                    {service.features.slice(0, 4).map(feat => (
                      <li key={feat} className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                        <CheckCircle2 size={13} className="text-primary flex-shrink-0" style={{ opacity: 0.8 }} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {service.features.length > 4 && (
                    <button
                      onClick={() => setExpandedService(service)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:opacity-70 transition-opacity mb-5"
                    >
                      <ChevronRight size={12} />
                      +{service.features.length - 4} {ui.moreServices}
                    </button>
                  )}
                  <div className="flex items-center gap-3 mt-auto">
                    <button
                      onClick={() => navigate(service.link, service.pkg ? { state: { selectedPackage: service.pkg } } : {})}
                      className="premium-btn inline-flex items-center gap-2 text-sm"
                    >
                      {service.cta}<ArrowRight size={15} />
                    </button>
                    <button
                      onClick={() => setExpandedService(service)}
                      className="text-xs text-[var(--muted-color)] hover:text-primary transition-colors underline underline-offset-2"
                    >
                      {ui.viewAllDetails}
                    </button>
                  </div>
                </div>
              </div>
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
          {loading.packages ? (
            <LoadingCircle label="Loading services..." className="min-h-[220px]" sizeClass="h-10 w-10" />
          ) : serviceHighlights.map((service, index) => (
            <div key={service.title} className="mb-20 last:mb-0 flex flex-col gap-10" dir="ltr" style={{ direction: 'ltr' }}>
              <div className="flex-1">
                <h2 className="premium-heading text-3xl font-bold text-[var(--heading-color)] mb-6">{service.title}</h2>
                <p className="text-base text-[var(--muted-color)] leading-relaxed mb-8">{service.description}</p>
                <button
                  onClick={() => navigate(service.link, service.pkg ? { state: { selectedPackage: service.pkg } } : {})}
                  className="premium-btn inline-flex items-center gap-2"
                >{service.cta}<ArrowRight size={18} /></button>
              </div>
               <div className="service-liquid-card-mobile glass-card p-7 relative overflow-hidden">
                <AdvBubbles />
                <p className="text-[0.62rem] font-bold tracking-[0.22em] uppercase text-primary mb-5 relative z-10">{ui.whatsIncluded}</p>
                <ul className="space-y-3.5 relative z-10">
                  {service.features.map(feat => (
                    <li key={feat} className="flex items-center gap-3 text-sm text-[var(--text-color)]">
                      <CheckCircle2 size={14} className="text-primary flex-shrink-0" style={{ opacity: 0.8 }} /><span>{feat}</span>
                    </li>
                  ))}
                 </ul>
                 </div>
            </div>
          ))}
        </div>
      </section>

      <div className="py-2 px-0"><div className="spectrum-line" /></div>

      {/* ══ SERVICE AREAS ══ */}
      <section ref={areasSectionRef} className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 areas-heading">
            <h2 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-4">
              {ui.serviceAreasTitle}
            </h2>
            <p className="text-[var(--muted-color)] text-base md:text-lg">{ui.serviceAreasDescription}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {serviceAreas.map((city) => (
              <div key={city}
                className="area-chip glass-card area-chip-glow px-5 py-4 flex items-center gap-2.5 cursor-pointer group"
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
              <h2 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-6 relative z-10">{brandValue.title}</h2>
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
            <h2 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.featuresTitle}</h2>
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
                        ? 'linear-gradient(90deg,transparent,rgba(200,169,107,0.6),transparent)'
                        : 'linear-gradient(90deg,transparent,rgba(14,165,160,0.6),transparent)' }} />
                    <span className="absolute top-4 right-4 text-[0.55rem] font-bold tracking-[0.18em]"
                      style={{ color: 'var(--muted-color)', opacity: 0.35 }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className={`${feature.iconBgClass} w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5`}>
                      <FeatureIcon className={feature.iconColorClass} size={26} />
                    </div>
                    <h3 className="premium-heading text-xl font-bold mb-2 text-[var(--heading-color)]">{feature.title}</h3>
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
          <div className="text-center mb-12 reveal-up">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="flex gap-1">{[...Array(5)].map((_, i) => <Star key={i} size={20} className="fill-primary text-primary" />)}</div>
              <p className="text-xl font-bold text-[var(--heading-color)]">EXCELLENT</p>
            </div>
            <p className="text-[var(--muted-color)] text-sm mb-3">
              Based on <span className="font-semibold text-primary">{reviews.length}+ reviews</span>
            </p>
            <div className="flex flex-col items-center gap-3">
              <img src="https://cdn.trustindex.io/assets/platform/Google/logo-dark.svg" alt="Google Reviews" className="h-8"
                onError={e => { e.target.style.display = 'none'; }} />
              <div className="flex items-center gap-3">
                <a
                  href="https://g.page/r/CbY8wgSE0iXGEAE/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  <Star size={14} className="fill-primary" />
                  Leave a Review
                </a>
                {import.meta.env.DEV && (
                  <button
                    onClick={handleToggleReviews}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-yellow-500/40 bg-yellow-500/5 text-yellow-600 hover:bg-yellow-500/10 transition-all duration-200"
                    title="Toggle between real API reviews and hardcoded fallback reviews (dev mode only)"
                  >
                    {useRealReviews ? '🔴 REAL' : '🟡 HARDCODED'}
                  </button>
                )}
              </div>
            </div>
          </div>
          {loading.reviews ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : errors.reviews ? (
            <EmptyState
              icon="alert"
              title="Failed to load reviews"
              description={errors.reviews}
              actionLabel="Try Again"
              onAction={() => retryFetch('reviews')}
            />
          ) : reviews.length === 0 ? (
            <EmptyState
              icon="star"
              title="No reviews yet"
              description="Be the first to review our service!"
            />
          ) : (
            <div>
              <div className="-mx-3">
                <div ref={carouselRef} className="overflow-hidden"
                  onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={() => setIsDragging(false)}
                  onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
                  <div className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentReviewIndex * (100 / visibleReviewCount)}%)` }}>
                    {reviews.map(review => (
                      <div key={review.id} className="flex-shrink-0 px-3" style={{ width: `${100 / visibleReviewCount}%` }}>
                        <ReviewCard review={review} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-8">
                <button onClick={handlePrevReview} aria-label="Previous reviews"
                  className="p-2.5 rounded-full border border-[var(--border-color)] bg-[var(--cta-soft-bg)] text-[var(--text-color)] hover:bg-primary hover:text-[#101823] hover:border-primary transition-all duration-200">
                  <ChevronLeft size={18} />
                </button>
                {reviewDotsCount > 1 && (
                  <div className="flex items-center gap-2">
                    {[...Array(reviewDotsCount)].map((_, i) => (
                      <button key={i} onClick={() => setCurrentReviewIndex(i * visibleReviewCount)} aria-label={`Go to review group ${i + 1}`}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          i === Math.floor(currentReviewIndex / visibleReviewCount) ? 'bg-primary w-6' : 'bg-[var(--border-color)] w-2 hover:bg-primary/50'
                        }`} />
                    ))}
                  </div>
                )}
                <button onClick={handleNextReview} aria-label="Next reviews"
                  className="p-2.5 rounded-full border border-[var(--border-color)] bg-[var(--cta-soft-bg)] text-[var(--text-color)] hover:bg-primary hover:text-[#101823] hover:border-primary transition-all duration-200">
                  <ChevronRight size={18} />
                </button>
              </div>
              <p className="text-center mt-3 text-xs text-[var(--muted-color)]">
                {currentReviewIndex + 1}–{Math.min(currentReviewIndex + visibleReviewCount, reviews.length)} of {reviews.length} reviews
              </p>
            </div>
          )}
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
                <h2 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{homePageContent.curatedTitle}</h2>
                <Sparkles className="text-primary" size={22} />
              </div>
              <p className="text-[var(--muted-color)] mb-10 text-base md:text-lg max-w-2xl mx-auto">{homePageContent.curatedDescription}</p>
              <Link to="/packages" className="premium-btn">{homePageContent.curatedCta}<ArrowRight size={20} /></Link>
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
                <h2 className="premium-heading text-4xl md:text-5xl font-bold mb-4 text-[var(--heading-color)]">{homePageContent.finalTitle}</h2>
                <p className="text-base md:text-lg text-[var(--muted-color)] mb-9 max-w-xl mx-auto">{homePageContent.finalDescription}</p>
                <Link to={finalCtaTarget} className="premium-btn">{finalCtaLabel}<ArrowRight size={20} /></Link>
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
              <h3 className="premium-heading text-xl font-bold text-[var(--heading-color)] leading-tight pr-4">
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
                className="premium-btn inline-flex items-center justify-center gap-2 text-sm w-full"
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
          className={`floating-cta-btn premium-btn${showFloatingCta ? ' visible' : ''}`}>
          <Sparkles size={15} />Book Now
        </Link>
      )}
    </div>
  );
}

export default Home;
