import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle, CheckCheck, XCircle, Clock, Calendar,
  Mail, Phone, Car, ArrowRight, MapPin, FileText,
  Sparkles, RefreshCw, Hourglass, AlertCircle, Gift, Copy, Share2,
} from 'lucide-react';
import { bookingsAPI } from '../../api/bookings';
import { referralAPI } from '../../api/referral';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatQAR } from '../../utils/currency';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';

/* ── Prismatic cursor orb ─────────────────────────────────── */
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
      const hue = (mouseX / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${curX}px, ${curY}px, 0)`;
      el.style.background = `conic-gradient(from ${hue}deg,
        rgba(255,0,80,.23), rgba(255,160,0,.21), rgba(255,255,0,.18),
        rgba(0,255,100,.21), rgba(0,160,255,.23), rgba(160,0,255,.21),
        rgba(255,0,80,.23))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 500, height: 500, top: '-250px', left: '-250px' }} />;
}

/* ── InfoRow ──────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-[var(--heading-color)] leading-snug">{value}</p>
      </div>
    </div>
  );
}

/* ── Card heading — matches booking/home heading style ────── */
function CardHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
      )}
      <h3 className="text-sm font-bold text-[var(--heading-color)] tracking-tight">{children}</h3>
      <span className="flex-1 h-px ml-1 hidden sm:block"
        style={{ background: 'linear-gradient(90deg, rgba(200,169,107,0.18), transparent)' }} />
    </div>
  );
}

