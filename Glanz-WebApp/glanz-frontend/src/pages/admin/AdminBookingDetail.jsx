import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { bookingsAPI } from '../../api/bookings';
import { packagesAPI } from '../../api/packages';
import { authAPI } from '../../api/auth';
import { subscribeToNotifications } from '../../api/signalr';
import {
  Calendar, Clock, User, Mail, Phone, Package,
  Edit2, X, Check, AlertCircle, Car, CheckCircle, Wrench, ArrowLeft, ChevronDown,
} from 'lucide-react';
import { formatQAR } from '../../utils/currency';
import { statusColors as statusConfig, paymentStatusColors as paymentStatusConfig } from '../../utils/statusConfig';
import { useToast } from '../../components/shared/Toast';
import AvailabilityCalendar from '../../components/shared/AvailabilityCalendar';

const VEHICLE_TYPES = ['Motorcycle', 'Sedan', 'SUV', 'Pickup'];
const TIME_SLOTS    = ['09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00'];

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
  0%,100% { transform: translate(0,0) rotate(0deg);           opacity: 0.20; }
  33%      { transform: translate(14px,-18px) rotate(120deg); opacity: 0.36; }
  66%      { transform: translate(-8px,10px)  rotate(240deg); opacity: 0.25; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.45),  0 0 24px rgba(255,165,0,.18); }
  33%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.45),  0 0 24px rgba(160,0,255,.18); }
  66%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.45),  0 0 24px rgba(255,0,100,.18); }
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.04) 15%, rgba(255,200,0,.06) 30%,
    rgba(0,255,145,.05) 50%, rgba(0,145,255,.05) 70%,
    rgba(195,0,255,.04) 85%, transparent 100%);
}
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.80) 12%, rgba(255,165,0,.85) 24%,
    rgba(255,255,0,.85) 36%, rgba(0,255,100,.85) 48%,
    rgba(0,150,255,.85) 60%, rgba(150,0,255,.80) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.42;
}
.cta-prism-glow { animation: cta-rainbow-glow 5s ease-in-out infinite; }
`;

/* ── Helpers ─────────────────────────────────────────────────── */
function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return null;
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function formatBookingTimeWindow(timeSlot, estimatedDurationMinutes) {
  if (!timeSlot) return 'N/A';
  const norm  = String(timeSlot).trim();
  const start = norm.includes('-') ? norm.split('-')[0].trim() : norm;
  const parts = start.split(':');
  if (parts.length < 2) return norm;
  const sh = Number(parts[0]), sm = Number(parts[1]);
  const dur = Number(estimatedDurationMinutes);
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(dur) || dur <= 0) return norm;
  const endTotal = sh * 60 + sm + dur;
  const eh = Math.floor(endTotal / 60), em = endTotal % 60;
  return `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')} – ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
}
function isAddonItem(item) {
  const tier = String(item?.packageTier || '').trim().toLowerCase();
  const name = String(item?.packageName || '').trim().toLowerCase();
  return /add[\s_-]?on/.test(tier) || /add[\s_-]?on|service add/.test(name);
}
function getBookingBreakdown(booking) {
  const items       = booking?.items || [];
  const addonItems  = items.filter(isAddonItem);
  const baseItems   = items.filter(i => !isAddonItem(i));
  const baseTotal   = baseItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const addonsTotal = addonItems.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const finalTotal  = Number(booking?.totalAmount) || 0;
  const selectedServices = [...new Set(
    addonItems.flatMap(i => i.includedServices || []).map(n => String(n || '').trim()).filter(Boolean)
  )];
  return { baseItems, addonItems, selectedServices, baseTotal, addonsTotal, finalTotal };
}

