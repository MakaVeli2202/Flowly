import React, { useCallback } from 'react';
import {
  User, Mail, Phone, MapPin, Tag, Ticket, CreditCard,
  Shield, Star, AlertCircle, Gift, Coins,
} from 'lucide-react';
import AddressAutocompleteInput from '../../../components/shared/AddressAutocompleteInput';
import { SectionHeading } from './BookingShared';
import { useLanguage } from '../../../context/LanguageContext';

const UI_BY_LANG = {
  en: {
    yourInformation: 'Your Information',
    serviceAddress: 'Service Address',
    savedAddresses: 'Saved Addresses',
    areaStreet: 'Area / Street',
    searchAddress: 'Search your service address',
    specialInstructions: 'Special Instructions',
    instructionsPlaceholder: 'Any specific requests or concerns about your vehicle or service location…',
    offers: 'Offers',
    couponCode: 'Coupon Code',
    referralCode: 'Referral Code',
    haveReferral: 'Have a referral code?',
    rewardPoints: 'My Reward Points',
    pointsPrefix: 'You have',
    pointsSuffix: 'points',
    onePointRule: '1 point = 1 QAR discount',
    using: 'Using',
    save: 'Save',
    usePointsInfo: (value) => `This booking will use up to ${value} QAR from your points.`,
    savePointsInfo: 'Save your points for a future booking with a bigger discount.',
    payment: 'Payment',
    freeBookingTitle: 'Free booking — no payment needed',
    freeBookingDesc: 'Your reward coupon covers the full amount. Confirm below to complete your booking.',
    preauthInfo: 'Your card will be pre-authorised. Payment is captured only after service completion.',
    payComingSoon: (method) => `${method} coming soon. Please use Credit / Debit Card to complete your booking.`,
    paymentPlaceholderTitle: 'Payment placeholder active',
    paymentPlaceholderDesc: 'Tap checkout is temporarily disabled. Bookings will be created without a payment charge — for testing purposes only.',
    loyaltyHelp: 'Loyalty rewards appear here after completed bookings. Discounts are validated server-side at checkout.',
    referralHelp: "Use a friend's referral code to unlock exclusive discounts. Your friend earns rewards too!",
    customerFields: [
      { label: 'Full Name', name: 'customerName', type: 'text', Icon: User, placeholder: 'John Smith', colSpan: '' },
      { label: 'Email Address', name: 'customerEmail', type: 'email', Icon: Mail, placeholder: 'you@example.com', colSpan: '' },
      { label: 'Phone Number', name: 'customerPhone', type: 'tel', Icon: Phone, placeholder: '+974 3300 0000', colSpan: 'md:col-span-2' },
    ],
    paymentMethods: {
      card: 'Credit / Debit Card',
      googlePay: 'Google Pay',
      applePay: 'Apple Pay',
    },
  },
  ar: {
    yourInformation: 'معلوماتك',
    serviceAddress: 'عنوان الخدمة',
    savedAddresses: 'العناوين المحفوظة',
    areaStreet: 'المنطقة / الشارع',
    searchAddress: 'ابحث عن عنوان الخدمة',
    specialInstructions: 'تعليمات خاصة',
    instructionsPlaceholder: 'أي طلبات أو ملاحظات خاصة بالمركبة أو موقع الخدمة…',
    offers: 'العروض',
    couponCode: 'رمز القسيمة',
    referralCode: 'رمز الإحالة',
    haveReferral: 'هل لديك رمز إحالة؟',
    rewardPoints: 'نقاط المكافآت',
    pointsPrefix: 'لديك',
    pointsSuffix: 'نقطة',
    onePointRule: 'كل نقطة = 1 ريال قطري خصم',
    using: 'استخدام',
    save: 'حفظ',
    usePointsInfo: (value) => `سيتم استخدام حتى ${value} ريال قطري من نقاطك في هذا الحجز.`,
    savePointsInfo: 'احفظ نقاطك لحجز مستقبلي بخصم أكبر.',
    payment: 'الدفع',
    freeBookingTitle: 'حجز مجاني - لا حاجة للدفع',
    freeBookingDesc: 'قسيمة المكافأة تغطي المبلغ بالكامل. أكد أدناه لإكمال الحجز.',
    preauthInfo: 'سيتم إجراء تفويض مبدئي للبطاقة. يتم الخصم بعد اكتمال الخدمة فقط.',
    payComingSoon: (method) => `${method} قريبا. يرجى استخدام البطاقة لإكمال الحجز.`,
    paymentPlaceholderTitle: 'وضع الدفع التجريبي مفعل',
    paymentPlaceholderDesc: 'Tap checkout معطل مؤقتا. سيتم إنشاء الحجوزات بدون تحصيل دفعة - لأغراض الاختبار فقط.',
    loyaltyHelp: 'تظهر مكافآت الولاء هنا بعد إكمال الحجوزات. يتم التحقق من الخصومات من الخادم عند الدفع.',
    referralHelp: 'استخدم رمز إحالة صديق للحصول على خصومات حصرية. وسيحصل صديقك أيضا على مكافآت.',
    customerFields: [
      { label: 'الاسم الكامل', name: 'customerName', type: 'text', Icon: User, placeholder: 'محمد أحمد', colSpan: '' },
      { label: 'البريد الإلكتروني', name: 'customerEmail', type: 'email', Icon: Mail, placeholder: 'you@example.com', colSpan: '' },
      { label: 'رقم الهاتف', name: 'customerPhone', type: 'tel', Icon: Phone, placeholder: '+974 3300 0000', colSpan: 'md:col-span-2' },
    ],
    paymentMethods: {
      card: 'بطاقة ائتمان / خصم',
      googlePay: 'جوجل باي',
      applePay: 'آبل باي',
    },
  },
  de: {
    yourInformation: 'Ihre Informationen',
    serviceAddress: 'Serviceadresse',
    savedAddresses: 'Gespeicherte Adressen',
    areaStreet: 'Bereich / Strasse',
    searchAddress: 'Serviceadresse suchen',
    specialInstructions: 'Besondere Hinweise',
    instructionsPlaceholder: 'Spezielle Wunsche oder Hinweise zum Fahrzeug oder Serviceort…',
    offers: 'Angebote',
    couponCode: 'Gutscheincode',
    referralCode: 'Empfehlungscode',
    haveReferral: 'Haben Sie einen Empfehlungscode?',
    rewardPoints: 'Meine Pramienpunkte',
    pointsPrefix: 'Sie haben',
    pointsSuffix: 'Punkte',
    onePointRule: '1 Punkt = 1 QAR Rabatt',
    using: 'Nutzen',
    save: 'Sparen',
    usePointsInfo: (value) => `Fur diese Buchung werden bis zu ${value} QAR Ihrer Punkte verwendet.`,
    savePointsInfo: 'Sparen Sie Ihre Punkte fur eine spatere Buchung mit hoherem Rabatt.',
    payment: 'Zahlung',
    freeBookingTitle: 'Kostenlose Buchung - keine Zahlung erforderlich',
    freeBookingDesc: 'Ihr Pramiengutschein deckt den Gesamtbetrag. Bestatigen Sie unten, um die Buchung abzuschlieBen.',
    preauthInfo: 'Ihre Karte wird vorautorisiert. Die Belastung erfolgt erst nach Abschluss des Services.',
    payComingSoon: (method) => `${method} folgt bald. Bitte verwenden Sie Kredit-/Debitkarte fur die Buchung.`,
    paymentPlaceholderTitle: 'Zahlungs-Platzhalter aktiv',
    paymentPlaceholderDesc: 'Tap Checkout ist vorubergehend deaktiviert. Buchungen werden ohne Zahlungsabbuchung erstellt - nur fur Tests.',
    loyaltyHelp: 'Treuepramien erscheinen hier nach abgeschlossenen Buchungen. Rabatte werden serverseitig gepruft.',
    referralHelp: 'Nutzen Sie den Code eines Freundes fur exklusive Rabatte. Ihr Freund erhalt ebenfalls Pramien.',
    customerFields: [
      { label: 'Vollstandiger Name', name: 'customerName', type: 'text', Icon: User, placeholder: 'Max Mustermann', colSpan: '' },
      { label: 'E-Mail-Adresse', name: 'customerEmail', type: 'email', Icon: Mail, placeholder: 'you@example.com', colSpan: '' },
      { label: 'Telefonnummer', name: 'customerPhone', type: 'tel', Icon: Phone, placeholder: '+974 3300 0000', colSpan: 'md:col-span-2' },
    ],
    paymentMethods: {
      card: 'Kredit-/Debitkarte',
      googlePay: 'Google Pay',
      applePay: 'Apple Pay',
    },
  },
};

