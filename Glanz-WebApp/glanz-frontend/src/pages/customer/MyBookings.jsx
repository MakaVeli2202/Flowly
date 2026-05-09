import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  bookingsAPI
} from '../../api/bookings';
import { packagesAPI } from '../../api/packages';
import { offersAPI } from '../../api/offers';
import { crmAPI } from '../../api/crm';
import {
  Calendar, Clock, AlertCircle, CheckCircle, XCircle,
  Package, Gift, Star, Copy, Check, Edit2, X,
  ArrowRight, Ticket, Car, MapPin, ChevronRight,
  AlertTriangle, RefreshCw, Upload, Image,
} from 'lucide-react';
import { formatQAR } from '../../utils/currency';
import AvailabilityCalendar from '../../components/shared/AvailabilityCalendar';
import { statusConfig, defaultStatusIcon } from '../../utils/statusConfig';
import { usePolling } from '../../hooks/usePolling';
import { Skeleton, CardSkeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';

const VEHICLE_TYPES = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];

// Status → top-accent color map
const STATUS_ACCENT = {
  Pending:    '#FBBF24',
  Confirmed:  '#60A5FA',
  InProgress: '#C084FC',
  Completed:  '#84CC16',
  Cancelled:  '#F87171',
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">
      {children}
    </label>
  );
}

function DarkInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition ${className}`}
      {...props}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function MyBookings() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { lang } = useLanguage();

  const [bookings,           setBookings]           = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [filterStatus,       setFilterStatus]       = useState('All');
  const [cancellingId,       setCancellingId]       = useState(null);
  const [pendingCancelBooking,setPendingCancelBooking] = useState(null);
  const [cancellationFeeInfo,setCancellationFeeInfo] = useState(null);
  const [feeLoading,         setFeeLoading]         = useState(false);
  const [cancelReason,       setCancelReason]       = useState('');
  const [successModal,       setSuccessModal]       = useState(null);
  const [loyalty,            setLoyalty]            = useState(null);
  const [copiedCode,         setCopiedCode]         = useState(null);
  const [activatingLoyalty,  setActivatingLoyalty]  = useState(false);
  const [reviewStep,         setReviewStep]         = useState(1);
  const [screenshotFile,     setScreenshotFile]     = useState(null);
  const [screenshotPreview, setScreenshotPreview]  = useState(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [highlightedBookingId,setHighlightedBookingId] = useState(null);

  // Feedback state
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackData, setFeedbackData] = useState({ type: 'Review', rating: 5, comment: '', isAnonymous: false });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Edit modal state
  const [editBooking,        setEditBooking]        = useState(null);
  const [editForm,           setEditForm]           = useState({});
  const [editSaving,         setEditSaving]         = useState(false);
  const [editError,          setEditError]          = useState('');
  const [editSlotWarning,    setEditSlotWarning]    = useState(null);
  const [editConfirm,        setEditConfirm]        = useState(false);
  const [allPackages,        setAllPackages]        = useState([]);
  const [editSlotsLoading,   setEditSlotsLoading]   = useState(false);
  const [editAvailableSlots, setEditAvailableSlots] = useState([]);

  useEffect(() => {
    Promise.all([fetchBookings(), fetchLoyalty()]);
  }, []);

  const silentFetch = useCallback(() => {
    bookingsAPI.getMyBookings()
      .then(data => setBookings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  usePolling(silentFetch, 30_000);

  useEffect(() => {
    const triggerHighlight = (bookingId) => {
      setFilterStatus('All');
      setHighlightedBookingId(bookingId);
      window.setTimeout(() => {
        document.querySelector(`[data-customer-booking-id="${bookingId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
      window.setTimeout(() => setHighlightedBookingId(null), 2600);
    };
    const saved = sessionStorage.getItem('highlightCustomerBookingId');
    if (saved) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) triggerHighlight(parsed);
      sessionStorage.removeItem('highlightCustomerBookingId');
    }
    const onHighlight = (e) => {
      const bookingId = Number(e?.detail?.bookingId);
      if (Number.isFinite(bookingId)) triggerHighlight(bookingId);
    };
    window.addEventListener('highlight-customer-booking', onHighlight);
    return () => window.removeEventListener('highlight-customer-booking', onHighlight);
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingsAPI.getMyBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch { setError('Failed to load bookings.'); }
    finally { setLoading(false); }
  };

  const fetchLoyalty = async () => {
    try { setLoyalty(await offersAPI.getMyLoyalty()); } catch {}
  };

  const retryFetch = () => {
    Promise.all([fetchBookings(), fetchLoyalty()]);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const GOOGLE_REVIEW_URL = 'https://g.page/r/CbY8wgSE0iXGEAE/review';

  const openGoogleReview = () => {
    localStorage.setItem('glanz_review_clicked', '1');
    window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer');
    setReviewStep(2);
  };

  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const submitReviewWithScreenshot = async () => {
    if (!screenshotFile) return;
    try {
      setUploadingScreenshot(true);
      await offersAPI.activateGoogleReviewLoyalty(screenshotFile);
      setReviewStep(4);
      await fetchLoyalty();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit screenshot.');
    } finally { setUploadingScreenshot(false); }
  };

  const handleCancelBooking = async (bookingId, bookingNumber) => {
    setPendingCancelBooking({ id: bookingId, number: bookingNumber });
    setCancellationFeeInfo(null);
    setCancelReason('');
    try {
      setFeeLoading(true);
      setCancellationFeeInfo(await bookingsAPI.getCancellationFee(bookingId));
    } catch {}
    finally { setFeeLoading(false); }
  };

  const confirmCancelBooking = async () => {
    if (!pendingCancelBooking) return;
    if (!cancelReason.trim()) {
      alert('Please provide a reason for the cancellation request.');
      return;
    }
    try {
      setCancellingId(pendingCancelBooking.id);
      await bookingsAPI.requestCancellation(pendingCancelBooking.id, cancelReason.trim());
      await fetchBookings();
      setPendingCancelBooking(null);
      setCancelReason('');
      setSuccessModal({
        title: 'Request Submitted',
        message: 'Your cancellation request has been received. Our team will review it and contact you shortly.',
        bookingNumber: pendingCancelBooking.number,
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit cancellation request.');
    } finally { setCancellingId(null); }
  };

  const handleBookAgain = (booking) => {
    navigate('/booking', {
      state: {
        rebookFromBooking: {
          packages:            (booking.items || []).filter(i => i.packageId).map(i => ({ packageId: i.packageId, quantity: i.quantity || 1 })),
          customerAddress:     booking.customerAddress     || '',
          addressType:         booking.addressType         || 'Home',
          vehicleType:         booking.vehicleType         || 'Sedan',
          vehicleMake:         booking.vehicleMake         || '',
          vehicleModel:        booking.vehicleModel        || '',
          vehicleYear:         booking.vehicleYear         || '',
          specialInstructions: booking.specialInstructions || '',
        },
      },
    });
  };

  const submitFeedback = async () => {
    if (!feedbackModal) return;
    setSubmittingFeedback(true);
    try {
      await crmAPI.submitFeedback({
        bookingId: feedbackModal.id,
        type: feedbackData.type,
        rating: feedbackData.type === 'Complaint' ? null : feedbackData.rating,
        comment: feedbackData.comment,
        isAnonymous: feedbackData.isAnonymous,
        workerId: feedbackModal.assignedWorkerId
      });
      setFeedbackModal(null);
      setFeedbackData({ type: 'Review', rating: 5, comment: '', isAnonymous: false });
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const openEditModal = async (booking) => {
    const initPackages   = (booking.items || []).map(i => ({ packageId: i.packageId, quantity: i.quantity }));
    const initVehicleType = booking.vehicleType || 'Sedan';
    const initDate        = booking.scheduledDate ? new Date(booking.scheduledDate).toISOString().split('T')[0] : '';

    setEditBooking(booking);
    setEditForm({
      scheduledDate:       initDate,
      timeSlot:            booking.timeSlot           || '',
      vehicleMake:         booking.vehicleMake         || '',
      vehicleModel:        booking.vehicleModel        || '',
      vehicleYear:         booking.vehicleYear         || '',
      vehicleType:         initVehicleType,
      customerAddress:     booking.customerAddress     || '',
      houseNumber:         booking.houseNumber         || '',
      addressType:         booking.addressType         || 'Home',
      specialInstructions: booking.specialInstructions || '',
      packages:            initPackages,
    });
    setEditError(''); setEditSlotWarning(null); setEditConfirm(false);

    let loadedPackages = allPackages;
    if (allPackages.length === 0) {
      try { loadedPackages = await packagesAPI.getAll(lang) || []; setAllPackages(loadedPackages); } catch {}
    }
    await loadEditSlots(initDate, initPackages, initVehicleType, loadedPackages);
  };

  const loadEditSlots = async (date, packages, vehicleType, pkgList) => {
    if (!date) return;
    try {
      setEditSlotsLoading(true);
      const pkgs = packages ?? editForm.packages;
      const vt   = vehicleType ?? editForm.vehicleType;
      const pList = pkgList ?? allPackages;
      const duration = pkgs?.length
        ? pList.filter(p => pkgs.some(ep => ep.packageId === p.id)).reduce((sum, p) => sum + (p.estimatedDurationMinutes || 60), 0)
        : 60;
      setEditAvailableSlots(await bookingsAPI.getAvailableSlots(date, duration || 60, vt) || []);
    } catch { setEditAvailableSlots([]); }
    finally { setEditSlotsLoading(false); }
  };

  const handleEditDateChange = async (newDate) => {
    setEditForm((p) => ({ ...p, scheduledDate: newDate, timeSlot: '' }));
    setEditAvailableSlots([]);
    await loadEditSlots(newDate, editForm.packages, editForm.vehicleType, allPackages);
  };

  const handleEditPackageToggle = (packageId) => {
    const newPackages = [{ packageId, quantity: 1 }];
    setEditForm((prev) => ({ ...prev, packages: newPackages }));
    setEditSlotWarning(null);
    if (editForm.scheduledDate) {
      loadEditSlots(editForm.scheduledDate, newPackages, editForm.vehicleType, allPackages);
    }
  };

  const handleEditVehicleChange = (e) => {
    const newType = e.target.value;
    setEditForm(prev => ({ ...prev, vehicleType: newType }));
    if (editForm.scheduledDate) {
      loadEditSlots(editForm.scheduledDate, editForm.packages, newType, allPackages);
    }
  };

  const handleSaveEdit = async () => {
    if (!editBooking) return;
    try {
      setEditSaving(true); setEditError(''); setEditSlotWarning(null);
      const dto = {};
      if (editForm.scheduledDate)                  dto.scheduledDate       = `${editForm.scheduledDate}T12:00:00.000Z`;
      if (editForm.timeSlot)                       dto.timeSlot            = editForm.timeSlot;
      if (editForm.vehicleMake !== undefined)      dto.vehicleMake         = editForm.vehicleMake;
      if (editForm.vehicleModel !== undefined)     dto.vehicleModel        = editForm.vehicleModel;
      if (editForm.vehicleYear !== undefined)      dto.vehicleYear         = editForm.vehicleYear;
      if (editForm.vehicleType)                    dto.vehicleType         = editForm.vehicleType;
      if (editForm.customerAddress !== undefined)  dto.customerAddress     = editForm.customerAddress;
      if (editForm.houseNumber !== undefined)      dto.houseNumber         = editForm.houseNumber;
      if (editForm.addressType !== undefined)      dto.addressType         = editForm.addressType;
      if (editForm.specialInstructions !== undefined) dto.specialInstructions = editForm.specialInstructions;
      if (editForm.packages?.length > 0)           dto.packages            = editForm.packages;
      await bookingsAPI.customerEdit(editBooking.id, dto);
      await fetchBookings();
      setEditBooking(null); setEditConfirm(false);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.availableSlots && Array.isArray(data.availableSlots)) {
        setEditSlotWarning({ message: data.message, altSlots: data.availableSlots });
        setEditConfirm(false);
      } else {
        setEditError(data?.message || 'Failed to save changes.');
      }
    } finally { setEditSaving(false); }
  };

  const filteredBookings = useMemo(
    () => filterStatus === 'All' ? bookings : bookings.filter(b => b.status === filterStatus),
    [bookings, filterStatus]
  );
  const statuses = ['All', ...new Set(bookings.map(b => b.status))];

  // prism-glass mouse-move handler
  const handlePrismMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen py-10 md:py-16" style={{ background: 'var(--surface-bg)' }}>
        <div className="container mx-auto px-4">
          <div className="h-10 w-48 mb-8"><Skeleton variant="text" className="w-48 h-10" /></div>
          <div className="flex gap-2 mb-8">
            {['All', 'Pending', 'Confirmed', 'InProgress', 'Completed', 'Cancelled'].map(s => (
              <Skeleton key={s} variant="button" className="w-20 h-9" />
            ))}
          </div>
          <div className="grid gap-4">
            {[1,2,3].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="alert" title="Failed to load bookings" description={error} actionLabel="Try Again" onAction={retryFetch} />
      </div>
    );
  }

  // ── Empty ───────────────────────────────────────────────────────────────
  if (!bookings || bookings.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="calendar" title="No bookings yet" description="Book your first detailing service to get started." />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen py-10 md:py-16 text-[var(--text-color)]"
      style={{
        background: "radial-gradient(circle at 10% 15%, rgba(200,169,107,0.12), transparent 34%), radial-gradient(circle at 85% 8%, rgba(14,165,160,0.10), transparent 30%), linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)",
      }}
    >

      {/* ══════════════ EDIT MODAL ══════════════════════════════════════════ */}
      {editBooking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-[var(--border-color)]">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">Modify Booking</p>
                <h3 className="text-lg font-bold text-[var(--heading-color)]">{editBooking.bookingNumber}</h3>
              </div>
              <button type="button" onClick={() => setEditBooking(null)} className="w-8 h-8 rounded-lg border border-[var(--border-color)] hover:bg-white/5 flex items-center justify-center transition">
                <X size={16} className="text-[var(--muted-color)]" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {editError && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />{editError}
                </div>
              )}

              {/* Date + time */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <FieldLabel>Date</FieldLabel>
                  <AvailabilityCalendar
                    value={editForm.scheduledDate}
                    onChange={(ds) => handleEditDateChange(ds)}
                    originalDate={editBooking.scheduledDate ? new Date(editBooking.scheduledDate).toISOString().split('T')[0] : ''}
                  />
                </div>
                <div>
                  <FieldLabel>Time Slot {editSlotsLoading && <span className="normal-case opacity-60">(loading…)</span>}</FieldLabel>
                  <select
                    value={editForm.timeSlot}
                    onChange={(e) => setEditForm((p) => ({ ...p, timeSlot: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  >
                    <option value="">Select slot</option>
                    {Array.from(new Set([editBooking.timeSlot, ...editAvailableSlots].filter(Boolean))).map((slot) => (
                      <option key={slot} value={slot}>{slot}{editAvailableSlots.includes(slot) ? '' : ' (current)'}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vehicle make / model / year */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'vehicleMake',  label: 'Make',  placeholder: 'Toyota' },
                  { key: 'vehicleModel', label: 'Model', placeholder: 'Camry'  },
                  { key: 'vehicleYear',  label: 'Year',  placeholder: '2022', maxLength: 4 },
                ].map(({ key, label, placeholder, maxLength }) => (
                  <div key={key}>
                    <FieldLabel>{label}</FieldLabel>
                    <DarkInput value={editForm[key]} placeholder={placeholder} maxLength={maxLength}
                      onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>

              {/* Vehicle type chips */}
              <div>
                <FieldLabel>Vehicle Type</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {VEHICLE_TYPES.map((t) => (
                    <button key={t} type="button"
                      onClick={() => {
                        setEditForm((p) => ({ ...p, vehicleType: t }));
                        if (editForm.scheduledDate) loadEditSlots(editForm.scheduledDate);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition ${
                        editForm.vehicleType === t
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Service Address</FieldLabel>
                  <DarkInput placeholder="Street / Area" value={editForm.customerAddress}
                    onChange={(e) => setEditForm((p) => ({ ...p, customerAddress: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>House / Building</FieldLabel>
                  <DarkInput placeholder="Villa 12" value={editForm.houseNumber}
                    onChange={(e) => setEditForm((p) => ({ ...p, houseNumber: e.target.value }))} />
                </div>
              </div>

              {/* Special instructions */}
              <div>
                <FieldLabel>Special Instructions</FieldLabel>
                <textarea
                  value={editForm.specialInstructions}
                  onChange={(e) => setEditForm((p) => ({ ...p, specialInstructions: e.target.value }))}
                  rows={2}
                  placeholder="Any notes for the detailer…"
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none"
                />
              </div>

              {/* Packages */}
              {allPackages.length > 0 && (
                <div>
                  <FieldLabel>Packages</FieldLabel>
                  <div className="space-y-2">
                    {allPackages.map((pkg) => {
                      const selected = (editForm.packages || []).find(p => p.packageId === pkg.id);
                      const vehicleMultiplier = (settings?.vehicleMultipliers ?? {})[editForm.vehicleType] || 1.0;
                      const adjPrice = Math.round(pkg.price * vehicleMultiplier * 100) / 100;
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => handleEditPackageToggle(pkg.id)}
                          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition ${
                            selected
                              ? 'border-primary bg-primary/8'
                              : 'border-[var(--border-color)] hover:border-primary/30 bg-white/2'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-primary bg-primary' : 'border-[var(--border-color)]'}`}>
                              {selected && <Check size={10} className="text-[var(--ink)]" />}
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--heading-color)]">{pkg.name}</span>
                              {pkg.tier && <span className="ml-1.5 text-xs text-[var(--muted-color)]">({pkg.tier})</span>}
                            </div>
                          </div>
                          <div>
                            <span className={`text-xs font-medium ${vehicleMultiplier !== 1.0 ? 'text-amber-400' : 'text-[var(--muted-color)]'}`}>
                              {formatQAR(adjPrice)}
                              {vehicleMultiplier !== 1.0 && <span className="ml-1">×{vehicleMultiplier}</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(editForm.packages || []).length === 0 && (
                    <p className="text-xs text-red-400 mt-1.5">At least one package must be selected.</p>
                  )}
                </div>
              )}

              {/* Slot-blocked warning */}
              {editSlotWarning && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
                  <p className="text-sm font-bold text-amber-400 mb-1">Time slot not available</p>
                  <p className="text-xs text-amber-300/80">{editSlotWarning.message}</p>
                  {editSlotWarning.altSlots?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--muted-color)] mb-2">Available slots on this date:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {editSlotWarning.altSlots.map((slot) => (
                          <button key={slot} type="button"
                            onClick={() => { setEditForm((p) => ({ ...p, timeSlot: slot })); setEditSlotWarning(null); }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-primary/40 text-primary hover:bg-primary/15 font-semibold transition">
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!editSlotWarning.altSlots || editSlotWarning.altSlots.length === 0) && (
                    <p className="text-xs text-amber-400 mt-2">No slots available — please choose a different date.</p>
                  )}
                </div>
              )}

              {/* Confirm step */}
              {editConfirm ? (
                <div className="rounded-xl border border-primary/25 bg-primary/6 p-4">
                  <p className="text-sm font-bold text-[var(--heading-color)] mb-3">Confirm these changes?</p>
                  <ul className="text-xs text-[var(--muted-color)] space-y-1 mb-4">
                    {editForm.scheduledDate !== new Date(editBooking.scheduledDate).toISOString().split('T')[0] && <li>· Date → {editForm.scheduledDate}</li>}
                    {editForm.timeSlot && editForm.timeSlot !== editBooking.timeSlot && <li>· Time → {editForm.timeSlot}</li>}
                    {editForm.vehicleMake !== (editBooking.vehicleMake || '') && <li>· Vehicle → {editForm.vehicleYear} {editForm.vehicleMake} {editForm.vehicleModel}</li>}
                    {editForm.customerAddress !== (editBooking.customerAddress || '') && <li>· Address → {editForm.customerAddress}</li>}
                    {editForm.specialInstructions !== (editBooking.specialInstructions || '') && <li>· Special instructions updated</li>}
                    {editForm.packages?.length > 0 && (
                      <li>· Packages → {editForm.packages.map(p => { const pkg = allPackages.find(x => x.id === p.packageId); return `${pkg?.name || `#${p.packageId}`}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`; }).join(', ')}</li>
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSaveEdit} disabled={editSaving}
                      className="flex items-center gap-2 premium-btn px-5 py-2 text-sm disabled:opacity-60">
                      <Check size={14} /> {editSaving ? 'Saving…' : 'Yes, save'}
                    </button>
                    <button type="button" onClick={() => setEditConfirm(false)}
                      className="px-5 py-2 rounded-xl text-sm font-semibold border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5 transition">
                      Go back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 pt-2 border-t border-[var(--border-color)]">
                  <button type="button"
                    onClick={() => setEditConfirm(true)}
                    disabled={editForm.packages !== undefined && editForm.packages.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 premium-btn py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    <Check size={14} /> Review &amp; Save
                  </button>
                  <button type="button" onClick={() => setEditBooking(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5 transition">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CANCEL MODAL ════════════════════════════════════════ */}
      {pendingCancelBooking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <XCircle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--heading-color)]">Request Cancellation</h3>
                <p className="text-sm text-[var(--muted-color)] mt-1">
                  Submit a cancellation request for <span className="font-semibold text-[var(--text-color)]">{pendingCancelBooking.number}</span>. Our team will review it.
                </p>
              </div>
            </div>

            {feeLoading && (
              <div className="flex items-center gap-2 text-sm text-[var(--muted-color)] mb-4">
                <div className="animate-spin h-3.5 w-3.5 border-2 border-[var(--muted-color)] border-t-transparent rounded-full" />
                Checking cancellation policy…
              </div>
            )}

            {cancellationFeeInfo?.feeEnabled && !cancellationFeeInfo.withinFreeWindow && cancellationFeeInfo.calculatedFee > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 mb-4">
                <p className="text-sm font-bold text-amber-400 mb-1.5">Cancellation fee may apply</p>
                <p className="text-sm text-amber-300/80">
                  Your appointment is in <strong>{Math.round(cancellationFeeInfo.hoursUntilAppointment)}h</strong>,
                  within the <strong>{cancellationFeeInfo.freeWindowHours}h</strong> free window.
                  A fee of <strong>{formatQAR(cancellationFeeInfo.calculatedFee)}</strong> may be charged.
                </p>
              </div>
            )}

            {cancellationFeeInfo?.feeEnabled && cancellationFeeInfo.withinFreeWindow && (
              <div className="rounded-xl border border-green-500/25 bg-green-500/8 p-4 mb-4">
                <p className="text-sm text-green-400 font-semibold flex items-center gap-2">
                  <CheckCircle size={15} /> Free cancellation — no charge will be applied.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">
                Reason for cancellation <span className="text-red-400">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please tell us why you want to cancel…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setPendingCancelBooking(null); setCancellationFeeInfo(null); setCancelReason(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5 transition">
                Keep Booking
              </button>
              <button onClick={confirmCancelBooking} disabled={cancellingId === pendingCancelBooking.id || !cancelReason.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {cancellingId === pendingCancelBooking.id ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ SUCCESS MODAL ══════════════════════════════════════════ */}
      {successModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/12 border border-green-500/25 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={26} className="text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-[var(--heading-color)] mb-2">{successModal.title}</h3>
            {successModal.bookingNumber && (
              <p className="text-xs text-primary font-semibold tracking-widest mb-3">{successModal.bookingNumber}</p>
            )}
            <p className="text-sm text-[var(--muted-color)] leading-relaxed mb-6">{successModal.message}</p>
            <button
              onClick={() => setSuccessModal(null)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-500/12 border border-green-500/25 text-green-400 hover:bg-green-500/20 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 max-w-4xl">

        {/* ── Page heading ───────────────────────────────────────────────── */}
        <div className="mb-12 text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-3 mb-5">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[rgba(200,169,107,0.6)]" />
            <span className="text-[10px] uppercase tracking-[0.28em] font-bold" style={{ color: 'rgba(200,169,107,0.9)' }}>
              Dashboard
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[rgba(200,169,107,0.6)]" />
          </div>

          <h1 className="premium-heading text-3xl md:text-4xl font-bold text-[var(--heading-color)] mb-4">
            My Bookings
          </h1>
          <p className="text-[var(--muted-color)] text-sm md:text-base">View and manage your appointments</p>

          {/* Spectrum divider */}
          <div className="spectrum-line mx-auto mt-6" />
        </div>

        {/* ── Loyalty panel ──────────────────────────────────────────────── */}
        {loyalty && (
          <div className="glass-card mb-8 p-6 overflow-hidden relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(200,169,107,0.12), transparent 70%)' }} />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(14,165,160,0.10), transparent 70%)' }} />
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,169,107,0.7), transparent)' }} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0" style={{ borderColor: 'rgba(200,169,107,0.35)', background: 'rgba(200,169,107,0.10)' }}>
                  <Star size={18} className="text-yellow-300 fill-yellow-300" />
                </div>
                <div>
                  <h2 className="premium-heading text-lg font-bold text-[var(--heading-color)] tracking-tight">Loyalty Rewards</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(200,169,107,0.75)' }}>{loyalty.totalCompletedBookings} completed wash{loyalty.totalCompletedBookings !== 1 ? 'es' : ''}</p>
                </div>
              </div>

               {/* Step 1 — unlock with Google review */}
               {!(loyalty.isGoogleReviewActivated || !!localStorage.getItem('DEV_BYPASS_REVIEW')) && (
                 <div className="mb-6 rounded-xl border p-5" style={{ borderColor: 'rgba(200,169,107,0.28)', background: 'rgba(200,169,107,0.05)' }}>
                   <div className="flex items-center gap-2 mb-4">
                     <Star size={14} className="text-yellow-300" />
                     <span className="text-sm font-bold" style={{ color: 'rgba(200,169,107,0.95)' }}>Unlock Your Loyalty Card</span>
                   </div>

                   {loyalty.isGoogleReviewPending || reviewStep >= 3 ? (
                     /* Pending admin verification */
                     <div className="flex items-start gap-3 mt-3 p-3 rounded-lg" style={{ background: 'rgba(200,169,107,0.08)', border: '1px solid rgba(200,169,107,0.22)' }}>
                       <RefreshCw size={14} className="mt-0.5 shrink-0" style={{ color: 'rgba(200,169,107,0.8)' }} />
                       <div>
                         <p className="text-xs font-semibold" style={{ color: 'rgba(200,169,107,0.95)' }}>Review submitted — pending verification</p>
                         <p className="text-xs text-[var(--muted-color)] mt-0.5">Our team will verify your Google review and activate your loyalty card within 24 hours.</p>
                       </div>
                     </div>
                   ) : (
                      <>
                        <p className="text-xs text-[var(--muted-color)] mb-4 leading-relaxed">
                          Every {loyalty.programs?.[0]?.triggerBookings ?? 3} completed washes earns you a free one.
                        </p>

                        {/* Reminder BEFORE opening review */}
                        <div className="mb-3 p-3 rounded-lg border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
                          <p className="text-[11px] font-semibold" style={{ color: 'rgba(239,68,68,0.9)' }}>Don't forget to take a screenshot AFTER posting your review!</p>
                          <p className="text-[10px] mt-1" style={{ color: 'rgba(239,68,68,0.7)' }}>You'll need it for verification in Step 2.</p>
                        </div>

                        {/* Step 1: Open Google Review */}
                        <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,169,107,0.15)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>1</span>
                            <span className="text-xs font-bold" style={{ color: 'rgba(200,169,107,0.9)' }}>Leave a Google Review</span>
                          </div>
                          <p className="text-[11px] text-[var(--muted-color)] mb-3 ml-7">Click below to open Google Reviews in a new tab. Leave a review and return here.</p>
                          <button
                            onClick={openGoogleReview}
                            className="ml-7 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition"
                            style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>
                            <Star size={12} style={{ fill: '#0a0a0a' }} /> Open Google Review
                          </button>
                        </div>

                        {/* Step 2: Upload screenshot */}
                        {reviewStep >= 2 && (
                          <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,169,107,0.15)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>2</span>
                              <span className="text-xs font-bold" style={{ color: 'rgba(200,169,107,0.9)' }}>Upload Screenshot</span>
                            </div>
                            <p className="text-[11px] text-[var(--muted-color)] mb-3 ml-7">Upload the screenshot of your posted review for verification.</p>
                            <div className="ml-7">
                              {screenshotPreview ? (
                                <div className="mb-3">
                                  <img src={screenshotPreview} alt="Review screenshot" className="rounded-lg max-h-40 border border-[var(--border-color)]" />
                                  <button
                                    onClick={() => { setScreenshotPreview(null); setScreenshotFile(null); }}
                                    className="text-[10px] mt-1 underline"
                                    style={{ color: 'rgba(200,169,107,0.7)' }}>
                                    Remove and retake
                                  </button>
                                </div>
                              ) : (
                                <label className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition hover:border-[rgba(200,169,107,0.4)]" style={{ borderColor: 'rgba(200,169,107,0.2)' }}>
                                  <Upload size={16} style={{ color: 'rgba(200,169,107,0.7)' }} />
                                  <span className="text-xs" style={{ color: 'rgba(200,169,107,0.7)' }}>Click to upload screenshot</span>
                                  <input type="file" accept="image/*" onChange={handleScreenshotChange} className="hidden" />
                                </label>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Step 3: Submit */}
                        {reviewStep >= 2 && screenshotFile && (
                          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,169,107,0.15)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>3</span>
                              <span className="text-xs font-bold" style={{ color: 'rgba(200,169,107,0.9)' }}>Submit for Verification</span>
                            </div>
                            <p className="text-[11px] text-[var(--muted-color)] mb-3 ml-7">Your screenshot is ready. Click below to complete.</p>
                            <button
                              onClick={submitReviewWithScreenshot}
                              disabled={uploadingScreenshot}
                              className="ml-7 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-60"
                              style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>
                              {uploadingScreenshot ? <><RefreshCw size={12} className="animate-spin" /> Submitting…</> : 'Submit for Verification'}
                            </button>
                          </div>
                        )}
                      </>
                   )}
                 </div>
               )}

               {/* Step 2 — stamp cards */}
              {(loyalty.isGoogleReviewActivated || !!localStorage.getItem('DEV_BYPASS_REVIEW')) && (
                loyalty.programs?.length > 0 ? (
                  <div className="space-y-4 mb-4">
                    {loyalty.programs.map((prog, idx) => {
                      const rewardReady = prog.bookingsToNext === 0;
                      const coupon = loyalty.availableCoupons?.find(c =>
                        c.offerId === prog.offerId
                      ) ?? (loyalty.availableCoupons?.[idx] ?? null);
                      // Coupon was already redeemed (booking made) but booking not yet
                      // completed — show a "fresh cycle" (0 stamps) state instead of
                      // keeping all stamps highlighted.
                      const rewardPendingReset = rewardReady && !coupon;
                      const displayCompleted   = rewardPendingReset ? 0 : prog.completedBookings;
                      return (
                        <div key={prog.offerId} className="rounded-2xl border p-5 transition-all"
                          style={{
                            borderColor: rewardReady && coupon ? 'rgba(200,169,107,0.55)' : 'rgba(200,169,107,0.18)',
                            background:  rewardReady && coupon ? 'rgba(200,169,107,0.07)' : 'rgba(255,255,255,0.02)',
                            borderStyle: 'dashed',
                          }}>
                          {/* Card header */}
                          <div className="flex justify-between items-center mb-5">
                            <span className="text-sm font-bold text-[var(--heading-color)]">{prog.programName}</span>
                            {rewardReady && coupon
                              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(200,169,107,0.20)', color: 'rgba(200,169,107,1)' }}>Reward Ready!</span>
                              : rewardPendingReset
                              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(14,165,160,0.15)', color: 'rgba(14,165,160,0.9)' }}>Free wash booked!</span>
                              : <span className="text-xs" style={{ color: 'rgba(200,169,107,0.65)' }}>{prog.completedBookings} / {prog.triggerBookings} washes</span>
                            }
                          </div>

                          {/* Stamp slots */}
                          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${prog.triggerBookings}, 1fr)` }}>
                            {Array.from({ length: prog.triggerBookings }).map((_, i) => {
                              const filled = i < displayCompleted;
                              return (
                                <div key={i} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 py-3 transition-all"
                                  style={{
                                    borderColor: filled ? 'rgba(200,169,107,0.8)' : 'rgba(200,169,107,0.18)',
                                    borderStyle: filled ? 'solid' : 'dashed',
                                    background:  filled ? 'rgba(200,169,107,0.12)' : 'rgba(255,255,255,0.02)',
                                  }}>
                                  <Car size={22} style={{ color: filled ? 'rgba(200,169,107,1)' : 'rgba(200,169,107,0.22)' }} />
                                  <span className="text-[10px] font-bold" style={{ color: filled ? 'rgba(200,169,107,0.9)' : 'rgba(200,169,107,0.25)' }}>{i + 1}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden mb-3">
                            <div className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: rewardPendingReset ? '0%' : `${prog.progressPercent}%`, background: 'linear-gradient(90deg, rgba(200,169,107,0.9), rgba(14,165,160,0.85))' }} />
                          </div>

                          {/* Reward CTA */}
                          {rewardReady && coupon ? (
                            <div className="mt-3 flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 min-w-0" style={{ background: 'rgba(0,0,0,0.22)' }}>
                                <code className="text-yellow-300 font-mono text-sm font-bold tracking-widest truncate">{coupon.personalCode}</code>
                                <button onClick={() => copyCode(coupon.personalCode)} className="text-[var(--muted-color)] hover:text-white transition ml-auto flex-shrink-0" title="Copy">
                                  {copiedCode === coupon.personalCode ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                                </button>
                              </div>
                              <button
                                onClick={() => navigate(`/booking?coupon=${coupon.personalCode}`)}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition flex-shrink-0"
                                style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>
                                Book Free Wash <ArrowRight size={14} />
                              </button>
                            </div>
                          ) : rewardPendingReset ? (
                            <p className="text-xs mt-2" style={{ color: 'rgba(14,165,160,0.75)' }}>
                              Your free wash is booked! Stamps will reset once your wash is completed.
                            </p>
                          ) : (
                            <p className="text-xs" style={{ color: 'rgba(200,169,107,0.5)' }}>
                              {prog.bookingsToNext} more wash{prog.bookingsToNext !== 1 ? 'es' : ''} to earn your free wash.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm mb-4 text-[var(--muted-color)]">No active loyalty programs right now.</p>
                )
              )}

              {/* Extra coupons (admin-issued or overflow) */}
              {loyalty.availableCoupons?.length > (loyalty.programs?.filter(p => p.bookingsToNext === 0).length ?? 0) && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Gift size={14} className="text-yellow-300" />
                    <span className="text-sm font-bold" style={{ color: 'rgba(200,169,107,0.90)' }}>Other Rewards</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {loyalty.availableCoupons.slice(loyalty.programs?.filter(p => p.bookingsToNext === 0).length ?? 0).map((coupon) => (
                      <div key={coupon.id} className="rounded-xl border p-4" style={{ borderColor: 'rgba(200,169,107,0.20)', background: 'rgba(200,169,107,0.04)' }}>
                        <p className="text-sm font-semibold text-[var(--heading-color)] mb-2">{coupon.offerName}</p>
                        <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(0,0,0,0.18)' }}>
                          <code className="text-yellow-300 font-mono text-sm font-bold tracking-widest">{coupon.personalCode}</code>
                          <button onClick={() => copyCode(coupon.personalCode)} className="text-[var(--muted-color)] hover:text-white transition" title="Copy">
                            {copiedCode === coupon.personalCode ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                          </button>
                        </div>
                        <button
                          onClick={() => navigate(`/booking?coupon=${coupon.personalCode}`)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition"
                          style={{ background: 'rgba(200,169,107,0.9)', color: '#0a0a0a' }}>
                          Book with Reward <ArrowRight size={14} />
                        </button>
                        {coupon.expiresAt && (
                          <p className="text-[10px] mt-2 text-center" style={{ color: 'rgba(200,169,107,0.55)' }}>
                            Expires {new Date(coupon.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="glass-card mb-6 flex items-start gap-3 rounded-xl border border-red-500/25 p-4">
            <AlertCircle size={17} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Filter chips ────────────────────────────────────────────────── */}
        <div className="glass-card p-3 mb-6 flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                filterStatus === status
                  ? 'bg-primary text-[var(--ink)]'
                  : 'text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-white/5'
              }`}>
              {status}
            </button>
          ))}
        </div>

        {/* ── Booking cards ───────────────────────────────────────────────── */}
        {filteredBookings.length > 0 ? (
          <div className="space-y-5">
            {filteredBookings.map((booking) => {
              const StatusIcon = statusConfig[booking.status]?.icon || defaultStatusIcon;
              const statusColor = statusConfig[booking.status]?.color || 'bg-gray-500/15 text-gray-400';
              const accentColor = STATUS_ACCENT[booking.status] || 'rgba(200,169,107,0.7)';
              const canCancel  = booking.status === 'Pending' || booking.status === 'Confirmed';
              const canEdit    = booking.status === 'Pending' || booking.status === 'Confirmed';

              return (
                <div
                  key={booking.id}
                  data-customer-booking-id={booking.id}
                  onMouseMove={handlePrismMouseMove}
                  className={`glass-card prism-glass overflow-hidden transition-all duration-300 ${
                    highlightedBookingId === booking.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--surface-bg)]' : ''
                  }`}
                >
                  {/* Status accent line */}
                  <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

                  {/* Prism ray */}
                  <div className="prism-ray" />

                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--muted-color)] mb-1">Booking Reference</p>
                      <p className="text-base font-black text-[var(--heading-color)] tracking-wide">{booking.bookingNumber}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusColor}`}>
                      <StatusIcon size={13} /> {booking.status}
                    </span>
                  </div>

                  <div className="p-5">
                    {/* Quick info grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      {[
                        { icon: Calendar, label: 'Date',   value: new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                        { icon: Clock,    label: 'Time',   value: booking.timeSlot },
                        { icon: Car,      label: 'Vehicle',value: [booking.vehicleYear, booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' ') || booking.vehicleType || '—' },
                        { icon: Package,  label: 'Total',  value: formatQAR(booking.totalAmount), highlight: true },
                      ].map(({ icon: Icon, label, value, highlight }) => (
                        <div key={label} className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon size={13} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--muted-color)]">{label}</p>
                            <p className={`text-sm font-bold mt-0.5 truncate ${highlight ? 'text-primary' : 'text-[var(--heading-color)]'}`}>{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Package line items */}
                    <div className="rounded-xl border border-[var(--border-color)] bg-white/2 px-4 py-3 mb-5 space-y-2">
                      {booking.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-[var(--muted-color)]">
                            {item.packageName}
                            <span className="ml-1.5 text-xs opacity-60">({item.packageTier})</span>
                            {item.quantity > 1 && <span className="ml-1 opacity-60">×{item.quantity}</span>}
                          </span>
                          <span className="font-bold text-primary">{formatQAR(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2.5 pt-4 border-t border-[var(--border-color)]">
                      <Link to={`/booking-confirmation/${booking.bookingNumber}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-color)] text-[var(--text-color)] hover:border-primary/50 hover:text-primary transition">
                        View Details <ChevronRight size={14} />
                      </Link>

                      {canEdit && (
                        <button onClick={() => openEditModal(booking)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-primary/30 text-primary bg-primary/8 hover:bg-primary/15 transition">
                          <Edit2 size={13} /> Edit
                        </button>
                      )}

                      {canCancel && (
                        <button onClick={() => handleCancelBooking(booking.id, booking.bookingNumber)}
                          disabled={cancellingId === booking.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-red-500/25 text-red-400 bg-red-500/8 hover:bg-red-500/15 transition disabled:opacity-50">
                          <XCircle size={13} /> {cancellingId === booking.id ? 'Submitting…' : 'Request Cancellation'}
                        </button>
                      )}

                      {booking.status === 'Completed' && (
                        <>
                          <button onClick={() => setFeedbackModal(booking)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-color)] text-[var(--text-color)] bg-[var(--surface-bg)]">
                            <Star size={13} /> Feedback
                          </button>
                          <button onClick={() => handleBookAgain(booking)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold premium-btn">
                            Book Again <ArrowRight size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Empty state ─────────────────────────────────────────────── */
          <div className="glass-card p-14 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(200,169,107,0.08)', border: '1px solid rgba(200,169,107,0.20)' }}>
              <Package size={24} style={{ color: 'rgba(200,169,107,0.7)' }} />
            </div>
            <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)] mb-2">No Bookings Found</h2>
            <p className="text-[var(--muted-color)] text-sm mb-6">
              {filterStatus === 'All' ? "You haven't made any bookings yet." : `No ${filterStatus.toLowerCase()} bookings.`}
            </p>
            <Link to="/booking" className="premium-btn inline-flex items-center gap-2 px-6 py-2.5 text-sm">
              Book Your First Service <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {feedbackModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: 'var(--heading-color)' }}>How was your service?</h3>
                <button onClick={() => setFeedbackModal(null)} className="p-1 rounded-lg hover:bg-[var(--surface-bg)]">
                  <X size={20} style={{ color: 'var(--muted-color)' }} />
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                {['Review', 'Complaint', 'Compliment'].map(type => (
                  <button key={type} onClick={() => setFeedbackData({ ...feedbackData, type, rating: type === 'Complaint' ? 0 : 5 })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${feedbackData.type === type ? 'bg-[var(--cta-color)] text-white' : 'bg-[var(--surface-bg)]'}`}
                    style={{ color: feedbackData.type === type ? 'white' : 'var(--text-color)', border: '1px solid var(--border-color)' }}>
                    {type === 'Review' ? '👍 Review' : type === 'Complaint' ? '😞 Complaint' : '⭐ Compliment'}
                  </button>
                ))}
              </div>
              {feedbackData.type === 'Review' && (
                <div className="mb-4">
                  <p className="text-sm mb-2" style={{ color: 'var(--muted-color)' }}>Rating</p>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(i => (
                      <button key={i} onClick={() => setFeedbackData({ ...feedbackData, rating: i })} className="p-2 rounded-lg transition">
                        <Star size={28} className={i <= feedbackData.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-4">
                <p className="text-sm mb-2" style={{ color: 'var(--muted-color)' }}>{feedbackData.type === 'Complaint' ? 'Tell us what went wrong:' : 'Comments (optional):'}</p>
                <textarea value={feedbackData.comment} onChange={(e) => setFeedbackData({ ...feedbackData, comment: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl h-24" style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                  placeholder={feedbackData.type === 'Complaint' ? 'Please describe the issue...' : 'Any additional comments?'} />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="anonymous" checked={feedbackData.isAnonymous} onChange={(e) => setFeedbackData({ ...feedbackData, isAnonymous: e.target.checked })} className="rounded" />
                <label htmlFor="anonymous" className="text-sm" style={{ color: 'var(--muted-color)' }}>Submit anonymously</label>
              </div>
              <button onClick={submitFeedback} disabled={submittingFeedback} className="w-full py-3 rounded-xl font-bold text-white bg-[var(--cta-color)] hover:opacity-90 disabled:opacity-50">
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyBookings;
