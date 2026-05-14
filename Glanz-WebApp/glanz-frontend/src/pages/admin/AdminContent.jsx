import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, RotateCcw, ArrowLeft, Home, Package, Calendar, CheckCircle, FileEdit } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { defaultSiteContent, getSiteContent, resetSiteContent, saveSiteContent } from '../../config/siteContent';

/* ── data mappers (logic unchanged) ───────────────────────── */
const mapContentToForm = (content) => ({
  homeBadge:                  content.homePageContent.badge,
  homeTitle:                  content.homePageContent.title,
  homeDescription:            content.homePageContent.description,
  homePrimaryCta:             content.homePageContent.primaryCta,
  homeSecondaryCta:           content.homePageContent.secondaryCta,
  homeCuratedTitle:           content.homePageContent.curatedTitle,
  homeCuratedDescription:     content.homePageContent.curatedDescription,
  homeCuratedCta:             content.homePageContent.curatedCta,
  homeFinalTitle:             content.homePageContent.finalTitle,
  homeFinalDescription:       content.homePageContent.finalDescription,
  homeFinalCta:               content.homePageContent.finalCta,
  packagesTitle:              content.packagesPageContent.title,
  packagesSubtitle:           content.packagesPageContent.subtitle,
  packagesAllTierLabel:       content.packagesPageContent.allTierLabel,
  packagesEmptyTierMessage:   content.packagesPageContent.emptyTierMessage,
  packagesIncludesLabel:      content.packagesPageContent.includesLabel,
  packagesFromOnlyLabel:      content.packagesPageContent.fromOnlyLabel,
  packagesMoreServicesText:   content.packagesPageContent.moreServicesText,
  bookingEarliestOffsetDays:  String(content.bookingPageConfig.earliestBookingOffsetDays),
  bookingTimeSlots:           content.bookingPageConfig.timeSlots.join(', '),
});

const mapFormToContent = (formState) => {
  const parsedDays = Number.parseInt(formState.bookingEarliestOffsetDays, 10);
  const timeSlots  = formState.bookingTimeSlots.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    homePageContent: {
      ...defaultSiteContent.homePageContent,
      badge:              formState.homeBadge,
      title:              formState.homeTitle,
      description:        formState.homeDescription,
      primaryCta:         formState.homePrimaryCta,
      secondaryCta:       formState.homeSecondaryCta,
      curatedTitle:       formState.homeCuratedTitle,
      curatedDescription: formState.homeCuratedDescription,
      curatedCta:         formState.homeCuratedCta,
      finalTitle:         formState.homeFinalTitle,
      finalDescription:   formState.homeFinalDescription,
      finalCta:           formState.homeFinalCta,
      features:           defaultSiteContent.homePageContent.features,
    },
    packagesPageContent: {
      ...defaultSiteContent.packagesPageContent,
      title:            formState.packagesTitle,
      subtitle:         formState.packagesSubtitle,
      allTierLabel:     formState.packagesAllTierLabel,
      emptyTierMessage: formState.packagesEmptyTierMessage,
      includesLabel:    formState.packagesIncludesLabel,
      fromOnlyLabel:    formState.packagesFromOnlyLabel,
      moreServicesText: formState.packagesMoreServicesText,
    },
    bookingPageConfig: {
      ...defaultSiteContent.bookingPageConfig,
      earliestBookingOffsetDays: Number.isNaN(parsedDays) ? 1 : Math.max(0, parsedDays),
      timeSlots: timeSlots.length > 0 ? timeSlots : defaultSiteContent.bookingPageConfig.timeSlots,
    },
  };
};