/* ── Sub-components ──────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-[var(--heading-color)] leading-snug">{value}</p>
      </div>
    </div>
  );
}
function SectionCard({ title, icon: Icon, accent = '#c8a96b', children }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] overflow-hidden" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.02] border-b border-[var(--border-color)]">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center">
            <Icon size={13} className="text-primary" />
          </div>
        )}
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   ADMIN BOOKING DETAIL PAGE
════════════════════════════════════════════════════════════ */
export default function AdminBookingDetail() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { id }    = useParams();

  const toast   = useToast();
  const [booking, setBooking] = useState(location.state?.booking ?? null);
  const [loading, setLoading] = useState(!location.state?.booking);
  const [workers, setWorkers] = useState([]);
  const [availableWorkers, setAvailableWorkers]         = useState(null);
  const [loadingAvailableWorkers, setLoadingAvailableWorkers] = useState(false);

  /* Edit */
  const [editMode,    setEditMode]    = useState(false);
  const [editForm,    setEditForm]    = useState({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [editError,   setEditError]   = useState('');
  const [editSlots,   setEditSlots]   = useState([]);
  const [editSlotsLoading,       setEditSlotsLoading]       = useState(false);
  const [editConfirm,            setEditConfirm]            = useState(false);
  const [allPackages,            setAllPackages]            = useState([]);
  const [editPackageSlotWarning, setEditPackageSlotWarning] = useState(null);

  const [checklistOpen, setChecklistOpen] = useState(false);

  /* Cancel & Refund */
  const [showCancelPanel,     setShowCancelPanel]     = useState(false);
  const [feeInfo,             setFeeInfo]             = useState(null);
  const [feeInfoLoading,      setFeeInfoLoading]      = useState(false);
  const [cancelReason,        setCancelReason]        = useState('customer');
  const [refundOverride,      setRefundOverride]      = useState('');
  const [cancelRefundLoading, setCancelRefundLoading] = useState(false);
  const [cancelRefundError,   setCancelRefundError]   = useState('');
  const [cancelRefundResult,  setCancelRefundResult]  = useState(null);

  /* Request action loading state */
  const [requestActionLoading, setRequestActionLoading] = useState(null); // 'reject-cancel' | 'reject-reschedule'

  /* ── Load booking + workers ────────────────────────────── */
  useEffect(() => {
    authAPI.getWorkers().then(d => setWorkers(d || [])).catch(() => {});
    if (!booking) {
      bookingsAPI.getById(Number(id))
        .then(b => { if (b) setBooking(b); else navigate('/admin/bookings'); })
        .catch(() => navigate('/admin/bookings'))
        .finally(() => setLoading(false));
    }
  }, []);

  const refreshBooking = async () => {
    const fresh = await bookingsAPI.getById(Number(id));
    if (fresh) setBooking(fresh);
  };

  // Auto-refresh this booking when a related notification arrives
  useEffect(() => {
    const numericId = Number(id);
    const onNotif = (notif) => {
      if (notif?.bookingId === numericId || notif?.data?.bookingId === numericId) {
        refreshBooking();
      }
    };
    return subscribeToNotifications(onNotif);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── Worker helpers ────────────────────────────────────── */
  const fetchAvailableWorkers = async (overrides) => {
    const isExplicit = overrides && overrides.date;
    if (loadingAvailableWorkers || !booking) return;
    if (!isExplicit && availableWorkers) return;
    const params = isExplicit ? overrides : {};
    try {
      setLoadingAvailableWorkers(true);
      const data = await bookingsAPI.getAvailableWorkers(booking.id, params);
      setAvailableWorkers(data || []);
    } catch {} finally { setLoadingAvailableWorkers(false); }
  };
  const workerLabelById = (workerId) => {
    const w = workers.find(w => w.id === workerId);
    if (!w) return 'Unassigned';
    const label = `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`;
    return w.isActive === false ? `${label} (Inactive)` : label;
  };
  const workerOptions = availableWorkers
    ? availableWorkers.map(w => ({
        workerId: w.workerId,
        label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.workerId}`,
        isAvailable: w.isAvailable,
        note: w.note,
      }))
    : workers.map(w => ({
        workerId: w.id,
        label: `${w.firstName || ''} ${w.lastName || ''}`.trim() || w.email || `Worker #${w.id}`,
        isAvailable: w.isActive !== false,
        note: w.isActive === false ? 'Inactive worker' : null,
      }));

  const handleAssignWorker = async (workerId) => {
    try {
      const parsed = workerId === '' ? null : Number(workerId);
      if (parsed !== null && availableWorkers) {
        const info = availableWorkers.find(w => w.workerId === parsed);
        if (info && !info.isAvailable) {
          alert(`Cannot assign: ${info.note || 'Schedule conflict at this booking time.'}`);
          return;
        }
      }
      await bookingsAPI.assignWorker(booking.id, parsed, false);
      await refreshBooking();
      setAvailableWorkers(null);
      toast(parsed === null ? 'Worker unassigned' : 'Worker assigned', 'success');
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to assign worker', 'error');
    }
  };

  /* ── Status helpers ────────────────────────────────────── */
  const handleStatusUpdate = async (newStatus) => {
    try {
      await bookingsAPI.updateStatus(booking.id, newStatus);
      await refreshBooking();
      toast(`Status updated to ${newStatus}`, 'success');
    } catch { toast('Failed to update status', 'error'); }
  };
  const handlePaymentStatusUpdate = async (newPaymentStatus) => {
    try {
      await bookingsAPI.updatePaymentStatus(booking.id, newPaymentStatus);
      await refreshBooking();
      toast(`Payment status updated to ${newPaymentStatus}`, 'success');
    } catch { toast('Failed to update payment status', 'error'); }
  };

  /* ── Edit helpers ──────────────────────────────────────── */
  const loadEditSlots = async (date) => {
    if (!date) return;
    try {
      setEditSlotsLoading(true);
      const slots = await bookingsAPI.getAvailableSlots(date);
      setEditSlots(slots || []);
    } catch { setEditSlots(TIME_SLOTS); }
    finally { setEditSlotsLoading(false); }
  };
  const openEditMode = async () => {
    setEditForm({
      scheduledDate:       booking.scheduledDate ? new Date(booking.scheduledDate).toISOString().split('T')[0] : '',
      timeSlot:            booking.timeSlot || '',
      vehicleMake:         booking.vehicleMake || '',
      vehicleModel:        booking.vehicleModel || '',
      vehicleYear:         booking.vehicleYear || '',
      vehicleType:         booking.vehicleType || 'Sedan',
      customerAddress:     booking.customerAddress || '',
      houseNumber:         booking.houseNumber || '',
      addressType:         booking.addressType || 'Home',
      specialInstructions: booking.specialInstructions || '',
      packages: (booking.items || []).map(i => ({ packageId: i.packageId, quantity: i.quantity })),
    });
    setEditMode(true); setEditError(''); setEditSlots([]); setEditPackageSlotWarning(null);
    if (allPackages.length === 0) {
      try { const pkgs = await packagesAPI.getAllAdmin(); setAllPackages(pkgs || []); } catch {}
    }
    const currentDate = booking.scheduledDate ? new Date(booking.scheduledDate).toISOString().split('T')[0] : '';
    await Promise.all([
      loadEditSlots(currentDate),
      fetchAvailableWorkers({ date: currentDate, timeSlot: booking.timeSlot }),
    ]);
  };
  const handleEditDateChange = async (newDate) => {
    setEditForm(prev => ({ ...prev, scheduledDate: newDate, timeSlot: '' }));
    setAvailableWorkers(null);
    await loadEditSlots(newDate);
    await fetchAvailableWorkers({ date: newDate, timeSlot: '' });
  };
  const handlePackageToggle = (packageId) => {
    setEditForm(prev => ({ ...prev, packages: [{ packageId, quantity: 1 }] }));
    setEditPackageSlotWarning(null);
    if (editForm.scheduledDate) loadEditSlots(editForm.scheduledDate);
  };
  const handleSaveEdit = async () => {
    try {
      setEditSaving(true); setEditError(''); setEditPackageSlotWarning(null);
      const dto = {};
      if (editForm.scheduledDate)                  dto.scheduledDate        = `${editForm.scheduledDate}T12:00:00.000Z`;
      if (editForm.timeSlot)                       dto.timeSlot             = editForm.timeSlot;
      if (editForm.vehicleMake  !== undefined)     dto.vehicleMake          = editForm.vehicleMake;
      if (editForm.vehicleModel !== undefined)     dto.vehicleModel         = editForm.vehicleModel;
      if (editForm.vehicleYear  !== undefined)     dto.vehicleYear          = editForm.vehicleYear;
      if (editForm.vehicleType)                    dto.vehicleType          = editForm.vehicleType;
      if (editForm.customerAddress !== undefined)  dto.customerAddress      = editForm.customerAddress;
      if (editForm.houseNumber  !== undefined)     dto.houseNumber          = editForm.houseNumber;
      if (editForm.addressType  !== undefined)     dto.addressType          = editForm.addressType;
      if (editForm.specialInstructions !== undefined) dto.specialInstructions = editForm.specialInstructions;
      if (editForm.packages?.length > 0)           dto.packages             = editForm.packages;
      const updated = await bookingsAPI.adminEdit(booking.id, dto);
      setBooking(updated); setEditMode(false); setEditConfirm(false);
      toast('Booking updated successfully', 'success');
    } catch (err) {
      const data = err?.response?.data;
      if (data?.availableSlots && Array.isArray(data.availableSlots)) {
        setEditPackageSlotWarning({ message: data.message, altSlots: data.availableSlots });
        setEditConfirm(false);
      } else {
        setEditError(data?.message || 'Failed to save changes.');
      }
    } finally { setEditSaving(false); }
  };

  /* ── Cancel & Refund ───────────────────────────────────── */
  const openCancelPanel = async () => {
    setShowCancelPanel(true); setCancelRefundError(''); setCancelRefundResult(null);
    setFeeInfo(null); setRefundOverride('');
    try {
      setFeeInfoLoading(true);
      const data = await bookingsAPI.getCancellationFee(booking.id);
      setFeeInfo(data);
      setRefundOverride(String(Math.max(0, data.bookingTotal - data.calculatedFee)));
    } catch { setCancelRefundError('Could not load cancellation fee info.'); }
    finally { setFeeInfoLoading(false); }
  };

  /* Approve cancellation request → open the full cancel panel */
  const handleApproveCancellation = () => openCancelPanel();

  /* Reject cancellation request → clear the flag, notify customer */
  const handleRejectCancellation = async () => {
    try {
      setRequestActionLoading('reject-cancel');
      await bookingsAPI.rejectCancellationRequest(booking.id);
      await refreshBooking();
      toast('Cancellation request rejected. Customer has been notified.', 'success');
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to reject cancellation request', 'error');
    } finally {
      setRequestActionLoading(null);
    }
  };

  /* Approve reschedule request → open edit mode pre-filled with preferred date */
  const handleApproveReschedule = () => {
    const preferredDate = booking.reschedulePreferredDate;
    setEditForm((prev) => ({
      ...prev,
      scheduledDate: preferredDate ? preferredDate.split('T')[0] : prev.scheduledDate,
    }));
    setEditMode(true);
    toast("Edit form pre-filled with customer's preferred date — adjust and save to confirm.", 'info');
  };

  /* Reject reschedule request → clear the flag, notify customer */
  const handleRejectReschedule = async () => {
    try {
      setRequestActionLoading('reject-reschedule');
      await bookingsAPI.rejectRescheduleRequest(booking.id);
      await refreshBooking();
      toast('Reschedule request rejected. Customer has been notified.', 'success');
    } catch (err) {
      toast(err?.response?.data?.message || 'Failed to reject reschedule request', 'error');
    } finally {
      setRequestActionLoading(null);
    }
  };
  const handleCancelReasonChange = (reason) => {
    setCancelReason(reason);
    if (feeInfo) {
      setRefundOverride(reason === 'ourfault'
        ? String(Number(feeInfo.bookingTotal).toFixed(2))
        : String(Math.max(0, feeInfo.bookingTotal - feeInfo.calculatedFee)));
    }
  };
  const handleAdminCancelRefund = async () => {
    const override = parseFloat(refundOverride);
    const dto = Number.isFinite(override) ? { refundAmountOverride: override } : {};
    try {
      setCancelRefundLoading(true); setCancelRefundError('');
      const result = await bookingsAPI.adminCancelRefund(booking.id, dto);
      setCancelRefundResult(result);
      await refreshBooking();
      toast('Booking cancelled & refund issued', 'success');
    } catch (err) {
      setCancelRefundError(err?.response?.data?.message || 'Cancel & refund failed.');
    } finally { setCancelRefundLoading(false); }
  };

  /* ── Render guards ─────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">Loading booking…</p>
    </div>
  );
  if (!booking) return null;

  const breakdown = getBookingBreakdown(booking);

  /* ── Page ──────────────────────────────────────────────── */
  return (
    <>
      <style>{PRISM_CSS}</style>

      <div className="min-h-screen py-10 text-[var(--text-color)]"
        style={{
          background: `
            radial-gradient(circle at 8% 10%, rgba(200,169,107,0.05) 0%, transparent 40%),
            radial-gradient(circle at 92% 88%, rgba(14,165,160,0.04) 0%, transparent 36%)
          `,
        }}
      >
        <div className="container mx-auto px-4 max-w-3xl">

          {/* Back button */}
          <button type="button" onClick={() => navigate('/admin/bookings')}
            className="flex items-center gap-2 text-[var(--muted-color)] hover:text-[var(--text-color)] text-sm font-semibold mb-8 transition">
            <ArrowLeft size={16} /> Back to Bookings
          </button>

          {/* Header */}
          <div className="mb-8 relative">
            <div className="absolute -top-8 -left-12 w-80 h-64 rounded-full pointer-events-none"
              style={{ background: 'conic-gradient(from 0deg,rgba(200,169,107,.07),rgba(14,165,160,.05),rgba(200,169,107,.07))', filter: 'blur(72px)', animation: 'spectrum-float 22s ease-in-out infinite' }} />
            <div className="flex items-start justify-between gap-4 relative">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.26em] text-[var(--muted-color)]">Booking Details</p>
                  <span className="h-px w-6" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
                </div>
                <h1 className="premium-heading text-3xl font-bold text-[var(--heading-color)] mb-1">{booking.customerName}</h1>
                <p className="text-primary font-mono font-black text-sm tracking-wide">{booking.bookingNumber}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!editMode && booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
                  <button type="button" onClick={openEditMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/35 text-primary text-xs font-bold hover:bg-primary/10 transition">
                    <Edit2 size={12} /> Edit
                  </button>
                )}
                {editMode && (
                  <button type="button" onClick={() => { setEditMode(false); setEditError(''); setEditConfirm(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-[var(--muted-color)] text-xs font-bold hover:bg-white/5 transition">
                    <X size={12} /> Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mx-0 mb-6"><div className="spectrum-line" /></div>

          <div className="space-y-5">

            {/* ── Edit form ──────────────────────────────── */}
            {editMode && (
              <div className="rounded-xl border-2 border-primary/35 bg-primary/5 p-5">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/28 flex items-center justify-center">
                    <Edit2 size={13} className="text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-primary">Edit Booking</h3>
                </div>
                {editError && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 p-3">
                    <AlertCircle size={13} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-rose-300 text-sm">{editError}</p>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Scheduled Date</label>
                    <AvailabilityCalendar
                      value={editForm.scheduledDate}
                      onChange={handleEditDateChange}
                      originalDate={booking.scheduledDate ? new Date(booking.scheduledDate).toISOString().split('T')[0] : ''}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">
                      Time Slot{editSlotsLoading && <span className="ml-1.5 opacity-50 normal-case font-normal text-[10px]">checking availability…</span>}
                    </label>
                    {editSlotsLoading ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-10 rounded-xl bg-[var(--border-color)] animate-pulse opacity-40" />
                        ))}
                      </div>
                    ) : (() => {
                      const origDate = booking.scheduledDate ? new Date(booking.scheduledDate).toISOString().split('T')[0] : '';
                      const onOriginalDate = editForm.scheduledDate === origDate;
                      const slots = onOriginalDate
                        ? Array.from(new Set([booking.timeSlot, ...editSlots].filter(Boolean)))
                        : editSlots.filter(Boolean);
                      if (!slots.length) return (
                        <p className="text-xs text-[var(--muted-color)] py-3">
                          {editForm.scheduledDate ? 'No slots available on this date.' : 'Select a date above to see available slots.'}
                        </p>
                      );
                      return (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slots.map(slot => {
                            const isSelected = editForm.timeSlot === slot;
                            const isCurrent  = onOriginalDate && slot === booking.timeSlot;
                            const isAvail    = editSlots.includes(slot);
                            return (
                              <button key={slot} type="button"
                                onClick={() => {
                                  setEditForm(p => ({ ...p, timeSlot: slot }));
                                  setAvailableWorkers(null);
                                  fetchAvailableWorkers({ date: editForm.scheduledDate, timeSlot: slot });
                                }}
                                className={[
                                  'px-2 py-2.5 rounded-xl text-xs font-bold transition text-center leading-tight',
                                  isSelected
                                    ? 'bg-primary text-[var(--ink)] font-bold ring-1 ring-primary/40 ring-inset'
                                    : isCurrent && !isAvail
                                    ? 'bg-amber-500/8 text-amber-300 hover:bg-amber-500/16 border border-amber-500/30'
                                    : 'bg-[var(--surface-bg)] text-[var(--text-color)] hover:bg-primary/10 hover:text-primary border border-[var(--border-color)]',
                                ].join(' ')}
                              >
                                {slot}
                                {isCurrent && !isAvail && (
                                  <span className="block text-[9px] font-normal opacity-60 mt-0.5">current</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Vehicle Make</label>
                    <input type="text" value={editForm.vehicleMake} placeholder="e.g. Toyota"
                      onChange={(e) => setEditForm(p => ({ ...p, vehicleMake: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Vehicle Model</label>
                    <input type="text" value={editForm.vehicleModel} placeholder="e.g. Camry"
                      onChange={(e) => setEditForm(p => ({ ...p, vehicleModel: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Year</label>
                    <input type="text" value={editForm.vehicleYear} placeholder="e.g. 2022" maxLength={4}
                      onChange={(e) => setEditForm(p => ({ ...p, vehicleYear: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Vehicle Type</label>
                    <select value={editForm.vehicleType}
                      onChange={(e) => setEditForm(p => ({ ...p, vehicleType: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] rounded-xl text-sm bg-[var(--card-bg)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Service Address</label>
                    <input type="text" value={editForm.customerAddress} placeholder="Street / Area"
                      onChange={(e) => setEditForm(p => ({ ...p, customerAddress: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">House / Building No.</label>
                    <input type="text" value={editForm.houseNumber} placeholder="e.g. Villa 12"
                      onChange={(e) => setEditForm(p => ({ ...p, houseNumber: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Address Type</label>
                    <div className="flex gap-2">
                      {['Home', 'Work', 'Other'].map(t => (
                        <button key={t} type="button" onClick={() => setEditForm(p => ({ ...p, addressType: t }))}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${editForm.addressType === t ? 'bg-primary text-white border-primary' : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">Special Instructions</label>
                    <textarea value={editForm.specialInstructions} rows={2} placeholder="Notes for the detailer…"
                      onChange={(e) => setEditForm(p => ({ ...p, specialInstructions: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* Package selection */}
                {allPackages.length > 0 && (
                  <div className="mt-5">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-3">Package</label>
                    <div className="space-y-2">
                      {allPackages.map(pkg => {
                        const selected = (editForm.packages || []).some(p => p.packageId === pkg.id);
                        return (
                          <div key={pkg.id} onClick={() => handlePackageToggle(pkg.id)}
                            className={`rounded-xl border-2 p-3.5 cursor-pointer transition ${selected ? 'border-primary bg-primary/8' : 'border-[var(--border-color)] hover:border-primary/38'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-primary bg-primary' : 'border-[var(--border-color)]'}`}>
                                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1">
                                <span className="font-bold text-[var(--heading-color)] text-sm">{pkg.name}</span>
                                {pkg.tier && <span className="ml-2 text-[10px] text-[var(--muted-color)] uppercase tracking-wider">({pkg.tier})</span>}
                                {pkg.estimatedDurationMinutes && <span className="ml-2 text-xs text-[var(--muted-color)]">{pkg.estimatedDurationMinutes}min</span>}
                              </div>
                              <span className="text-sm font-black text-primary">{formatQAR(pkg.price)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {(editForm.packages || []).length === 0 && (
                      <p className="text-xs text-amber-400 mt-2">At least one package must be selected.</p>
                    )}
                  </div>
                )}

                {/* Slot-blocked warning */}
                {editPackageSlotWarning && (
                  <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-500/8 p-4">
                    <p className="text-sm font-bold text-amber-400 mb-1">Slot unavailable after package change</p>
                    <p className="text-xs text-[var(--muted-color)]">{editPackageSlotWarning.message}</p>
                    {editPackageSlotWarning.altSlots?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Available slots:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {editPackageSlotWarning.altSlots.map(slot => (
                            <button key={slot} type="button"
                              onClick={() => { setEditForm(p => ({ ...p, timeSlot: slot })); setEditPackageSlotWarning(null); }}
                              className="px-3 py-1 text-xs font-bold rounded-lg border border-primary text-primary hover:bg-primary/12 transition">
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!editPackageSlotWarning.altSlots || !editPackageSlotWarning.altSlots.length) && (
                      <p className="text-xs text-amber-400 mt-2">No slots available on this date — please pick a different date.</p>
                    )}
                  </div>
                )}

                {/* Confirm step */}
                {editConfirm ? (
                  <div className="mt-5 rounded-xl border border-primary/28 bg-[var(--card-bg)] p-5">
                    <p className="text-sm font-bold text-[var(--heading-color)] mb-3">Confirm changes to {booking.bookingNumber}?</p>
                    <ul className="text-xs text-[var(--muted-color)] space-y-1 mb-4">
                      {editForm.scheduledDate && <li>• Date: {editForm.scheduledDate}</li>}
                      {editForm.timeSlot && <li>• Time: {editForm.timeSlot}</li>}
                      {editForm.vehicleMake && <li>• Vehicle: {editForm.vehicleYear} {editForm.vehicleMake} {editForm.vehicleModel}</li>}
                      {editForm.customerAddress && <li>• Address: {editForm.customerAddress}</li>}
                      {editForm.packages?.length > 0 && (
                        <li>• Packages: {editForm.packages.map(p => {
                          const pkg = allPackages.find(x => x.id === p.packageId);
                          return `${pkg?.name || `#${p.packageId}`}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`;
                        }).join(', ')}</li>
                      )}
                    </ul>
                    <div className="flex gap-3">
                      <button type="button" onClick={handleSaveEdit} disabled={editSaving}
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition disabled:opacity-60">
                        <Check size={14} />{editSaving ? 'Saving…' : 'Yes, save changes'}
                      </button>
                      <button type="button" onClick={() => setEditConfirm(false)}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                        Go back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => setEditConfirm(true)}
                      disabled={editForm.packages !== undefined && editForm.packages.length === 0}
                      className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      <Check size={14} /> Review & Save
                    </button>
                    <button type="button" onClick={() => { setEditMode(false); setEditError(''); setEditConfirm(false); }}
                      className="px-5 py-2.5 rounded-xl font-bold text-sm border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Customer & Vehicle ──────────────────────── */}
            <div className="grid sm:grid-cols-2 gap-4">
              <SectionCard title="Customer" icon={User} accent="#c8a96b">
                <div className="space-y-3.5">
                  <InfoRow icon={User}  label="Name"  value={booking.customerName}  />
                  <InfoRow icon={Mail}  label="Email" value={booking.customerEmail} />
                  <InfoRow icon={Phone} label="Phone" value={booking.customerPhone} />
                </div>
              </SectionCard>
              <SectionCard title="Vehicle" icon={Car} accent="#0ea5a0">
                <InfoRow icon={Car} label="Vehicle"
                  value={`${booking.vehicleYear || ''} ${booking.vehicleMake || ''} ${booking.vehicleModel || ''}`.trim() || 'Not specified'}
                />
                {booking.vehicleType && <div className="mt-3.5"><InfoRow icon={Car} label="Type" value={booking.vehicleType} /></div>}
                {booking.customerAddress && (
                  <div className="mt-3.5">
                    <InfoRow icon={Car} label={`${booking.addressType || 'Service'} Address`} value={booking.customerAddress} />
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Schedule ────────────────────────────────── */}
            <SectionCard title="Schedule & Duration" icon={Calendar} accent="#c8a96b">
              <div className="grid sm:grid-cols-2 gap-4">
                <InfoRow icon={Calendar} label="Scheduled Date"
                  value={new Date(booking.scheduledDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <InfoRow icon={Clock} label="Time Window"
                  value={formatBookingTimeWindow(booking.timeSlot, booking.estimatedDurationMinutes)}
                />
                <InfoRow icon={Clock} label="Est. Duration" value={`${booking.estimatedDurationMinutes} minutes`} />
                {booking.status === 'Completed' && (
                  <InfoRow icon={CheckCircle} label="Actual Duration" value={formatDuration(booking.workDurationSeconds) || 'N/A'} />
                )}
              </div>
            </SectionCard>

            {/* ── Customer requests ───────────────────────── */}
            {(booking.cancellationRequested || booking.rescheduleRequested) && (
              <div className="rounded-xl border border-amber-500/28 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={14} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-amber-400">Customer Requests</h3>
                </div>
                {booking.cancellationRequested && (
                  <div className="rounded-xl border border-rose-500/22 bg-[var(--card-bg)] p-4 mb-3">
                    <p className="text-sm font-bold text-rose-400 mb-1">🚫 Cancellation Request</p>
                    <p className="text-sm text-[var(--text-color)]">{booking.cancellationRequestReason || 'No reason provided'}</p>
                    {booking.cancellationRequestedAt && (
                      <p className="text-[11px] text-[var(--muted-color)] mt-1">Requested: {new Date(booking.cancellationRequestedAt).toLocaleString()}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleApproveCancellation}
                        className="flex-1 py-2 px-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition"
                      >
                        ✓ Approve (Cancel &amp; Refund)
                      </button>
                      <button
                        onClick={handleRejectCancellation}
                        disabled={requestActionLoading === 'reject-cancel'}
                        className="flex-1 py-2 px-3 rounded-lg bg-[var(--card-border)] border border-[var(--card-border)] text-[var(--muted-color)] text-xs font-bold hover:text-[var(--text-color)] transition disabled:opacity-50"
                      >
                        {requestActionLoading === 'reject-cancel' ? '…' : '✕ Reject Request'}
                      </button>
                    </div>
                  </div>
                )}
                {booking.rescheduleRequested && (
                  <div className="rounded-xl border border-blue-500/22 bg-[var(--card-bg)] p-4">
                    <p className="text-sm font-bold text-blue-400 mb-1">📅 Reschedule Request</p>
                    {booking.reschedulePreferredDate && (
                      <p className="text-sm text-[var(--text-color)]">Preferred: {booking.reschedulePreferredDate}</p>
                    )}
                    {booking.rescheduleRequestNote && (
                      <p className="text-sm text-[var(--muted-color)] mt-1">{booking.rescheduleRequestNote}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleApproveReschedule}
                        className="flex-1 py-2 px-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/25 transition"
                      >
                        ✓ Approve (Edit Date)
                      </button>
                      <button
                        onClick={handleRejectReschedule}
                        disabled={requestActionLoading === 'reject-reschedule'}
                        className="flex-1 py-2 px-3 rounded-lg bg-[var(--card-border)] border border-[var(--card-border)] text-[var(--muted-color)] text-xs font-bold hover:text-[var(--text-color)] transition disabled:opacity-50"
                      >
                        {requestActionLoading === 'reject-reschedule' ? '…' : '✕ Reject Request'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Booking controls ────────────────────────── */}
            <SectionCard title="Booking Controls" icon={Wrench} accent="#0ea5a0">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Status</p>
                  <select value={booking.status} onChange={(e) => handleStatusUpdate(e.target.value)}
                    className={`${statusConfig[booking.status]} w-full px-3 py-2.5 rounded-xl text-sm font-bold border-0 cursor-pointer focus:outline-none`}>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Payment</p>
                  <select value={booking.paymentStatus} onChange={(e) => handlePaymentStatusUpdate(e.target.value)}
                    className={`${paymentStatusConfig[booking.paymentStatus]} w-full px-3 py-2.5 rounded-xl text-sm font-bold border-0 cursor-pointer focus:outline-none`}>
                    <option value="PreAuthorized">Pre-Auth</option>
                    <option value="Paid">Paid</option>
                    <option value="Failed">Failed</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
              </div>

              {booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Assigned Worker</p>
                  <select value={booking.assignedWorkerId ?? ''} onChange={(e) => handleAssignWorker(e.target.value)}
                    onFocus={() => !editMode && fetchAvailableWorkers()}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">— Unassigned —</option>
                    {workerOptions.map(w => (
                      <option key={w.workerId} value={w.workerId}>
                        {w.isAvailable ? w.label : `⚠ ${w.label} (${w.note || 'Unavailable'})`}
                      </option>
                    ))}
                  </select>
                  {loadingAvailableWorkers && (
                    <p className="text-[11px] text-[var(--muted-color)] mt-1.5">Checking worker availability…</p>
                  )}
                  {!loadingAvailableWorkers && !availableWorkers && (
                    <p className="text-[11px] text-[var(--muted-color)] mt-1.5">Open dropdown to check live availability.</p>
                  )}
                </div>
              )}
              {(booking.status === 'Completed' || booking.status === 'Cancelled') && booking.assignedWorkerId && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Assigned Worker</p>
                  <p className="text-sm font-bold text-[var(--heading-color)]">{workerLabelById(booking.assignedWorkerId)}</p>
                </div>
              )}
            </SectionCard>

            {/* ── Completion card ─────────────────────────── */}
            {booking.status === 'Completed' && (
              <div className="rounded-xl border border-green-500/28 bg-green-500/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-green-400" />
                  <h3 className="text-sm font-bold text-green-400">Actual Completion Time</h3>
                </div>
                <p className="text-2xl font-black text-green-400">{formatDuration(booking.workDurationSeconds) || 'Not available'}</p>
                {booking.workStartedAt && booking.workCompletedAt && (
                  <p className="text-xs text-green-300/65 mt-2">
                    Started: {new Date(booking.workStartedAt).toLocaleString()} · Finished: {new Date(booking.workCompletedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* ── Package & add-ons ───────────────────────── */}
            <SectionCard title="Package & Add-Ons" icon={Package} accent="#c8a96b">
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Base Package</p>
                {breakdown.baseItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted-color)]">No base package found.</p>
                ) : (
                  <div className="space-y-1.5">
                    {breakdown.baseItems.map((item, i) => (
                      <div key={`base-${i}`} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--heading-color)] font-semibold">• {item.packageName} <span className="text-[var(--muted-color)] font-normal">×{item.quantity || 1}</span></span>
                        <span className="text-primary font-bold">{formatQAR(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Add-Ons</p>
                {breakdown.addonItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted-color)]">No add-ons selected.</p>
                ) : (
                  <div className="space-y-1.5">
                    {breakdown.addonItems.map((item, i) => (
                      <div key={`addon-${i}`} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--heading-color)] font-semibold">• {item.packageName} <span className="text-[var(--muted-color)] font-normal">×{item.quantity || 1}</span></span>
                        <span className="text-primary font-bold">{formatQAR(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {breakdown.selectedServices.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Services Chosen</p>
                  <p className="text-sm text-[var(--heading-color)]">{breakdown.selectedServices.join(', ')}</p>
                </div>
              )}
              <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-color)]">Before Add-Ons</span>
                  <span className="font-bold text-[var(--heading-color)]">{formatQAR(breakdown.baseTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-color)]">Add-Ons</span>
                  <span className="font-bold text-[var(--heading-color)]">+ {formatQAR(breakdown.addonsTotal)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-3 mt-1">
                  <span className="text-sm font-bold text-emerald-400">Total</span>
                  <span className="text-2xl font-black text-primary">{formatQAR(breakdown.finalTotal)}</span>
                </div>
              </div>
            </SectionCard>

            {/* ── Checklist ───────────────────────────────── */}
            {(booking.checklistItems || []).length > 0 && (() => {
              const items = booking.checklistItems.slice().sort((a, b) => a.displayOrder - b.displayOrder);
              const doneCount = items.filter(i => i.isCompleted).length;
              return (
                <div className="rounded-xl border border-[var(--border-color)] overflow-hidden" style={{ borderLeft: '3px solid #0ea5a0' }}>
                  <button type="button" onClick={() => setChecklistOpen(o => !o)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 bg-white/[0.02] border-b border-[var(--border-color)] hover:bg-white/[0.04] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-primary/12 border border-primary/22 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={13} className="text-primary" />
                    </div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] flex-1 text-left">Detailer Checklist</h3>
                    <span className="text-[11px] text-[var(--muted-color)] mr-2">{doneCount}/{items.length} done</span>
                    <ChevronDown size={14} className={`text-[var(--muted-color)] transition-transform ${checklistOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {checklistOpen && (
                    <div className="p-5 space-y-2">
                      {items.map(item => (
                        <div key={item.id}
                          className={`flex items-start gap-3 rounded-xl border p-3.5 ${item.isCompleted ? 'border-green-500/22 bg-green-500/5' : 'border-[var(--border-color)]'}`}>
                          <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.isCompleted ? 'bg-green-500 border-green-500' : 'border-[var(--border-color)]'}`}>
                            {item.isCompleted && <Check size={10} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${item.isCompleted ? 'text-green-400 line-through opacity-65' : 'text-[var(--heading-color)]'}`}>
                              {item.label}
                            </p>
                            {item.completedAt && (
                              <p className="text-[11px] text-green-400/65 mt-0.5">Completed: {new Date(item.completedAt).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Finance strip ───────────────────────────── */}
            <div className="glass-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #c8a96b 38%, #0ea5a0 62%, transparent)' }} />
              <div className="grid grid-cols-3 divide-x divide-[var(--border-color)]">
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Revenue</p>
                  <p className="text-2xl font-black text-primary">{formatQAR(booking.totalAmount)}</p>
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Cost</p>
                  <p className="text-2xl font-black text-rose-400">{formatQAR(booking.estimatedCost)}</p>
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Profit</p>
                  <p className={`text-2xl font-black ${booking.estimatedProfit >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                    {formatQAR(booking.estimatedProfit)}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Cancel & Refund ─────────────────────────── */}
            {booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
              <div className="rounded-xl border border-rose-500/28 overflow-hidden">
                <button type="button"
                  onClick={() => showCancelPanel ? setShowCancelPanel(false) : openCancelPanel()}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-rose-500/5 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/14 border border-rose-500/22 flex items-center justify-center">
                      <X size={13} className="text-rose-400" />
                    </div>
                    <span className="text-sm font-bold text-rose-400">Cancel Booking &amp; Issue Refund</span>
                  </div>
                  <span className={`text-rose-400 text-xs transition-transform ${showCancelPanel ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {showCancelPanel && (
                  <div className="border-t border-rose-500/18 px-5 pb-6 pt-5 space-y-4">
                    {cancelRefundResult ? (
                      <div className="rounded-xl border border-green-500/28 bg-green-500/8 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={13} className="text-green-400" />
                          <p className="text-sm font-bold text-green-400">Done</p>
                        </div>
                        <p className="text-sm text-[var(--heading-color)]">{cancelRefundResult.message}</p>
                        {cancelRefundResult.stripeRefundId && (
                          <p className="text-xs text-[var(--muted-color)]">Stripe Refund ID: {cancelRefundResult.stripeRefundId}</p>
                        )}
                        <p className="text-xs text-[var(--muted-color)]">
                          Status: {cancelRefundResult.bookingStatus} · Payment: {cancelRefundResult.paymentStatus}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-2">Cancellation Reason</p>
                          <div className="flex gap-2">
                            {[
                              { key: 'customer', label: 'Customer Request' },
                              { key: 'ourfault', label: 'Our Fault / No-show' },
                            ].map(({ key, label }) => (
                              <button key={key} type="button" onClick={() => handleCancelReasonChange(key)}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                                  cancelReason === key
                                    ? key === 'customer'
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                      : 'bg-blue-500/20 border-blue-500 text-blue-400'
                                    : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                                }`}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {cancelReason === 'ourfault' && (
                            <p className="text-xs text-blue-400 mt-1.5">Full refund — no cancellation fee applied.</p>
                          )}
                        </div>

                        {feeInfoLoading && <p className="text-sm text-[var(--muted-color)]">Loading fee info…</p>}

                        {!feeInfoLoading && feeInfo && (
                          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 space-y-2.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-[var(--muted-color)]">Booking total</span>
                              <span className="font-bold text-[var(--heading-color)]">{formatQAR(feeInfo.bookingTotal)}</span>
                            </div>
                            {feeInfo.feeEnabled && !feeInfo.withinFreeWindow && feeInfo.calculatedFee > 0 ? (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted-color)]">
                                    Fee ({feeInfo.feeType === 'Percent' ? `${feeInfo.feeAmount}%` : formatQAR(feeInfo.feeAmount)}, {Math.round(feeInfo.hoursUntilAppointment)}h until appt)
                                  </span>
                                  <span className="font-bold text-rose-400">− {formatQAR(feeInfo.calculatedFee)}</span>
                                </div>
                                <div className="flex justify-between border-t border-[var(--border-color)] pt-2.5">
                                  <span className="font-bold text-[var(--heading-color)]">Auto refund</span>
                                  <span className="font-black text-green-400">{formatQAR(Math.max(0, feeInfo.bookingTotal - feeInfo.calculatedFee))}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between border-t border-[var(--border-color)] pt-2.5">
                                <span className="text-xs text-green-400">
                                  {feeInfo.withinFreeWindow
                                    ? `Free window (${Math.round(feeInfo.hoursUntilAppointment)}h until, free: ${feeInfo.freeWindowHours}h)`
                                    : 'No cancellation fee configured'}
                                </span>
                                <span className="font-black text-green-400">Full refund</span>
                              </div>
                            )}
                          </div>
                        )}

                        {!feeInfoLoading && !booking.stripePaymentIntentId?.startsWith('pi_') && (
                          <div className="flex items-start gap-2 rounded-xl border border-amber-500/22 bg-amber-500/8 px-4 py-3">
                            <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-400">No Stripe payment on file — booking will be cancelled but no Stripe refund will be processed automatically.</p>
                          </div>
                        )}

                        {!feeInfoLoading && booking.paymentStatus === 'Paid' && booking.stripePaymentIntentId?.startsWith('pi_') && (
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1.5">
                              Override Refund Amount (QAR 0 – {Number(feeInfo?.bookingTotal ?? booking.totalAmount).toFixed(2)})
                            </label>
                            <input type="number" min="0" step="0.01"
                              max={feeInfo?.bookingTotal ?? booking.totalAmount}
                              value={refundOverride}
                              onChange={(e) => setRefundOverride(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl text-sm border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                        )}

                        {cancelRefundError && (
                          <p className="text-sm text-rose-400 font-semibold">{cancelRefundError}</p>
                        )}

                        <div className="flex gap-3 pt-1">
                          <div className="flex-1 cta-prism-glow rounded-xl">
                            <button type="button" onClick={handleAdminCancelRefund}
                              disabled={cancelRefundLoading || feeInfoLoading}
                              className="w-full py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-60">
                              {cancelRefundLoading
                                ? 'Processing…'
                                : `Confirm Cancel${booking.stripePaymentIntentId?.startsWith('pi_') ? ' & Refund' : ''}`}
                            </button>
                          </div>
                          <button type="button" onClick={() => setShowCancelPanel(false)}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--text-color)] hover:bg-white/5 transition">
                            Never mind
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Back button */}
            <button type="button" onClick={() => navigate('/admin/bookings')}
              className="w-full border border-[var(--border-color)] rounded-xl py-3 text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back to Bookings
            </button>

          </div>
        </div>
      </div>
    </>
  );
}
