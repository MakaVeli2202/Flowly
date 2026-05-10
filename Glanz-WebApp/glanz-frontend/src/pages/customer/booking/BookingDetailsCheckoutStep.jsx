import React, { useCallback } from 'react';
import {
  User, Mail, Phone, MapPin, Tag, Ticket, CreditCard,
  Shield, Star, AlertCircle, Gift, Coins,
} from 'lucide-react';
import { CardElement } from '@stripe/react-stripe-js';
import AddressAutocompleteInput from '../../../components/shared/AddressAutocompleteInput';
import { SectionHeading } from './BookingShared';

const CUSTOMER_FIELDS = [
  { label: 'Full Name',     name: 'customerName',  type: 'text',  Icon: User,  placeholder: 'John Smith',      colSpan: '' },
  { label: 'Email Address', name: 'customerEmail', type: 'email', Icon: Mail,  placeholder: 'you@example.com', colSpan: '' },
  { label: 'Phone Number',  name: 'customerPhone', type: 'tel',   Icon: Phone, placeholder: '+974 3300 0000',  colSpan: 'md:col-span-2' },
];

const PAYMENT_METHODS = [
  { id: 'card',       label: 'Credit / Debit Card', Icon: CreditCard },
  { id: 'google_pay', label: 'Google Pay',          Icon: Shield },
  { id: 'apple_pay',  label: 'Apple Pay',           Icon: Star },
];