/* ── Status-driven hero content ───────────────────────────── */
function getStatusContent(status) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return {
        badge: 'Service Completed',
        badgeColor: '#14B8A6',
        badgeLine: 'linear-gradient(90deg, transparent, #14B8A6)',
        title: 'Your vehicle is clean!',
        body: 'Thank you for choosing Glanz. We hope you love the results.',
        ringGradient: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
        ringBorder: 'rgba(20,184,166,0.4)',
        ringShadow: '0 0 0 4px rgba(20,184,166,0.15), 0 12px 40px rgba(20,184,166,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(20,184,166,.14),rgba(0,255,200,.1),rgba(20,184,166,.14),rgba(0,200,160,.1),rgba(20,184,166,.14))',
        middleBorder: 'border-teal-500/30',
        middleBg: 'rgba(20,184,166,0.06)',
        middleShadow: '0 0 50px rgba(20,184,166,0.18)',
        Icon: CheckCheck,
        steps: [
          { label: 'Service Completed',  detail: 'Your vehicle has been fully cleaned and is ready.' },
          { label: 'Leave a Review',     detail: 'Head to My Bookings to leave a review — we\'d love your feedback.' },
          { label: 'Book Again',         detail: 'Enjoyed it? Book your next wash anytime from the home screen.' },
        ],
      };
    case 'cancelled':
      return {
        badge: 'Booking Cancelled',
        badgeColor: '#F43F5E',
        badgeLine: 'linear-gradient(90deg, transparent, #F43F5E)',
        title: 'This booking was cancelled',
        body: 'Your booking has been cancelled. You can make a new booking anytime.',
        ringGradient: 'linear-gradient(135deg, #9F1239 0%, #F43F5E 100%)',
        ringBorder: 'rgba(244,63,94,0.4)',
        ringShadow: '0 0 0 4px rgba(244,63,94,0.15), 0 12px 40px rgba(244,63,94,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(244,63,94,.14),rgba(255,100,100,.1),rgba(244,63,94,.14),rgba(200,0,60,.1),rgba(244,63,94,.14))',
        middleBorder: 'border-rose-500/30',
        middleBg: 'rgba(244,63,94,0.06)',
        middleShadow: '0 0 50px rgba(244,63,94,0.18)',
        Icon: XCircle,
        steps: [
          { label: 'Booking Cancelled',  detail: 'This appointment has been cancelled.' },
          { label: 'Need Help?',         detail: 'Contact our support team if you have any questions or concerns.' },
          { label: 'Book Again',         detail: 'Ready to rebook? Start a new booking from the home screen.' },
        ],
      };
    case 'cancellationrequested':
    case 'cancellation requested':
      return {
        badge: 'Cancellation Requested',
        badgeColor: '#F59E0B',
        badgeLine: 'linear-gradient(90deg, transparent, #F59E0B)',
        title: 'Request under review',
        body: 'Your cancellation request has been submitted. Our team will contact you shortly.',
        ringGradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)',
        ringBorder: 'rgba(245,158,11,0.4)',
        ringShadow: '0 0 0 4px rgba(245,158,11,0.15), 0 12px 40px rgba(245,158,11,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(245,158,11,.14),rgba(255,200,0,.1),rgba(245,158,11,.14),rgba(200,120,0,.1),rgba(245,158,11,.14))',
        middleBorder: 'border-amber-500/30',
        middleBg: 'rgba(245,158,11,0.06)',
        middleShadow: '0 0 50px rgba(245,158,11,0.18)',
        Icon: Clock,
        steps: [
          { label: 'Request Received',   detail: 'Your cancellation request is under review.' },
          { label: 'Team Review',        detail: 'Our team will process your request and contact you shortly.' },
          { label: 'Need Urgent Help?',  detail: 'Call or message us directly if you need immediate assistance.' },
        ],
      };
    case 'reschedulerequested':
    case 'reschedule requested':
      return {
        badge: 'Reschedule Requested',
        badgeColor: '#60A5FA',
        badgeLine: 'linear-gradient(90deg, transparent, #60A5FA)',
        title: 'Request under review',
        body: 'Your reschedule request has been submitted. We\'ll confirm a new date soon.',
        ringGradient: 'linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)',
        ringBorder: 'rgba(96,165,250,0.4)',
        ringShadow: '0 0 0 4px rgba(96,165,250,0.15), 0 12px 40px rgba(96,165,250,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(96,165,250,.14),rgba(0,150,255,.1),rgba(96,165,250,.14),rgba(0,100,200,.1),rgba(96,165,250,.14))',
        middleBorder: 'border-blue-500/30',
        middleBg: 'rgba(96,165,250,0.06)',
        middleShadow: '0 0 50px rgba(96,165,250,0.18)',
        Icon: RefreshCw,
        steps: [
          { label: 'Request Received',   detail: 'Your reschedule request is under review.' },
          { label: 'New Date Pending',   detail: 'Our team will confirm your new appointment time shortly.' },
          { label: 'Stay Updated',       detail: 'Check your notifications for the confirmed new date.' },
        ],
      };
    case 'rescheduled':
      return {
        badge: 'Booking Rescheduled',
        badgeColor: '#60A5FA',
        badgeLine: 'linear-gradient(90deg, transparent, #60A5FA)',
        title: 'New date confirmed',
        body: 'Your appointment has been moved. Check the details below for your updated date and time.',
        ringGradient: 'linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)',
        ringBorder: 'rgba(96,165,250,0.4)',
        ringShadow: '0 0 0 4px rgba(96,165,250,0.15), 0 12px 40px rgba(96,165,250,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(96,165,250,.14),rgba(0,150,255,.1),rgba(96,165,250,.14),rgba(0,100,200,.1),rgba(96,165,250,.14))',
        middleBorder: 'border-blue-500/30',
        middleBg: 'rgba(96,165,250,0.06)',
        middleShadow: '0 0 50px rgba(96,165,250,0.18)',
        Icon: Calendar,
        steps: [
          { label: 'Rescheduled',        detail: 'Your booking has been moved to the new date shown above.' },
          { label: 'Detailer Assigned',  detail: 'A detailer will be confirmed for the new time.' },
          { label: 'Reminder Coming',    detail: 'A reminder will be sent 24 hours before your new appointment.' },
        ],
      };
    case 'inprogress':
    case 'in progress':
      return {
        badge: 'In Progress',
        badgeColor: '#3B82F6',
        badgeLine: 'linear-gradient(90deg, transparent, #3B82F6)',
        title: "We're cleaning your vehicle",
        body: 'Your detailer is working on your vehicle right now. Sit back and relax!',
        ringGradient: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
        ringBorder: 'rgba(59,130,246,0.4)',
        ringShadow: '0 0 0 4px rgba(59,130,246,0.15), 0 12px 40px rgba(59,130,246,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(59,130,246,.14),rgba(0,140,255,.1),rgba(59,130,246,.14),rgba(0,80,200,.1),rgba(59,130,246,.14))',
        middleBorder: 'border-blue-500/30',
        middleBg: 'rgba(59,130,246,0.06)',
        middleShadow: '0 0 50px rgba(59,130,246,0.18)',
        Icon: Car,
        steps: [
          { label: 'Service Started',    detail: 'Your detailer has begun working on your vehicle.' },
          { label: 'Almost Done',        detail: "You'll be notified as soon as the service is complete." },
        ],
      };
    case 'pending':
      return {
        badge: 'Awaiting Confirmation',
        badgeColor: '#F59E0B',
        badgeLine: 'linear-gradient(90deg, transparent, #F59E0B)',
        title: 'Booking received',
        body: "We've received your booking and our team will confirm it shortly.",
        ringGradient: 'linear-gradient(135deg, #78350F 0%, #F59E0B 100%)',
        ringBorder: 'rgba(245,158,11,0.4)',
        ringShadow: '0 0 0 4px rgba(245,158,11,0.15), 0 12px 40px rgba(245,158,11,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(245,158,11,.14),rgba(255,200,0,.1),rgba(245,158,11,.14),rgba(200,120,0,.1),rgba(245,158,11,.14))',
        middleBorder: 'border-amber-500/30',
        middleBg: 'rgba(245,158,11,0.06)',
        middleShadow: '0 0 50px rgba(245,158,11,0.18)',
        Icon: Hourglass,
        steps: [
          { label: 'Pending Confirmation', detail: 'Our team will review and confirm your booking shortly.' },
          { label: '24h Reminder',          detail: 'A reminder will be sent 24 hours before your appointment.' },
          { label: 'Detailer Assigned',     detail: 'Your detailer will be assigned once the booking is confirmed.' },
          { label: 'Pay After Service',     detail: 'Payment is collected only after service completion.' },
        ],
      };
    default: // 'confirmed' and fallback
      return {
        badge: 'Booking Confirmed',
        badgeColor: '#22C55E',
        badgeLine: 'linear-gradient(90deg, transparent, #22c55e)',
        title: "You're all set!",
        body: "Your appointment is confirmed. We'll take it from here.",
        ringGradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
        ringBorder: 'rgba(34,197,94,0.4)',
        ringShadow: '0 0 0 4px rgba(34,197,94,0.15), 0 12px 40px rgba(34,197,94,0.45)',
        outerPulse: 'conic-gradient(from 0deg,rgba(34,197,94,.14),rgba(0,255,200,.1),rgba(34,197,94,.14),rgba(0,160,255,.1),rgba(34,197,94,.14))',
        middleBorder: 'border-green-500/30',
        middleBg: 'rgba(34,197,94,0.06)',
        middleShadow: '0 0 50px rgba(34,197,94,0.18)',
        Icon: CheckCircle,
        steps: [
          { label: 'Email Confirmed',    detail: `Confirmation saved under ${''}.` },
          { label: '24h Reminder',       detail: 'A reminder will be sent 24 hours before your appointment.' },
          { label: 'Detailer Assigned',  detail: 'Your detailer will be assigned and notified automatically.' },
          { label: 'Pay After Service',  detail: 'Payment is collected only after service completion.' },
        ],
      };
  }
}