/* ── PRISM CSS ─────────────────────────────────────────────── */
const PRISM_CSS = `
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
  0%,100% { transform: translate(0,0) rotate(0deg);           opacity: 0.18; }
  33%      { transform: translate(12px,-14px) rotate(120deg); opacity: 0.30; }
  66%      { transform: translate(-7px,8px)   rotate(240deg); opacity: 0.22; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.42),  0 0 22px rgba(255,165,0,.15); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.42),  0 0 22px rgba(160,0,255,.15); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.42),  0 0 22px rgba(255,0,100,.15); }
}
@keyframes card-enter {
  from { transform: translateY(14px) scale(0.988); opacity: 0; }
  to   { transform: translateY(0)    scale(1);     opacity: 1; }
}
@keyframes status-pop {
  0%   { transform: translateY(6px) scale(0.95); opacity: 0; }
  100% { transform: translateY(0)   scale(1);    opacity: 1; }
}

.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(90px); mix-blend-mode: screen;
  will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.03) 15%, rgba(255,200,0,.045) 30%,
    rgba(0,255,145,.038) 50%, rgba(0,145,255,.038) 70%,
    rgba(195,0,255,.03) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.11) 0%, rgba(80,255,160,.08) 30%,
    rgba(40,130,255,.08) 55%, transparent 80%);
  opacity: 0; transition: opacity 0.35s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.80) 12%, rgba(255,165,0,.85) 24%,
    rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.40;
}
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.card-stagger   { animation: card-enter 0.55s cubic-bezier(0.22,1,0.36,1) both; }
.status-pop     { animation: status-pop 0.38s cubic-bezier(0.22,1,0.36,1) both; }

.field-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--surface-bg);
  color: var(--text-color);
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
  resize: none;
}
.field-input:focus {
  border-color: rgba(200,169,107,0.65);
  box-shadow: 0 0 0 3px rgba(200,169,107,0.12);
}
.field-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted-color);
  margin-bottom: 7px;
}
`;

/* ── Cursor orb ─────────────────────────────────────────────── */
function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let cx = mx, cy = my, rafId;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      const hue = (mx / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 480, height: 480, top: '-240px', left: '-240px' }} />;
}

/* ── FormField ───────────────────────────────────────────────── */
function FormField({ label, hint, children }) {
  return (
    <div className="space-y-0">
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="mt-2 text-[11px] text-[var(--muted-color)] leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ── FormSection ─────────────────────────────────────────────── */
function FormSection({ title, badge, icon, accentColor, rayDelay = '3s', delay = '0s', children }) {
  const Icon = icon;
  return (
    <section
      className="glass-card relative overflow-hidden card-stagger"
      style={{ animationDelay: delay }}
    >
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 w-[3px] h-full"
        style={{ background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}44 60%, transparent 100%)` }} />
      {/* Prism ray */}
      <div className="prism-ray"
        style={{ left: '72%', width: '11%', animation: `prism-ray-sweep 20s ease-in-out ${rayDelay} infinite` }} />

      <div className="p-7">
        {/* Section header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}16`, border: `1px solid ${accentColor}30` }}>
            <Icon size={18} style={{ color: accentColor }} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="h-px w-4" style={{ background: `linear-gradient(90deg, transparent, ${accentColor})` }} />
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em]" style={{ color: accentColor }}>{badge}</p>
              <span className="h-px w-4" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
            </div>
            <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)]">{title}</h2>
          </div>
        </div>
        <div className="mb-5"><div className="spectrum-line" /></div>

        <div className="space-y-5">{children}</div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   CONTENT EDITOR