function BookingDetailsCheckoutStep({
  formData, setFormData,
  canAutofillCustomerData, isAdmin: _isAdmin,
  savedAddresses, savedHouseNumbers, addressHelperText,
  myCoupons,
  isTapMode, paymentMethod: _paymentMethod, setPaymentMethod: _setPaymentMethod,
  quote: _quote, totalAmount,
  userReferralPoints = 0,
  hasUsedReferral = false,
  referredByName = null,
}) {
  const { lang } = useLanguage();
  const langKey = String(lang || 'en').toLowerCase().split('-')[0];
  const ui = UI_BY_LANG[langKey] || UI_BY_LANG.en;
  const _paymentMethods = [
    { id: 'card', label: ui.paymentMethods.card, Icon: CreditCard },
    { id: 'google_pay', label: ui.paymentMethods.googlePay, Icon: Shield },
    { id: 'apple_pay', label: ui.paymentMethods.applePay, Icon: Star },
  ];

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, [setFormData]);

  return (
    <>
      {/* ── 04 Customer info ────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '78%', width: '11%', animation: 'prism-ray-sweep 16s ease-in-out 7s infinite' }} />
        <SectionHeading icon={User} step={4}>{ui.yourInformation}</SectionHeading>
        <div className="grid md:grid-cols-2 gap-4">
          {ui.customerFields.map(({ label, name, type, Icon, placeholder, colSpan }) => (
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
        <SectionHeading icon={MapPin} step={5}>{ui.serviceAddress}</SectionHeading>
        {canAutofillCustomerData && (
          <div className="mb-5 rounded-xl border border-[var(--border-color)] p-4" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-3">{ui.savedAddresses}</p>
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
          label={ui.areaStreet}
          value={formData.customerAddress}
          onChange={(v) => setFormData((prev) => ({ ...prev, customerAddress: v }))}
          placeholder={ui.searchAddress}
          required
          helperText={addressHelperText}
        />
        {formData.customerAddress && (
          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">House / Building Number</label>
            <input
              type="text"
              name="houseNumber"
              value={formData.houseNumber || savedHouseNumbers?.[formData.addressType] || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, houseNumber: e.target.value }))}
              placeholder="e.g. Villa 12, Building 5, Flat 3"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            />
          </div>
        )}
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">{ui.specialInstructions}</p>
          <textarea name="specialInstructions" value={formData.specialInstructions} onChange={handleChange}
            rows={3} placeholder={ui.instructionsPlaceholder}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] px-4 py-3 text-sm placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition resize-none" />
        </div>
      </div>

      {/* ── 06 Offers ───────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '76%', width: '10%', animation: 'prism-ray-sweep 19s ease-in-out 2s infinite' }} />
        <SectionHeading icon={Tag} step={6}>{ui.offers}</SectionHeading>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">{ui.couponCode}</p>
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
            {ui.loyaltyHelp}
          </p>
        </div>
      </div>

      {/* ── Referral Info ──────────────────────────────────── */}
      {hasUsedReferral && referredByName && (
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="prism-ray" style={{ left: '80%', width: '10%', animation: 'prism-ray-sweep 18s ease-in-out 4s infinite' }} />
          <SectionHeading icon={Gift} step={6}>Referral Benefit</SectionHeading>
          <div className="rounded-xl border p-4" style={{ background: 'rgba(34,197,94,.08)', borderColor: 'rgba(34,197,94,.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
              You received a discount from {referredByName}'s referral!
            </p>
            <p className="text-xs text-[var(--muted-color)] mt-1">
              Your booking includes the referral discount. Thank you for using Glanz!
            </p>
          </div>
        </div>
      )}

      {/* ── My Referral Points ──────────────────────────────────── */}
      {userReferralPoints > 0 && (
        <div className="glass-card p-6 relative">
          <SectionHeading icon={Coins} step={7}>{ui.rewardPoints}</SectionHeading>
          <div className="flex items-center justify-between p-4 rounded-xl border"
            style={{ background: 'rgba(245,158,11,.08)', borderColor: 'rgba(245,158,11,.28)' }}>
            <div className="flex items-center gap-3">
              <Coins size={20} className="text-yellow-500" />
              <div>
                <p className="text-sm font-bold text-[var(--heading-color)]">
                  {ui.pointsPrefix} <span className="text-primary">{userReferralPoints}</span> {ui.pointsSuffix}
                </p>
                <p className="text-xs text-[var(--muted-color)]">
                  {ui.onePointRule}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-[var(--muted-color)]">
                {formData.useReferralPoints ? ui.using : ui.save}
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
              ? ui.usePointsInfo(Math.min(userReferralPoints, totalAmount))
              : ui.savePointsInfo}
          </p>
        </div>
      )}

      {/* ── 08 Payment ──────────────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="prism-ray" style={{ left: '28%', width: '13%', animation: 'prism-ray-sweep 15s ease-in-out 9s infinite' }} />
        <SectionHeading icon={CreditCard} step={7}>{ui.payment}</SectionHeading>
        {isTapMode && totalAmount === 0 ? (
          <div className="rounded-xl border border-dashed p-5 flex items-start gap-3"
            style={{ borderColor: 'rgba(200,169,107,0.35)', background: 'rgba(200,169,107,0.04)' }}>
            <Gift size={18} className="text-yellow-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--heading-color)]">{ui.freeBookingTitle}</p>
              <p className="text-xs text-[var(--muted-color)] mt-1">
                {ui.freeBookingDesc}
              </p>
            </div>
          </div>
        ) : isTapMode ? (
          <div className="rounded-xl border border-[var(--border-color)] p-5 flex items-start gap-3"
            style={{ background: 'rgba(200,169,107,0.04)', borderColor: 'rgba(200,169,107,0.35)' }}>
            <CreditCard size={18} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--heading-color)]">Secure Payment via Tap</p>
              <p className="text-xs text-[var(--muted-color)] mt-1">
                After confirming your booking you will be redirected to the Tap Payments page to complete payment securely. All major cards accepted.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Shield size={11} className="text-[var(--muted-color)] flex-shrink-0" />
                <p className="text-xs text-[var(--muted-color)]">{ui.preauthInfo}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-color)] p-5"
            style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/12 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={15} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--heading-color)]">{ui.paymentPlaceholderTitle}</p>
                <p className="text-sm text-[var(--muted-color)] mt-1">
                  {ui.paymentPlaceholderDesc}
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