/* ════════════════════════════════════════════════════════════
   BOOKING CONFIRMATION
════════════════════════════════════════════════════════════ */
function BookingConfirmation() {
  const { bookingNumber } = useParams();
  const { isAdmin }       = useAuth();
  const { lang }          = useLanguage();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReferralPopup, setShowReferralPopup] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const shareCode = () => {
    const text = `Use my referral code ${referralCode} for exclusive discounts on Glanz car detailing services!`;
    if (navigator.share) {
      navigator.share({
        title: 'Glanz Referral',
        text: text,
        url: window.location.origin + '/book'
      });
    } else {
      copyCode();
    }
  };

  useEffect(() => {
    bookingsAPI.getByBookingNumber(bookingNumber)
      .then((data) => {
        setBooking(data);
        // Show referral unlock popup if this was the user's first completed wash
        if (data?.isFirstCompletedWash && data?.referralCodeUnlocked) {
          referralAPI.getMyCode()
            .then(codeData => {
              if (codeData?.referralCode) {
                setReferralCode(codeData.referralCode);
                setShowReferralPopup(true);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingNumber]);

  const retryFetch = () => {
    setLoading(true);
    setError('');
    bookingsAPI.getByNumber(bookingNumber)
      .then(data => setBooking(data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load booking.'))
      .finally(() => setLoading(false));
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen py-16" style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%)' }}>
        <div className="container mx-auto px-4 max-w-md">
          <Skeleton variant="text" className="w-32 h-8 mx-auto mb-8" />
          <Skeleton variant="card" className="h-72" />
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="alert" title="Failed to load booking" description={error} actionLabel="Try Again" onAction={retryFetch} />
      </div>
    );
  }

  /* ── Not found ── */
  if (!booking) {
    return (
      <>
        <PrismaticCursorOrb />
        <div className="min-h-screen flex items-center justify-center py-20 px-4">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-full glass-card flex items-center justify-center mx-auto mb-6">
              <FileText size={28} className="text-[var(--muted-color)]" />
            </div>
            <h2 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-3">Booking Not Found</h2>
            <p className="text-[var(--muted-color)] mb-8">We couldn't locate a booking with that reference number.</p>
            <Link to="/" className="btn-chrome inline-flex items-center gap-2">
              Return Home <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </>
    );
  }

  /* ── Derived values ── */
  const dateShort = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const _dateLong = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const vehicleText = [booking.vehicleYear, booking.vehicleMake, booking.vehicleModel]
    .filter(Boolean).join(' ');

  const sc = getStatusContent(booking.status);
  // patch the email placeholder in the confirmed default step
  const NEXT_STEPS = sc.steps.map(s =>
    s.label === 'Email Confirmed'
      ? { ...s, detail: `Confirmation saved under ${booking.customerEmail}.` }
      : s
  );

  const CARD_ACCENTS = ['#c8a96b', '#0ea5a0', '#c8a96b', '#0ea5a0'];

  return (
    <>
      <PrismaticCursorOrb />

      <div
        className="min-h-screen py-12 md:py-20 text-[var(--text-color)]"
        style={{
          background: `
            radial-gradient(circle at 12% 10%, rgba(200,169,107,0.07) 0%, transparent 38%),
            radial-gradient(circle at 88% 8%,  rgba(14,165,160,0.05)  0%, transparent 32%)
          `,
        }}
      >
        <div className="container mx-auto px-4 max-w-2xl">

          {/* ═══════════════════════════════════════════════════
              HERO
          ═══════════════════════════════════════════════════ */}
          <div className="relative text-center pb-10">
            {/* Spectral orbs — bleed slightly outside container */}
            <div className="absolute -top-16 -left-20 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 0deg,rgba(255,0,80,.1),rgba(255,165,0,.08),rgba(0,255,100,.08),rgba(0,150,255,.1),rgba(180,0,255,.08),rgba(255,0,80,.1))', filter: 'blur(80px)', animation: 'spectrum-float 18s ease-in-out infinite' }} />
            <div className="absolute -top-10 -right-20 w-60 h-60 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 180deg,rgba(0,255,200,.08),rgba(255,100,0,.07),rgba(200,0,255,.07),rgba(0,100,255,.08),rgba(255,200,0,.07),rgba(0,255,200,.08))', filter: 'blur(66px)', animation: 'spectrum-float 14s ease-in-out 6s infinite' }} />

            {/* Triple-ring status icon */}
            <div className="relative inline-flex items-center justify-center mb-7">
              {/* Outermost — spectral conic pulse */}
              <div className="absolute w-40 h-40 rounded-full ring-pulse"
                style={{ background: sc.outerPulse, filter: 'blur(14px)' }} />
              {/* Middle — status glow ring */}
              <div className={`absolute w-28 h-28 rounded-full border ${sc.middleBorder}`}
                style={{ background: sc.middleBg, boxShadow: sc.middleShadow }} />
              {/* Inner — status icon */}
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center check-animate"
                style={{ background: sc.ringGradient, boxShadow: sc.ringShadow }}
              >
                <sc.Icon size={36} className="text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Status badge */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="h-px w-10" style={{ background: sc.badgeLine }} />
              <p className="uppercase tracking-[0.28em] text-[0.7rem] font-semibold whitespace-nowrap"
                style={{ color: sc.badgeColor }}>
                {sc.badge}
              </p>
              <span className="h-px w-10" style={{ background: `linear-gradient(90deg, ${sc.badgeColor}, transparent)` }} />
            </div>

            <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)] mb-3">
              {sc.title}
            </h1>
            <p className="text-[var(--muted-color)] text-base max-w-sm mx-auto mb-8">
              {sc.body}
            </p>

            {/* Booking reference — boarding-pass style */}
            <div className="ref-animate inline-block w-full max-w-xs mx-auto">
              <div className="glass-card relative overflow-hidden px-6 py-4 text-left">
                {/* Gold left accent bar */}
                <div className="absolute top-0 left-0 w-[3px] h-full rounded-l-xl"
                  style={{ background: 'linear-gradient(180deg, #c8a96b, #0ea5a0)' }} />
                <div className="prism-ray"
                  style={{ left: '38%', width: '28%', animation: 'prism-ray-sweep 11s ease-in-out 2s infinite' }} />
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.26em] text-[var(--muted-color)] mb-1">
                  Booking Reference
                </p>
                <p className="text-2xl font-black text-primary tracking-wide font-mono">
                  {booking.bookingNumber}
                </p>
              </div>
            </div>
          </div>

          {/* Spectrum separator */}
          <div className="mb-8"><div className="spectrum-line" /></div>

          {/* ═══════════════════════════════════════════════════
              AT-A-GLANCE STRIP
          ═══════════════════════════════════════════════════ */}
          <div className="card-in-1 glass-card relative overflow-hidden mb-5">
            {/* Gold + teal top accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 35%, #0ea5a0 65%, transparent)' }} />
            <div className="prism-ray"
              style={{ left: '58%', width: '18%', animation: 'prism-ray-sweep 15s ease-in-out 4s infinite' }} />
            <div className="grid grid-cols-3 divide-x divide-[var(--border-color)]">
              {[
                { icon: Calendar, label: 'Date', value: dateShort },
                { icon: Clock,    label: 'Time', value: booking.timeSlot },
                { icon: Car,      label: 'Type', value: booking.vehicleType },
              ].map(({ icon: ColIcon, label, value }) => (
                <div key={label} className="px-4 py-5 flex flex-col items-center text-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center mb-1">
                    <ColIcon size={14} className="text-primary" />
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{label}</p>
                  <p className="text-sm font-bold text-[var(--heading-color)] leading-tight">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              CONTACT + ADDRESS (2-col grid when address exists)
          ═══════════════════════════════════════════════════ */}
          <div className={`grid gap-5 mb-5 ${booking.customerAddress ? 'sm:grid-cols-2' : ''}`}>
            {/* Contact */}
            <div className="card-in-2 glass-card p-6 relative overflow-hidden">
              <div className="prism-ray"
                style={{ left: '66%', width: '14%', animation: 'prism-ray-sweep 13s ease-in-out 7s infinite' }} />
              <CardHeading icon={Mail}>Contact Info</CardHeading>
              <div className="space-y-4">
                <InfoRow icon={Mail}  label="Email" value={booking.customerEmail} />
                <InfoRow icon={Phone} label="Phone" value={booking.customerPhone} />
              </div>
            </div>
            {/* Address */}
            {booking.customerAddress && (
              <div className="card-in-2 glass-card p-6 relative overflow-hidden">
                <div className="prism-ray"
                  style={{ left: '70%', width: '11%', animation: 'prism-ray-sweep 9s ease-in-out 9s infinite' }} />
                <CardHeading icon={MapPin}>Service Address</CardHeading>
                <InfoRow
                  icon={MapPin}
                  label={`${booking.addressType || 'Service'} Address`}
                  value={booking.customerAddress}
                />
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════
              VEHICLE
          ═══════════════════════════════════════════════════ */}
          {vehicleText && (
            <div className="card-in-3 glass-card p-6 relative overflow-hidden mb-5">
              <div className="prism-ray"
                style={{ left: '55%', width: '15%', animation: 'prism-ray-sweep 17s ease-in-out 5s infinite' }} />
              <CardHeading icon={Car}>Vehicle</CardHeading>
              <InfoRow icon={Car} label={booking.vehicleType || 'Vehicle'} value={vehicleText} />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              SERVICES BOOKED + TOTAL
          ═══════════════════════════════════════════════════ */}
          <div className="card-in-4 glass-card relative overflow-hidden mb-5">
            <div className="prism-ray"
              style={{ left: '62%', width: '20%', animation: 'prism-ray-sweep 12s ease-in-out 2s infinite' }} />
            <div className="p-6">
              <CardHeading icon={Sparkles}>Services Booked</CardHeading>
              <div className="space-y-3">
                {(booking.items || []).map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--border-color)] prism-glass relative"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                    onMouseMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width  * 100).toFixed(1)}%`);
                      e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top)  / r.height * 100).toFixed(1)}%`);
                    }}
                  >
                    {/* Alternating gold / teal top accent */}
                    <div className="absolute top-0 left-0 right-0 h-[1.5px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${CARD_ACCENTS[i % 2]}, transparent)` }} />
                    <div className="flex items-center justify-between gap-4 px-4 py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[0.58rem] font-bold tracking-[0.18em] opacity-40"
                            style={{ color: 'var(--muted-color)' }}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <p className="font-bold text-[var(--heading-color)] tracking-tight">{item.packageName}</p>
                          {item.packageTier && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/12 border border-primary/25 px-2 py-0.5 rounded-full">
                              {item.packageTier}
                            </span>
                          )}
                        </div>
                        {item.quantity > 1 && (
                          <p className="text-xs text-[var(--muted-color)] mt-0.5">×{item.quantity}</p>
                        )}
                      </div>
                      <p className="text-lg font-black text-primary flex-shrink-0">{formatQAR(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-5 pt-5 border-t border-[var(--border-color)] flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">
                    Total Amount
                  </p>
                  {booking.paymentStatus && (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
                        {booking.paymentStatus}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-4xl font-black text-primary">{formatQAR(booking.totalAmount)}</p>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              SPECIAL INSTRUCTIONS
          ═══════════════════════════════════════════════════ */}
          {booking.specialInstructions && (
            <div className="card-in-5 glass-card p-6 relative overflow-hidden mb-5">
              <div className="prism-ray"
                style={{ left: '72%', width: '11%', animation: 'prism-ray-sweep 10s ease-in-out 8s infinite' }} />
              <CardHeading icon={FileText}>Special Instructions</CardHeading>
              <div className="rounded-xl border border-[var(--border-color)] bg-white/2 px-5 py-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-[2px] h-full"
                  style={{ background: 'linear-gradient(180deg, #c8a96b 0%, #0ea5a0 100%)' }} />
                <p className="text-sm text-[var(--text-color)] leading-relaxed pl-2">
                  {booking.specialInstructions}
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              WHAT HAPPENS NEXT — timeline style
          ═══════════════════════════════════════════════════ */}
          <div className="card-in-6 glass-card p-6 relative overflow-hidden mb-8">
            <div className="prism-ray"
              style={{ left: '28%', width: '16%', animation: 'prism-ray-sweep 16s ease-in-out 0s infinite' }} />
            <CardHeading icon={Sparkles}>What Happens Next</CardHeading>
            <div className="space-y-0">
              {NEXT_STEPS.map((step, i) => {
                const isLast = i === NEXT_STEPS.length - 1;
                return (
                  <div key={i} className="flex items-start gap-4">
                    {/* Timeline column */}
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                      <div className="w-8 h-8 rounded-full border border-green-500/40 bg-green-500/12 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={14} className="text-green-400" />
                      </div>
                      {!isLast && (
                        <div className="step-line mt-1 mb-0" style={{ height: 24 }} />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`min-w-0 ${!isLast ? 'pb-5' : ''}`}>
                      <p className="text-sm font-bold text-[var(--heading-color)] mb-0.5">{step.label}</p>
                      <p className="text-sm text-[var(--muted-color)] leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              CTAs
          ═══════════════════════════════════════════════════ */}
          <div className="card-in-7 flex flex-col sm:flex-row gap-3 justify-center">
            <div className="cta-prism-glow rounded-2xl flex-1 sm:flex-none">
              <Link
                to={isAdmin ? '/admin/bookings' : '/my-bookings'}
                className="btn-chrome w-full sm:w-auto px-8 py-3.5 flex items-center justify-center gap-2 text-sm"
              >
                {isAdmin ? 'Open All Bookings' : 'View My Bookings'}
                <ArrowRight size={16} />
              </Link>
            </div>
            <Link
              to="/"
              className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl border-2 border-[var(--border-color)] text-[var(--text-color)] hover:border-primary/50 hover:bg-white/3 transition font-semibold text-sm text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>

      {/* Referral Unlock Popup */}
      {showReferralPopup && referralCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReferralPopup(false)} />
          <div className="relative w-full max-w-md p-6 rounded-2xl animate-in fade-in zoom-in-95 duration-300"
            style={{ 
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: 'white'
            }}>
            <button 
              onClick={() => setShowReferralPopup(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              ×
            </button>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} />
              </div>
              
              <h2 className="text-2xl font-bold mb-2">
                {lang === 'ar' ? 'تهانينا! لقد فتحت كود الإحالة!' : 'Congratulations! You unlocked your referral code!'}
              </h2>
              <p className="text-white/80 mb-4">
                {lang === 'ar' 
                  ? 'شارك هذا الكود مع أصدقائك واحصل على مكافأة عند إتمام أول حجز لهم'
                  : 'Share this code with friends and earn rewards when they complete their first booking'}
              </p>
              
              <div className="bg-white/20 rounded-xl p-4 mb-6">
                <div className="text-3xl font-bold tracking-wider">{referralCode}</div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={copyCode}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-[#8b5cf6] font-semibold hover:bg-white/90 transition"
                >
                  <Copy size={18} />
                  {copied ? (lang === 'ar' ? 'تم!' : 'Copied!') : (lang === 'ar' ? 'نسخ' : 'Copy')}
                </button>
                <button 
                  onClick={shareCode}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/20 text-white font-semibold hover:bg-white/30 transition"
                >
                  <Share2 size={18} />
                  {lang === 'ar' ? 'مشاركة' : 'Share'}
                </button>
              </div>
              
              <Link 
                to="/referrals"
                onClick={() => setShowReferralPopup(false)}
                className="block mt-4 text-sm text-white/70 hover:text-white underline"
              >
                {lang === 'ar' ? 'عرض صفحة الإحالة' : 'View referral page'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BookingConfirmation;