function BookingDetailsCheckoutStep({
  formData, setFormData,
  canAutofillCustomerData, isAdmin,
  savedAddresses, addressHelperText,
  myCoupons,
  isStripeMode, paymentMethod, setPaymentMethod,
  quote, totalAmount,
  userReferralPoints = 0,
}) {
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, [setFormData]);

  return (
    <>
      {/* ── 04 Customer info ────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '78%', width: '11%', animation: 'prism-ray-sweep 16s ease-in-out 7s infinite' }} />
        <SectionHeading icon={User} step={4}>Your Information</SectionHeading>
        <div className="grid md:grid-cols-2 gap-4">
          {CUSTOMER_FIELDS.map(({ label, name, type, Icon, placeholder, colSpan }) => (
            <div key={name} className={colSpan}>
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
                <input type={type} name={name} value={formData[name]} onChange={handleChange}
                  placeholder={placeholder} required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 05 Address ──────────────────────────────────────── */}
      <div className="glass-card p-6 relative">
        <div className="absolute top-0 left-8 right-8 h-[1px] pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(14,165,160,0.3), rgba(200,169,107,0.25), transparent)' }} />
        <SectionHeading icon={MapPin} step={5}>Service Address</SectionHeading>
        {canAutofillCustomerData && (
          <div className="mb-5 rounded-xl border border-[var(--border-color)] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">Saved Addresses</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(savedAddresses).map(([type, address]) => {
                const isActive = formData.addressType === type && formData.customerAddress.trim() === address.trim();
                return (
                  <button key={type} type="button" disabled={!address}
                    onClick={() => { if (!address) return; setFormData((prev) => ({ ...prev, customerAddress: address, addressType: type })); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      !address
                        ? 'opacity-30 cursor-not-allowed border-[var(--border-color)] text-[var(--muted-color)]'
                        : isActive
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-[var(--border-color)] hover:border-primary/50 text-[var(--text-color)]'
                    }`}>
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <AddressAutocompleteInput
          label="Area / Street"
          value={formData.customerAddress}
          onChange={(v) => setFormData((prev) => ({ ...prev, customerAddress: v }))}
          placeholder="Search your service address"
          required
          helperText={addressHelperText}
        />
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">Special Instructions</p>
          <textarea name="specialInstructions" value={formData.specialInstructions} onChange={handleChange}
            rows={3} placeholder="Any specific requests or concerns about your vehicle or service location…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none" />
        </div>
      </div>

      {/* ── 06 Offers ───────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '76%', width: '10%', animation: 'prism-ray-sweep 19s ease-in-out 2s infinite' }} />
        <SectionHeading icon={Tag} step={6}>Offers</SectionHeading>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">Coupon Code</p>
          <div className="relative">
            <Ticket size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
            <input type="text" name="offerCode" value={formData.offerCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, offerCode: e.target.value.toUpperCase() }))}
              placeholder="WELCOME10"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition tracking-widest font-mono" />
          </div>
          {myCoupons.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {myCoupons.slice(0, 5).map((c) => (
                <button key={c.id} type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, offerCode: c.personalCode }))}
                  className={`text-xs px-3 py-1.5 rounded-full font-mono font-semibold border transition ${
                    formData.offerCode === c.personalCode
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/50'
                  }`}>
                  {c.personalCode}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[var(--muted-color)] mt-2 leading-relaxed">
            Loyalty rewards appear here after completed bookings. Discounts are validated server-side at checkout.
          </p>
        </div>
      </div>

      {/* ── Referral Code ──────────────────────────────────── */}
      <div className="glass-card p-6 relative">
        <SectionHeading icon={Gift} step={6}>Referral Code</SectionHeading>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">Have a referral code?</p>
          <div className="relative">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-color)]" />
            <input type="text" name="referralCode" value={formData.referralCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, referralCode: e.target.value.toUpperCase() }))}
              placeholder="AHMED8K2"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition tracking-widest font-mono" />
          </div>
          <p className="text-[11px] text-[var(--muted-color)] mt-2 leading-relaxed">
            Use a friend's referral code to unlock exclusive discounts. Your friend earns rewards too!
          </p>
        </div>
      </div>

      {/* ── My Referral Points ──────────────────────────────────── */}
      {userReferralPoints > 0 && (
        <div className="glass-card p-6 relative">
          <SectionHeading icon={Coins} step={7}>My Reward Points</SectionHeading>
          <div className="flex items-center justify-between p-4 rounded-xl border"
            style={{ background: 'rgba(245,158,11,.08)', borderColor: 'rgba(245,158,11,.28)' }}>
            <div className="flex items-center gap-3">
              <Coins size={20} className="text-yellow-500" />
              <div>
                <p className="text-sm font-bold text-[var(--heading-color)]">
                  You have <span className="text-primary">{userReferralPoints}</span> points
                </p>
                <p className="text-xs text-[var(--muted-color)]">
                  1 point = 1 QAR discount
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-[var(--muted-color)]">
                {formData.useReferralPoints ? 'Using' : 'Save'}
              </span>
              <button type="button" 
                onClick={() => setFormData(prev => ({ ...prev, useReferralPoints: !prev.useReferralPoints }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${formData.useReferralPoints ? 'bg-primary' : 'bg-[var(--border-color)]'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.useReferralPoints ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>
          <p className="text-[11px] text-[var(--muted-color)] mt-2">
            {formData.useReferralPoints 
              ? `This booking will use up to ${Math.min(userReferralPoints, totalAmount)} QAR from your points.`
              : 'Save your points for a future booking with a bigger discount.'}
          </p>
        </div>
      )}

      {/* ── 08 Payment ──────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '28%', width: '13%', animation: 'prism-ray-sweep 15s ease-in-out 9s infinite' }} />
        <SectionHeading icon={CreditCard} step={7}>Payment</SectionHeading>
        {isStripeMode && totalAmount === 0 ? (
          <div className="rounded-xl border border-dashed p-5 flex items-start gap-3"
            style={{ borderColor: 'rgba(200,169,107,0.35)', background: 'rgba(200,169,107,0.04)' }}>
            <Gift size={18} className="text-yellow-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--heading-color)]">Free booking — no payment needed</p>
              <p className="text-xs text-[var(--muted-color)] mt-1">
                Your reward coupon covers the full amount. Confirm below to complete your booking.
              </p>
            </div>
          </div>
        ) : isStripeMode ? (
          <>
            <div className="flex gap-2 mb-4">
              {PAYMENT_METHODS.map(({ id, label, Icon }) => (
                <button key={id} type="button"
                  onClick={() => setPaymentMethod(id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                    paymentMethod === id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/40'
                  }`}>
                  <Icon size={16} />
                  <span className="text-[10px] leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
            {paymentMethod === 'card' ? (
              <>
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-4">
                  <CardElement options={{
                    style: {
                      base: { fontSize: '15px', color: '#E8E9EC', '::placeholder': { color: '#7A8495' } },
                      invalid: { color: '#EF4444' },
                    },
                  }} />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Shield size={11} className="text-[var(--muted-color)] flex-shrink-0" />
                  <p className="text-xs text-[var(--muted-color)]">
                    Your card will be pre-authorised. Payment is captured only after service completion.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] p-5 flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.015)' }}>
                <AlertCircle size={16} className="text-[var(--muted-color)] flex-shrink-0" />
                <p className="text-sm text-[var(--muted-color)]">
                  {paymentMethod === 'google_pay' ? 'Google Pay' : 'Apple Pay'} coming soon. Please use Credit / Debit Card to complete your booking.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-color)] p-5"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/12 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--heading-color)]">Payment placeholder active</p>
                <p className="text-sm text-[var(--muted-color)] mt-1">
                  Stripe is temporarily disabled. Bookings will be created without a payment charge — for testing purposes only.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default React.memo(BookingDetailsCheckoutStep);
