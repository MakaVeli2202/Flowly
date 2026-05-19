import React, { useState } from 'react';
import { CreditCard, Search, Loader, CheckCircle, AlertCircle, Euro } from 'lucide-react';
import apiClient from '../../api/axios';

const UI = {
  en: {
    title: 'SEPA Direct Debit',
    subtitle: 'Charge EU customers via SEPA bank transfer using their saved payment method.',
    setupTitle: 'Create SEPA Mandate',
    setupDesc: 'Generate a SetupIntent so a customer can register their IBAN.',
    setupBtn: 'Create SetupIntent',
    chargeTitle: 'Charge Booking',
    bookingNum: 'Booking Number',
    paymentMethodId: 'Stripe Payment Method ID',
    paymentMethodHint: 'The pm_... ID from a completed SetupIntent',
    chargeBtn: 'Charge via SEPA',
    loading: 'Processing...',
    success: 'Charge initiated',
    clientSecret: 'Client Secret (pass to Stripe.js to collect IBAN)',
    setupIntentId: 'SetupIntent ID',
    status: 'Status',
    paymentIntentId: 'PaymentIntent ID',
    noteTitle: 'Important',
    note: 'SEPA Direct Debit payments are not instant. They typically settle in 2-5 business days. The status will be updated via Stripe webhook when the payment clears.',
    notConfigured: 'Stripe is not configured on this server. Add Stripe:SecretKey to appsettings.',
  },
  de: {
    title: 'SEPA-Lastschrift',
    subtitle: 'EU-Kunden per SEPA-Banküberweisung mit gespeicherter Zahlungsmethode belasten.',
    setupTitle: 'SEPA-Mandat erstellen',
    setupDesc: 'SetupIntent generieren, damit ein Kunde seine IBAN hinterlegen kann.',
    setupBtn: 'SetupIntent erstellen',
    chargeTitle: 'Buchung belasten',
    bookingNum: 'Buchungsnummer',
    paymentMethodId: 'Stripe-Zahlungsmethoden-ID',
    paymentMethodHint: 'Die pm_...-ID aus einem abgeschlossenen SetupIntent',
    chargeBtn: 'Per SEPA belasten',
    loading: 'Verarbeitung...',
    success: 'Lastschrift eingereicht',
    clientSecret: 'Client Secret (an Stripe.js übergeben)',
    setupIntentId: 'SetupIntent-ID',
    status: 'Status',
    paymentIntentId: 'PaymentIntent-ID',
    noteTitle: 'Hinweis',
    note: 'SEPA-Lastschriften werden nicht sofort verarbeitet. Die Abwicklung dauert in der Regel 2-5 Werktage.',
    notConfigured: 'Stripe ist auf diesem Server nicht konfiguriert.',
  },
  ar: {
    title: 'الخصم المباشر SEPA',
    subtitle: 'تحصيل مدفوعات العملاء الأوروبيين عبر التحويل المصرفي SEPA.',
    setupTitle: 'إنشاء تفويض SEPA',
    setupDesc: 'إنشاء SetupIntent لتسجيل IBAN الخاص بالعميل.',
    setupBtn: 'إنشاء SetupIntent',
    chargeTitle: 'تحصيل الحجز',
    bookingNum: 'رقم الحجز',
    paymentMethodId: 'معرّف طريقة الدفع Stripe',
    paymentMethodHint: 'معرّف pm_... من SetupIntent مكتمل',
    chargeBtn: 'التحصيل عبر SEPA',
    loading: 'جارٍ المعالجة...',
    success: 'تم إرسال طلب التحصيل',
    clientSecret: 'Client Secret (أرسله إلى Stripe.js لجمع IBAN)',
    setupIntentId: 'معرّف SetupIntent',
    status: 'الحالة',
    paymentIntentId: 'معرّف PaymentIntent',
    noteTitle: 'ملاحظة',
    note: 'لا تتم معالجة مدفوعات SEPA فوراً. تستغرق عادةً 2-5 أيام عمل.',
    notConfigured: 'Stripe غير مضبوط على هذا الخادم.',
  },
};