════════════════════════════════════════════════════════════ */
function ContentEditor() {
  const { t, lang } = useLanguage();
  const uiByLang = {
    en: {
      contentEditor: 'Content Editor',
      subtitle: 'Edit home, packages, and booking page content from one place.',
      dashboard: 'Dashboard',
      homePage: 'Home Page',
      heroCtas: 'Hero & CTAs',
      badgeText: 'Badge Text',
      heroTitle: 'Hero Title',
      heroDescription: 'Hero Description',
      primaryCta: 'Primary CTA',
      secondaryCta: 'Secondary CTA',
      curatedSection: 'Curated Section',
      curatedTitle: 'Curated Title',
      curatedCta: 'Curated CTA',
      curatedDescription: 'Curated Description',
      finalCtaSection: 'Final CTA Section',
      finalTitle: 'Final Title',
      finalCtaButton: 'Final CTA Button',
      finalDescription: 'Final Description',
      packagesPage: 'Packages Page',
      labelsCopy: 'Labels & Copy',
      pageTitle: 'Page Title',
      pageSubtitle: 'Page Subtitle',
      allTierLabel: 'All Tier Label',
      emptyTierMessage: 'Empty Tier Message',
      includesLabel: 'Includes Label',
      fromPriceLabel: 'From Price Label',
      moreServicesText: 'More Services Text',
      bookingPage: 'Booking Page',
      config: 'Config',
      earliestOffset: 'Earliest Booking Offset (Days)',
      earliestOffsetHint: 'Minimum number of days in the future customers can book. 0 = same day allowed.',
      timeSlots: 'Available Time Slots',
      timeSlotsHint: 'Comma-separated list, e.g. 09:00-10:00, 10:00-11:00. Prices live in Manage Packages.',
      saveChanges: 'Save Changes',
      resetDefaults: 'Reset Defaults',
      saveSuccess: 'Changes saved successfully.',
      resetSuccess: 'Content reset to defaults.',
    },
    ar: {
      contentEditor: 'محرر المحتوى',
      subtitle: 'قم بتعديل محتوى الصفحة الرئيسية والباقات والحجز من مكان واحد.',
      dashboard: 'لوحة التحكم',
      homePage: 'الصفحة الرئيسية',
      heroCtas: 'الهيرو وأزرار الدعوة',
      badgeText: 'نص الشارة',
      heroTitle: 'عنوان الهيرو',
      heroDescription: 'وصف الهيرو',
      primaryCta: 'زر الدعوة الأساسي',
      secondaryCta: 'زر الدعوة الثانوي',
      curatedSection: 'قسم المحتوى المميز',
      curatedTitle: 'عنوان القسم المميز',
      curatedCta: 'زر القسم المميز',
      curatedDescription: 'وصف القسم المميز',
      finalCtaSection: 'قسم الدعوة النهائي',
      finalTitle: 'العنوان النهائي',
      finalCtaButton: 'زر الدعوة النهائي',
      finalDescription: 'الوصف النهائي',
      packagesPage: 'صفحة الباقات',
      labelsCopy: 'التسميات والنصوص',
      pageTitle: 'عنوان الصفحة',
      pageSubtitle: 'العنوان الفرعي',
      allTierLabel: 'تسمية كل الفئات',
      emptyTierMessage: 'رسالة الفئة الفارغة',
      includesLabel: 'تسمية يشمل',
      fromPriceLabel: 'تسمية يبدأ من',
      moreServicesText: 'نص خدمات إضافية',
      bookingPage: 'صفحة الحجز',
      config: 'الإعدادات',
      earliestOffset: 'أقرب موعد حجز (بالأيام)',
      earliestOffsetHint: 'الحد الأدنى لعدد الأيام قبل الحجز. 0 يعني السماح بالحجز في نفس اليوم.',
      timeSlots: 'الفترات الزمنية المتاحة',
      timeSlotsHint: 'قائمة مفصولة بفواصل مثل 09:00-10:00, 10:00-11:00. الأسعار في إدارة الباقات.',
      saveChanges: 'حفظ التغييرات',
      resetDefaults: 'إعادة القيم الافتراضية',
      saveSuccess: 'تم حفظ التغييرات بنجاح.',
      resetSuccess: 'تمت إعادة المحتوى إلى الإعدادات الافتراضية.',
    },
    de: {
      contentEditor: 'Content-Editor',
      subtitle: 'Bearbeite Inhalte fur Startseite, Pakete und Buchung an einem Ort.',
      dashboard: 'Dashboard',
      homePage: 'Startseite',
      heroCtas: 'Hero & CTAs',
      badgeText: 'Badge-Text',
      heroTitle: 'Hero-Titel',
      heroDescription: 'Hero-Beschreibung',
      primaryCta: 'Primarer CTA',
      secondaryCta: 'Sekundarer CTA',
      curatedSection: 'Kuratierten Bereich',
      curatedTitle: 'Kuratierter Titel',
      curatedCta: 'Kuratierter CTA',
      curatedDescription: 'Kuratiere Beschreibung',
      finalCtaSection: 'Finaler CTA-Bereich',
      finalTitle: 'Finaler Titel',
      finalCtaButton: 'Finaler CTA-Button',
      finalDescription: 'Finale Beschreibung',
      packagesPage: 'Pakete-Seite',
      labelsCopy: 'Labels & Texte',
      pageTitle: 'Seitentitel',
      pageSubtitle: 'Untertitel',
      allTierLabel: 'Label fur alle Stufen',
      emptyTierMessage: 'Leere-Stufe-Nachricht',
      includesLabel: 'Enthalt-Label',
      fromPriceLabel: 'Ab-Preis-Label',
      moreServicesText: 'Text fur weitere Services',
      bookingPage: 'Buchungsseite',
      config: 'Konfiguration',
      earliestOffset: 'Fruhester Buchungsoffset (Tage)',
      earliestOffsetHint: 'Minimale Anzahl Tage in der Zukunft fur Buchungen. 0 = gleiche Tag erlaubt.',
      timeSlots: 'Verfugbare Zeitfenster',
      timeSlotsHint: 'Kommagetrennte Liste, z. B. 09:00-10:00, 10:00-11:00. Preise in Pakete-Verwaltung.',
      saveChanges: 'Anderungen speichern',
      resetDefaults: 'Standardwerte zurucksetzen',
      saveSuccess: 'Anderungen erfolgreich gespeichert.',
      resetSuccess: 'Inhalte auf Standardwerte zuruckgesetzt.',
    },
  };
  const ui = uiByLang[lang] || uiByLang.en;
  const initialContent = useMemo(() => getSiteContent(), []);
  const [formState, setFormState] = useState(() => mapContentToForm(initialContent));
  const [status,    setStatus]    = useState('');

  const updateField = (name, value) => setFormState((prev) => ({ ...prev, [name]: value }));

  const handleSave = (event) => {
    event.preventDefault();
    saveSiteContent(mapFormToContent(formState));
    setStatus(ui.saveSuccess);
    setTimeout(() => setStatus(''), 5000);
  };
  const handleReset = () => {
    setFormState(mapContentToForm(resetSiteContent()));
    setStatus(ui.resetSuccess);
    setTimeout(() => setStatus(''), 5000);
  };

  /* Shared input class (used inline where we can't use the CSS class) */
  const inp = 'field-input';

  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{
          background: `
            radial-gradient(circle at 6% 8%, rgba(200,169,107,0.05) 0%, transparent 38%),
            radial-gradient(circle at 94% 92%, rgba(14,165,160,0.04) 0%, transparent 32%)
          `,
        }}
      >
        {/* Backdrop orb */}
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background: 'conic-gradient(from 60deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter: 'blur(80px)', animation: 'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 max-w-4xl relative z-10">

          {/* ── Page header ──────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                <p className="text-[0.60rem] font-bold uppercase tracking-[0.26em] text-primary">{t('adminPanel')}</p>
                <span className="h-px w-7" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
              </div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(200,169,107,0.12)', border: '1px solid rgba(200,169,107,0.24)' }}>
                  <FileEdit size={16} style={{ color: '#c8a96b' }} />
                </div>
                <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.contentEditor}</h1>
              </div>
              <p className="text-sm text-[var(--muted-color)] ml-12">{ui.subtitle}</p>
            </div>
            <Link to="/admin"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition flex-shrink-0">
              <ArrowLeft size={14} /> {ui.dashboard}
            </Link>
          </div>

          {/* ── Form ─────────────────────────────────────── */}
          <form onSubmit={handleSave} className="space-y-6">

            {/* Home page */}
            <FormSection title={ui.homePage} badge={ui.heroCtas} icon={Home} accentColor="#c8a96b" rayDelay="2s" delay="0.05s">
              <div className="grid md:grid-cols-2 gap-5">
                <FormField label={ui.badgeText}>
                  <input className={inp} value={formState.homeBadge}
                    onChange={(e) => updateField('homeBadge', e.target.value)} />
                </FormField>
                <FormField label={ui.heroTitle}>
                  <input className={inp} value={formState.homeTitle}
                    onChange={(e) => updateField('homeTitle', e.target.value)} />
                </FormField>
              </div>
              <FormField label={ui.heroDescription}>
                <textarea className={inp} rows={3} value={formState.homeDescription}
                  onChange={(e) => updateField('homeDescription', e.target.value)} />
              </FormField>
              <div className="grid md:grid-cols-2 gap-5">
                <FormField label={ui.primaryCta}>
                  <input className={inp} value={formState.homePrimaryCta}
                    onChange={(e) => updateField('homePrimaryCta', e.target.value)} />
                </FormField>
                <FormField label={ui.secondaryCta}>
                  <input className={inp} value={formState.homeSecondaryCta}
                    onChange={(e) => updateField('homeSecondaryCta', e.target.value)} />
                </FormField>
              </div>

              {/* Divider for curated section */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.curatedSection}</p>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <FormField label={ui.curatedTitle}>
                  <input className={inp} value={formState.homeCuratedTitle}
                    onChange={(e) => updateField('homeCuratedTitle', e.target.value)} />
                </FormField>
                <FormField label={ui.curatedCta}>
                  <input className={inp} value={formState.homeCuratedCta}
                    onChange={(e) => updateField('homeCuratedCta', e.target.value)} />
                </FormField>
              </div>
              <FormField label={ui.curatedDescription}>
                <textarea className={inp} rows={2} value={formState.homeCuratedDescription}
                  onChange={(e) => updateField('homeCuratedDescription', e.target.value)} />
              </FormField>

              {/* Divider for final CTA section */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.finalCtaSection}</p>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <FormField label={ui.finalTitle}>
                  <input className={inp} value={formState.homeFinalTitle}
                    onChange={(e) => updateField('homeFinalTitle', e.target.value)} />
                </FormField>
                <FormField label={ui.finalCtaButton}>
                  <input className={inp} value={formState.homeFinalCta}
                    onChange={(e) => updateField('homeFinalCta', e.target.value)} />
                </FormField>
              </div>
              <FormField label={ui.finalDescription}>
                <textarea className={inp} rows={2} value={formState.homeFinalDescription}
                  onChange={(e) => updateField('homeFinalDescription', e.target.value)} />
              </FormField>
            </FormSection>

            {/* Packages page */}
            <FormSection title={ui.packagesPage} badge={ui.labelsCopy} icon={Package} accentColor="#0ea5a0" rayDelay="7s" delay="0.12s">
              <div className="grid md:grid-cols-2 gap-5">
                <FormField label={ui.pageTitle}>
                  <input className={inp} value={formState.packagesTitle}
                    onChange={(e) => updateField('packagesTitle', e.target.value)} />
                </FormField>
                <FormField label={ui.pageSubtitle}>
                  <input className={inp} value={formState.packagesSubtitle}
                    onChange={(e) => updateField('packagesSubtitle', e.target.value)} />
                </FormField>
                <FormField label={ui.allTierLabel}>
                  <input className={inp} value={formState.packagesAllTierLabel}
                    onChange={(e) => updateField('packagesAllTierLabel', e.target.value)} />
                </FormField>
                <FormField label={ui.emptyTierMessage}>
                  <input className={inp} value={formState.packagesEmptyTierMessage}
                    onChange={(e) => updateField('packagesEmptyTierMessage', e.target.value)} />
                </FormField>
                <FormField label={ui.includesLabel}>
                  <input className={inp} value={formState.packagesIncludesLabel}
                    onChange={(e) => updateField('packagesIncludesLabel', e.target.value)} />
                </FormField>
                <FormField label={ui.fromPriceLabel}>
                  <input className={inp} value={formState.packagesFromOnlyLabel}
                    onChange={(e) => updateField('packagesFromOnlyLabel', e.target.value)} />
                </FormField>
              </div>
              <FormField label={ui.moreServicesText}>
                <input className={inp} value={formState.packagesMoreServicesText}
                  onChange={(e) => updateField('packagesMoreServicesText', e.target.value)} />
              </FormField>
            </FormSection>

            {/* Booking page */}
            <FormSection title={ui.bookingPage} badge={ui.config} icon={Calendar} accentColor="#3b82f6" rayDelay="12s" delay="0.20s">
              <div className="grid md:grid-cols-2 gap-5">
                <FormField label={ui.earliestOffset}
                  hint={ui.earliestOffsetHint}>
                  <input type="number" min="0" className={inp}
                    value={formState.bookingEarliestOffsetDays}
                    onChange={(e) => updateField('bookingEarliestOffsetDays', e.target.value)} />
                </FormField>
                <div className="md:col-span-1">
                  <FormField label={ui.timeSlots}
                    hint={ui.timeSlotsHint}>
                    <textarea className={inp} rows={4}
                      value={formState.bookingTimeSlots}
                      onChange={(e) => updateField('bookingTimeSlots', e.target.value)} />
                  </FormField>
                </div>
              </div>
            </FormSection>

            {/* ── Action bar ───────────────────────────── */}
            <div className="glass-card relative overflow-hidden card-stagger" style={{ animationDelay: '0.28s' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="prism-ray" style={{ left: '55%', width: '14%', animation: 'prism-ray-sweep 16s ease-in-out 4s infinite' }} />

              <div className="px-7 py-5 flex flex-wrap items-center gap-4">
                {/* Save button with prism glow */}
                <div className="cta-prism-glow rounded-xl">
                  <button type="submit"
                    className="flex items-center gap-2.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition">
                    <Save size={15} />
                    {ui.saveChanges}
                  </button>
                </div>

                {/* Reset button */}
                <button type="button" onClick={handleReset}
                  className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                  <RotateCcw size={15} />
                  {ui.resetDefaults}
                </button>

                {/* Status message */}
                {status && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-500/25 bg-green-500/8 status-pop">
                    <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-green-400">{status}</p>
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}

export default ContentEditor;