export default function AdminSEPA() {
  const lang = localStorage.getItem('lang') || 'en';
  const ui = UI[lang] || UI.en;

  // Setup intent
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState(null);
  const [setupError, setSetupError] = useState('');

  // Charge
  const [bookingNumber, setBookingNumber] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeResult, setChargeResult] = useState(null);
  const [chargeError, setChargeError] = useState('');

  const createSetupIntent = async () => {
    setSetupLoading(true);
    setSetupError('');
    setSetupResult(null);
    try {
      const r = await apiClient.post('/Sepa/setup-intent');
      setSetupResult(r.data);
    } catch (e) {
      setSetupError(e?.response?.data?.message || 'Failed to create SetupIntent.');
    } finally {
      setSetupLoading(false);
    }
  };

  const chargeBooking = async () => {
    if (!bookingNumber.trim() || !paymentMethodId.trim()) return;
    setChargeLoading(true);
    setChargeError('');
    setChargeResult(null);
    try {
      const r = await apiClient.post(`/Sepa/charge/${bookingNumber.trim()}`, {
        paymentMethodId: paymentMethodId.trim(),
      });
      setChargeResult(r.data);
    } catch (e) {
      setChargeError(e?.response?.data?.message || 'Charge failed.');
    } finally {
      setChargeLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--surface-bg)' }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[var(--heading-color)] flex items-center gap-2">
            <Euro size={28} className="text-primary" />
            {ui.title}
          </h1>
          <p className="text-sm text-[var(--muted-color)] mt-1">{ui.subtitle}</p>
        </div>

        {/* Notice */}
        <div className="flex gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
          <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-blue-400 mb-0.5">{ui.noteTitle}</p>
            <p className="text-xs text-[var(--muted-color)]">{ui.note}</p>
          </div>
        </div>

        {/* Create SetupIntent */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-3">
          <h2 className="text-base font-bold text-[var(--heading-color)]">{ui.setupTitle}</h2>
          <p className="text-xs text-[var(--muted-color)]">{ui.setupDesc}</p>
          <button
            onClick={createSetupIntent}
            disabled={setupLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {setupLoading ? <Loader size={14} className="animate-spin" /> : <CreditCard size={14} />}
            {setupLoading ? ui.loading : ui.setupBtn}
          </button>
          {setupError && <p className="text-red-400 text-sm">{setupError}</p>}
          {setupResult && (
            <div className="rounded-lg bg-[var(--surface-bg)] border border-[var(--border-color)] p-3 space-y-1 text-xs font-mono">
              <div><span className="text-[var(--muted-color)]">{ui.clientSecret}:</span></div>
              <div className="text-green-400 break-all">{setupResult.clientSecret}</div>
              <div className="mt-2"><span className="text-[var(--muted-color)]">{ui.setupIntentId}:</span> <span className="text-primary">{setupResult.setupIntentId}</span></div>
            </div>
          )}
        </div>

        {/* Charge Booking */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-3">
          <h2 className="text-base font-bold text-[var(--heading-color)]">{ui.chargeTitle}</h2>
          <div className="space-y-2">
            <input
              type="text"
              placeholder={ui.bookingNum}
              value={bookingNumber}
              onChange={e => setBookingNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm"
            />
            <input
              type="text"
              placeholder={`${ui.paymentMethodId} (pm_...)`}
              value={paymentMethodId}
              onChange={e => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm"
            />
            <p className="text-xs text-[var(--muted-color)]">{ui.paymentMethodHint}</p>
          </div>
          <button
            onClick={chargeBooking}
            disabled={chargeLoading || !bookingNumber.trim() || !paymentMethodId.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {chargeLoading ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            {chargeLoading ? ui.loading : ui.chargeBtn}
          </button>
          {chargeError && <p className="text-red-400 text-sm">{chargeError}</p>}
          {chargeResult && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1 text-green-400 font-bold mb-1">
                <CheckCircle size={14} /> {ui.success}
              </div>
              <div><span className="text-[var(--muted-color)]">{ui.paymentIntentId}:</span> <span className="font-mono text-primary">{chargeResult.paymentIntentId}</span></div>
              <div><span className="text-[var(--muted-color)]">{ui.status}:</span> <span className="font-semibold text-[var(--text-color)]">{chargeResult.status}</span></div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
