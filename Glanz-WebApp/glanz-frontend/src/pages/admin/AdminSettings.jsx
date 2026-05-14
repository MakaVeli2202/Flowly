// AdminSettings.jsx
import React, { useState, useEffect, useRef } from 'react';
import { settingsAPI } from '../../api/settings';
import { formatQAR } from '../../utils/currency';
import { Settings, Shield, CheckCircle, AlertCircle, Save, Building2, Clock, MessageSquare, DollarSign, Gift, FlaskConical, Trash2, Database } from 'lucide-react';
import { getBusiness, saveBusiness } from '../../config/business';
import { useLanguage } from '../../context/LanguageContext';

/* PRISM_CSS — identical to ManageServices */
const PRISM_CSS = `
@keyframes holo-sweep{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes prism-ray-sweep{0%{transform:translateX(-130%) skewX(-15deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(460%) skewX(-15deg);opacity:0}}
@keyframes spectrum-float{0%,100%{transform:translate(0,0) rotate(0deg);opacity:.18}33%{transform:translate(12px,-14px) rotate(120deg);opacity:.30}66%{transform:translate(-7px,8px) rotate(240deg);opacity:.22}}
@keyframes cta-rainbow-glow{0%,100%{box-shadow:0 0 0 1.5px rgba(255,80,80,.42),0 0 22px rgba(255,165,0,.15)}33%{box-shadow:0 0 0 1.5px rgba(0,200,255,.42),0 0 22px rgba(160,0,255,.15)}66%{box-shadow:0 0 0 1.5px rgba(0,255,120,.42),0 0 22px rgba(255,0,100,.15)}}
@keyframes card-enter{from{transform:translateY(14px) scale(.988);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.prism-cursor-blob{position:fixed;pointer-events:none;z-index:0;border-radius:50%;filter:blur(90px);mix-blend-mode:screen;will-change:transform,background}
.prism-ray{position:absolute;top:-30%;height:160%;pointer-events:none;transform:skewX(-18deg);background:linear-gradient(90deg,transparent 0%,rgba(255,55,55,.030) 15%,rgba(255,200,0,.042) 30%,rgba(0,255,145,.034) 50%,rgba(0,145,255,.034) 70%,rgba(195,0,255,.026) 85%,transparent 100%)}
.spectrum-line{height:1.5px;background:linear-gradient(90deg,transparent 0%,rgba(255,0,100,.80) 12%,rgba(255,165,0,.85) 24%,rgba(255,255,0,.85) 36%,rgba(0,255,100,.85) 48%,rgba(0,150,255,.85) 60%,rgba(150,0,255,.80) 72%,transparent 85%);background-size:200% 100%;animation:holo-sweep 5s linear infinite;opacity:.40}
.cta-prism-glow{animation:cta-rainbow-glow 5s ease-in-out infinite}
.card-stagger{animation:card-enter .52s cubic-bezier(.22,1,.36,1) both}
.field-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border-color);background:var(--surface-bg);color:var(--text-color);font-size:.875rem;transition:border-color .2s,box-shadow .2s;outline:none}
.field-input:focus{border-color:rgba(200,169,107,.65);box-shadow:0 0 0 3px rgba(200,169,107,.12)}
.field-label{display:block;font-size:.68rem;font-weight:700;letter-spacing:.20em;text-transform:uppercase;color:var(--muted-color);margin-bottom:7px}
`;

function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth/2, my = window.innerHeight/2, cx = mx, cy = my, rafId;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx-cx)*.07; cy += (my-cy)*.07;
      const hue = (mx/window.innerWidth)*360;
      el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive:true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} style={{ position:'fixed', pointerEvents:'none', zIndex:0, borderRadius:'50%', filter:'blur(90px)', mixBlendMode:'screen', willChange:'transform,background', width:480, height:480, top:'-240px', left:'-240px' }} />;
}

/* Toggle — button-based, no checkbox, matches original's onClick pattern */
function Toggle({ checked, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-[var(--border-color)]'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function AdminSettings() {
  const { t, lang } = useLanguage();
  const ui = {
    en: {
      loadingSettings: 'Loading settings...',
      failedToLoadSettings: 'Failed to load settings.',
      failedToSaveSettings: 'Failed to save settings.',
      workerTravelRangeError: 'Worker travel buffer must be between 0 and 480 minutes.',
      failedToSaveWorkerBuffer: 'Failed to save worker travel buffer setting.',
      failedToSaveSms: 'Failed to save SMS setting.',
      discountRangeError: 'Discount must be between 0 and 50 percent.',
      failedToSaveDiscount: 'Failed to save discount.',
      referralRewardRangeError: 'Referral reward must be between 0 and 500 QAR.',
      failedToSaveReferralReward: 'Failed to save referral reward.',
      referralDiscountRangeError: 'Referral discount must be between 0 and 100 percent.',
      failedToSaveReferralDiscount: 'Failed to save referral discount.',
      multiplierRangeError: 'Each multiplier must be between 0 and 5.',
      failedToSaveMultipliers: 'Failed to save vehicle multipliers.',
      failedToSaveBusinessHours: 'Failed to save business hours.',
      closedDays: 'Special Closed Days',
      closedDaysDesc: 'Mark specific calendar dates as fully closed. Customers will see no available slots on these days. Contact customers with existing bookings to reschedule manually.',
      addClosedDate: 'Mark Closed',
      closedDatesNone: 'No closed days scheduled.',
      failedToSaveClosedDates: 'Failed to save closed dates.',
      featureFlags: 'Feature Flags',
      featureFlagsDesc: 'Enable or disable platform features. Changes take effect immediately for all users.',
      featureFlagFavoriteDetailer: 'Favourite Detailer',
      featureFlagFavoriteDetailerDesc: 'Allows VIP customers to select a preferred detailer during booking. Enable per-customer via CRM.',
      adminSettings: 'Admin Settings',
      settingsSubtitle: 'Control system-wide policies and fees.',
      cancellationPolicy: 'Cancellation Policy',
      businessConfiguration: 'Business Configuration',
      bookingTimeBuffers: 'Booking Time Buffers',
      businessHours: 'Business Hours',
      subscriptionDiscount: 'Subscription Discount',
      referralSettings: 'Referral Settings',
      vehiclePriceMultipliers: 'Vehicle Price Multipliers',
      smsFollowUps: 'SMS Follow-Up Notifications',
      saveSettings: 'Save Settings',
      saveBusinessConfig: 'Save Business Config',
      saveWorkerBuffer: 'Save Worker Buffer',
      saveBusinessHours: 'Save Business Hours',
      saveDiscount: 'Save Discount',
      saveReferralSettings: 'Save Referral Settings',
      saveMultipliers: 'Save Multipliers',
      saveSmsSetting: 'Save SMS Setting',
      siteVisibility: 'Site Visibility',
      siteVisibilityDesc: 'Publish the website for everyone, or keep it hidden behind the private countdown page.',
      siteVisible: 'Public site',
      siteHidden: 'Private countdown page',
      siteVisibilityHelp: 'When public, anyone can browse the website. When private, only people with the password can enter.',
      failedToSaveSiteVisibility: 'Failed to save site visibility.',
      launchConfiguration: 'Launch Configuration',
      launchDateDesc: 'Set the countdown timer target date and time. Visitors will see a countdown until this moment.',
      launchDateLabel: 'Launch Date & Time',
      launchDatePlaceholder: 'Select date and time',
      launchDateRequired: 'Launch date is required.',
      failedToSaveLaunchDate: 'Failed to save launch date.',
      saveLaunchDate: 'Save Launch Date',
      saving: 'Saving...',
      saved: 'Saved',
      to: 'to',
      cancellationPolicyDesc: 'Configure whether a fee is charged when customers cancel a booking. Shown to customers before they confirm cancellation.',
      enableCancellationFee: 'Enable Cancellation Fee',
      cancellationFeeWarning: 'Customers will see a warning and calculated fee before confirming cancellation.',
      feeTypeLabel: 'Fee Type',
      feeTypePercent: 'Percentage of booking',
      feeTypeFlat: 'Flat amount (QAR)',
      feePercentageLabel: 'Fee Percentage (%)',
      flatFeeLabel: 'Flat Fee (QAR)',
      freeCancellationWindowLabel: 'Free Cancellation Window (hours)',
      freeCancellationWindowDesc: 'Cancellations made more than this many hours before the appointment incur no fee.',
      policyPreviewLabel: 'Policy Preview',
      policyPreviewText: 'Customers who cancel within {{hours}}h of their appointment will be charged {{fee}}. Cancellations made more than {{hours}}h before are free.',
      businessConfigurationDesc: 'Set the business name, contact info, and operating area. These values are shown throughout the app.',
      logoUrlLabel: 'Logo URL',
      logoUrlPlaceholder: 'https://example.com/logo.png',
      logoHint: 'Used in navbar, footer, payslips, and emails',
      logoPreviewAlt: 'Logo preview',
      businessNameLabel: 'Business Name',
      businessNamePlaceholder: 'e.g. Glanz',
      taglineLabel: 'Tagline',
      taglinePlaceholder: 'Short description',
      phoneLabel: 'Phone',
      phonePlaceholder: '+974 4444 4444',
      supportEmailLabel: 'Support Email',
      supportEmailPlaceholder: 'info@example.qa',
      operatingAreaLabel: 'Operating Area',
      operatingAreaPlaceholder: 'e.g. Doha, Qatar',
      serviceAreasLabel: 'Service Areas (cities / districts)',
      noAreasAdded: 'No areas added',
      areaInputPlaceholder: 'Type area name and press Enter',
      addAreaButton: '+ Add',
      socialMediaLinksLabel: 'Social Media Links',
      failedToSaveBusinessConfig: 'Failed to save business configuration.',
      bookingTimeBuffersDesc: 'Control how much gap workers need between consecutive jobs.',
      workerTravelBufferTitle: 'Worker Travel Buffer',
      workerTravelBufferTag: 'Gap between consecutive jobs',
      workerTravelBufferDesc: 'Minimum gap between end of one booking and start of the next. Accounts for travel and preparation time between jobs.',
      workerTravelRule: 'Worker available at T only if T >= lastBookingEnd + {{minutes}} min.',
      businessHoursDesc: 'Set opening and closing hours for each day of the week. Slots are generated in 30-minute steps within these bounds.',
      subscriptionDiscountDesc: 'Percentage discount applied automatically to monthly subscription bookings before any coupon is applied. Valid range: 0-50%.',
      discountPercentageLabel: 'Discount Percentage',
      discountPercentageDesc: 'A 10% discount means: a QAR 200 monthly plan is billed at QAR 180 before any coupon.',
      discountEndpointNote: 'Applied in CreatePaymentIntent and CreateBookingV2 endpoints. Change takes effect on the next booking creation and needs no restart.',
      referralSettingsDesc: 'Configure referral rewards for the referrer and discount for the referred user.',
      referredUserDiscountLabel: 'Referred User Discount',
      firstBookingOnly: 'First booking only',
      referredUserDiscountDesc: 'Discount applied to the referred user\'s first completed booking.',
      referrerRewardLabel: 'Referrer Reward',
      afterXCompletedBookings: 'After X completed bookings',
      referrerRewardDesc: 'The referrer receives this reward after their referred friend completes this many paid bookings.',
      completedBookingsRequiredLabel: 'Completed Bookings Required',
      rewardAmountLabel: 'Reward amount:',
      failedToSaveReferralSettings: 'Failed to save referral settings.',
      vehiclePriceMultipliersDesc: 'Configure price multipliers for different vehicle types. These affect the base price of all packages.',
      vehicleMultiplierExample: 'Example: A QAR 100 package costs: QAR {{motorcycle}} for Motorcycle, QAR {{sedan}} for Sedan, QAR {{suv}} for SUV, QAR {{pickup}} for Pickup.',
      smsFollowUpsDesc: 'Enable automated SMS messages for booking reminders, abandoned booking recovery, and win-back campaigns. Keep off during development to avoid carrier costs.',
      enableSmsFollowUps: 'Enable SMS Follow-Ups',
      enableSmsFollowUpsDesc: 'When enabled, SMS messages will fire for reminders, win-backs, and abandoned bookings. Requires a Twilio integration to be configured.',
      developmentMode: 'Development mode:',
      smsOffWarning: 'SMS is off. No messages will be sent and no costs will be incurred.',
      smsActiveWarning: 'SMS is active. Messages will be sent to customers. Ensure Twilio credentials are configured in appsettings.',
      social: {
        facebook: 'Facebook',
        twitter: 'Twitter/X',
        instagram: 'Instagram',
        linkedin: 'LinkedIn',
        youtube: 'YouTube',
      },
      days: {
        Sunday: 'Sunday',
        Monday: 'Monday',
        Tuesday: 'Tuesday',
        Wednesday: 'Wednesday',
        Thursday: 'Thursday',
        Friday: 'Friday',
        Saturday: 'Saturday',
      },
      vehicles: {
        motorcycle: 'Motorcycle',
        sedan: 'Sedan',
        suv: 'SUV',
        pickup: 'Pickup',
      },
    },
    ar: {
      loadingSettings: 'جارٍ تحميل الإعدادات...',
      failedToLoadSettings: 'فشل تحميل الإعدادات.',
      failedToSaveSettings: 'فشل حفظ الإعدادات.',
      workerTravelRangeError: 'يجب أن تكون مهلة تنقل العامل بين 0 و480 دقيقة.',
      failedToSaveWorkerBuffer: 'فشل حفظ إعداد مهلة تنقل العامل.',
      failedToSaveSms: 'فشل حفظ إعداد الرسائل النصية.',
      discountRangeError: 'يجب أن تكون نسبة الخصم بين 0 و50 بالمئة.',
      failedToSaveDiscount: 'فشل حفظ الخصم.',
      referralRewardRangeError: 'يجب أن تكون مكافأة الإحالة بين 0 و500 ر.ق.',
      failedToSaveReferralReward: 'فشل حفظ مكافأة الإحالة.',
      referralDiscountRangeError: 'يجب أن يكون خصم الإحالة بين 0 و100 بالمئة.',
      failedToSaveReferralDiscount: 'فشل حفظ خصم الإحالة.',
      multiplierRangeError: 'يجب أن يكون كل معامل بين 0 و5.',
      failedToSaveMultipliers: 'فشل حفظ معاملات المركبات.',
      failedToSaveBusinessHours: 'فشل حفظ ساعات العمل.',
      closedDays: 'أيام الإغلاق الخاصة',
      closedDaysDesc: 'حدد تواريخ معينة كأيام إغلاق تام. لن يرى العملاء أي مواعيد متاحة في هذه الأيام. تواصل مع العملاء الذين لديهم حجوزات لإعادة الجدولة يدويا.',
      addClosedDate: 'تحديد كيوم مغلق',
      closedDatesNone: 'لا توجد أيام إغلاق مجدولة.',
      failedToSaveClosedDates: 'فشل حفظ أيام الإغلاق.',
      featureFlags: 'ميزات النظام',
      featureFlagsDesc: 'تفعيل أو تعطيل ميزات المنصة. التغييرات تسري فورا على جميع المستخدمين.',
      featureFlagFavoriteDetailer: 'المنظف المفضل',
      featureFlagFavoriteDetailerDesc: 'يسمح للعملاء المميزين باختيار منظف مفضل عند الحجز. يتم التفعيل لكل عميل عبر إدارة علاقات العملاء.',
      adminSettings: 'إعدادات الإدارة',
      settingsSubtitle: 'تحكم في السياسات والرسوم على مستوى النظام.',
      cancellationPolicy: 'سياسة الإلغاء',
      businessConfiguration: 'إعدادات النشاط التجاري',
      bookingTimeBuffers: 'فواصل وقت الحجز',
      businessHours: 'ساعات العمل',
      subscriptionDiscount: 'خصم الاشتراك',
      referralSettings: 'إعدادات الإحالة',
      vehiclePriceMultipliers: 'معاملات أسعار المركبات',
      smsFollowUps: 'إشعارات المتابعة عبر الرسائل النصية',
      saveSettings: 'حفظ الإعدادات',
      saveBusinessConfig: 'حفظ إعدادات النشاط',
      saveWorkerBuffer: 'حفظ مهلة العامل',
      saveBusinessHours: 'حفظ ساعات العمل',
      saveDiscount: 'حفظ الخصم',
      saveReferralSettings: 'حفظ إعدادات الإحالة',
      saveMultipliers: 'حفظ المعاملات',
      saveSmsSetting: 'حفظ إعداد SMS',
      siteVisibility: 'إظهار الموقع',
      siteVisibilityDesc: 'انشر الموقع للجميع أو اتركه مخفيا خلف صفحة العد التنازلي الخاصة.',
      siteVisible: 'موقع عام',
      siteHidden: 'صفحة خاصة بعداد تنازلي',
      siteVisibilityHelp: 'عند النشر يمكن لأي شخص تصفح الموقع. وعند الإخفاء لن يدخل إلا من يملك كلمة المرور.',
      failedToSaveSiteVisibility: 'فشل حفظ حالة ظهور الموقع.',
      launchConfiguration: 'إعدادات الإطلاق',
      launchDateDesc: 'حدد تاريخ وقت العد التنازلي. سيرى الزائرون عداد تنازلي حتى هذه اللحظة.',
      launchDateLabel: 'تاريخ ووقت الإطلاق',
      launchDatePlaceholder: 'اختر التاريخ والوقت',
      launchDateRequired: 'تاريخ الإطلاق مطلوب.',
      failedToSaveLaunchDate: 'فشل حفظ تاريخ الإطلاق.',
      saveLaunchDate: 'حفظ تاريخ الإطلاق',
      saving: 'جارٍ الحفظ...',
      saved: 'تم الحفظ',
      to: 'إلى',
      cancellationPolicyDesc: 'حدد ما إذا كانت هناك رسوم عند إلغاء العميل للحجز. تظهر للعملاء قبل تأكيد الإلغاء.',
      enableCancellationFee: 'تفعيل رسوم الإلغاء',
      cancellationFeeWarning: 'سيظهر للعملاء تنبيه ورسوم محسوبة قبل تأكيد الإلغاء.',
      feeTypeLabel: 'نوع الرسوم',
      feeTypePercent: 'نسبة من قيمة الحجز',
      feeTypeFlat: 'مبلغ ثابت (ر.ق)',
      feePercentageLabel: 'نسبة الرسوم (%)',
      flatFeeLabel: 'رسوم ثابتة (ر.ق)',
      freeCancellationWindowLabel: 'مهلة الإلغاء المجاني (ساعات)',
      freeCancellationWindowDesc: 'الإلغاء قبل هذا العدد من الساعات لا يترتب عليه رسوم.',
      policyPreviewLabel: 'معاينة السياسة',
      policyPreviewText: 'العملاء الذين يلغون خلال {{hours}} ساعة من الموعد سيتم تحصيل {{fee}} منهم. أما قبل {{hours}} ساعة فالإلغاء مجاني.',
      businessConfigurationDesc: 'حدد اسم النشاط ومعلومات التواصل ونطاق التشغيل. تظهر هذه القيم في أنحاء التطبيق.',
      logoUrlLabel: 'رابط الشعار',
      logoUrlPlaceholder: 'https://example.com/logo.png',
      logoHint: 'يستخدم في شريط التنقل والتذييل وكشوف الرواتب والبريد',
      logoPreviewAlt: 'معاينة الشعار',
      businessNameLabel: 'اسم النشاط',
      businessNamePlaceholder: 'مثال: Glanz',
      taglineLabel: 'العبارة التعريفية',
      taglinePlaceholder: 'وصف قصير',
      phoneLabel: 'الهاتف',
      phonePlaceholder: '+974 4444 4444',
      supportEmailLabel: 'بريد الدعم',
      supportEmailPlaceholder: 'info@example.qa',
      operatingAreaLabel: 'منطقة التشغيل',
      operatingAreaPlaceholder: 'مثال: الدوحة، قطر',
      serviceAreasLabel: 'مناطق الخدمة (مدن / أحياء)',
      noAreasAdded: 'لم تتم إضافة مناطق',
      areaInputPlaceholder: 'اكتب اسم المنطقة ثم اضغط Enter',
      addAreaButton: '+ إضافة',
      socialMediaLinksLabel: 'روابط التواصل الاجتماعي',
      failedToSaveBusinessConfig: 'فشل حفظ إعدادات النشاط.',
      bookingTimeBuffersDesc: 'تحكم في مدة الفاصل المطلوبة بين الحجوزات المتتالية للعامل.',
      workerTravelBufferTitle: 'مهلة تنقل العامل',
      workerTravelBufferTag: 'فاصل بين الحجوزات المتتالية',
      workerTravelBufferDesc: 'أقل فاصل بين نهاية حجز وبداية الحجز التالي، ويشمل وقت التنقل والتجهيز.',
      workerTravelRule: 'يكون العامل متاحا عند T فقط إذا كان T >= نهاية الحجز الأخير + {{minutes}} دقيقة.',
      businessHoursDesc: 'حدد وقت الفتح والإغلاق لكل يوم. يتم توليد المواعيد كل 30 دقيقة داخل هذه الحدود.',
      subscriptionDiscountDesc: 'خصم يطبق تلقائيا على حجوزات الاشتراك الشهرية قبل أي كوبون. المجال: 0-50%.',
      discountPercentageLabel: 'نسبة الخصم',
      discountPercentageDesc: 'خصم 10% يعني أن باقة 200 ر.ق تصبح 180 ر.ق قبل أي كوبون.',
      discountEndpointNote: 'يطبق في نقاط CreatePaymentIntent و CreateBookingV2. يسري التغيير في أول حجز جديد بدون إعادة تشغيل.',
      referralSettingsDesc: 'حدد مكافأة المُحيل وخصم المستخدم المُحال.',
      referredUserDiscountLabel: 'خصم المستخدم المُحال',
      firstBookingOnly: 'لأول حجز فقط',
      referredUserDiscountDesc: 'يطبق الخصم على أول حجز مكتمل للمستخدم المُحال.',
      referrerRewardLabel: 'مكافأة المُحيل',
      afterXCompletedBookings: 'بعد عدد X من الحجوزات المكتملة',
      referrerRewardDesc: 'يحصل المُحيل على هذه المكافأة بعد إكمال الصديق المُحال لهذا العدد من الحجوزات المدفوعة.',
      completedBookingsRequiredLabel: 'عدد الحجوزات المكتملة المطلوبة',
      rewardAmountLabel: 'قيمة المكافأة:',
      failedToSaveReferralSettings: 'فشل حفظ إعدادات الإحالة.',
      vehiclePriceMultipliersDesc: 'حدد معاملات الأسعار لأنواع المركبات المختلفة. تؤثر على السعر الأساسي لكل الباقات.',
      vehicleMultiplierExample: 'مثال: باقة بسعر 100 ر.ق تصبح: {{motorcycle}} للدراجة، {{sedan}} للسيدان، {{suv}} للـSUV، {{pickup}} للبيك أب.',
      smsFollowUpsDesc: 'تفعيل الرسائل التلقائية للتذكير واسترجاع الحجوزات المتروكة وحملات الاسترجاع. اتركها مغلقة أثناء التطوير لتجنب التكلفة.',
      enableSmsFollowUps: 'تفعيل متابعات SMS',
      enableSmsFollowUpsDesc: 'عند التفعيل سترسل رسائل للتذكير والاسترجاع واستكمال الحجوزات المتروكة. يتطلب إعداد Twilio.',
      developmentMode: 'وضع التطوير:',
      smsOffWarning: 'الرسائل النصية متوقفة. لن يتم إرسال رسائل ولن توجد تكلفة.',
      smsActiveWarning: 'الرسائل النصية مفعلة. سيتم الإرسال للعملاء. تأكد من إعداد بيانات Twilio في appsettings.',
      social: {
        facebook: 'فيسبوك',
        twitter: 'إكس / تويتر',
        instagram: 'إنستغرام',
        linkedin: 'لينكدإن',
        youtube: 'يوتيوب',
      },
      days: {
        Sunday: 'الأحد',
        Monday: 'الاثنين',
        Tuesday: 'الثلاثاء',
        Wednesday: 'الأربعاء',
        Thursday: 'الخميس',
        Friday: 'الجمعة',
        Saturday: 'السبت',
      },
      vehicles: {
        motorcycle: 'دراجة',
        sedan: 'سيدان',
        suv: 'دفع رباعي',
        pickup: 'بيك أب',
      },
    },
    de: {
      loadingSettings: 'Einstellungen werden geladen...',
      failedToLoadSettings: 'Einstellungen konnten nicht geladen werden.',
      failedToSaveSettings: 'Einstellungen konnten nicht gespeichert werden.',
      workerTravelRangeError: 'Der Mitarbeiter-Puffer muss zwischen 0 und 480 Minuten liegen.',
      failedToSaveWorkerBuffer: 'Der Mitarbeiter-Puffer konnte nicht gespeichert werden.',
      failedToSaveSms: 'SMS-Einstellung konnte nicht gespeichert werden.',
      discountRangeError: 'Der Rabatt muss zwischen 0 und 50 Prozent liegen.',
      failedToSaveDiscount: 'Rabatt konnte nicht gespeichert werden.',
      referralRewardRangeError: 'Die Empfehlungspramie muss zwischen 0 und 500 QAR liegen.',
      failedToSaveReferralReward: 'Empfehlungspramie konnte nicht gespeichert werden.',
      referralDiscountRangeError: 'Der Empfehlungsrabatt muss zwischen 0 und 100 Prozent liegen.',
      failedToSaveReferralDiscount: 'Empfehlungsrabatt konnte nicht gespeichert werden.',
      multiplierRangeError: 'Jeder Multiplikator muss zwischen 0 und 5 liegen.',
      failedToSaveMultipliers: 'Fahrzeug-Multiplikatoren konnten nicht gespeichert werden.',
      failedToSaveBusinessHours: 'Geschaftszeiten konnten nicht gespeichert werden.',
      closedDays: 'Besondere Schliessungstage',
      closedDaysDesc: 'Markieren Sie bestimmte Kalendertage als vollstandig geschlossen. Kunden sehen an diesen Tagen keine verfugbaren Slots. Kontaktieren Sie Kunden mit bestehenden Buchungen zur manuellen Umplanung.',
      addClosedDate: 'Als geschlossen markieren',
      closedDatesNone: 'Keine Schliessungstage geplant.',
      failedToSaveClosedDates: 'Schliessungstage konnten nicht gespeichert werden.',
      featureFlags: 'Feature-Flags',
      featureFlagsDesc: 'Aktivieren oder deaktivieren Sie Plattformfunktionen. Anderungen wirken sofort fur alle Nutzer.',
      featureFlagFavoriteDetailer: 'Lieblingsreiniger',
      featureFlagFavoriteDetailerDesc: 'Ermoglicht VIP-Kunden, einen bevorzugten Reiniger bei der Buchung auszuwahlen. Pro Kunde uber CRM aktivierbar.',
      adminSettings: 'Admin-Einstellungen',
      settingsSubtitle: 'Steuern Sie systemweite Richtlinien und Gebuhren.',
      cancellationPolicy: 'Stornierungsrichtlinie',
      businessConfiguration: 'Unternehmenskonfiguration',
      bookingTimeBuffers: 'Buchungszeit-Puffer',
      businessHours: 'Geschaftszeiten',
      subscriptionDiscount: 'Abonnement-Rabatt',
      referralSettings: 'Empfehlungseinstellungen',
      vehiclePriceMultipliers: 'Fahrzeugpreis-Multiplikatoren',
      smsFollowUps: 'SMS-Follow-up-Benachrichtigungen',
      saveSettings: 'Einstellungen speichern',
      saveBusinessConfig: 'Unternehmensdaten speichern',
      saveWorkerBuffer: 'Mitarbeiter-Puffer speichern',
      saveBusinessHours: 'Geschaftszeiten speichern',
      saveDiscount: 'Rabatt speichern',
      saveReferralSettings: 'Empfehlungseinstellungen speichern',
      saveMultipliers: 'Multiplikatoren speichern',
      saveSmsSetting: 'SMS-Einstellung speichern',
      siteVisibility: 'Sichtbarkeit der Website',
      siteVisibilityDesc: 'Veröffentlichen Sie die Website für alle oder halten Sie sie hinter der privaten Countdown-Seite verborgen.',
      siteVisible: 'Öffentliche Website',
      siteHidden: 'Private Countdown-Seite',
      siteVisibilityHelp: 'Im öffentlichen Modus kann jeder die Website sehen. Im privaten Modus brauchen Besucher das Passwort.',
      failedToSaveSiteVisibility: 'Sichtbarkeit der Website konnte nicht gespeichert werden.',
      launchConfiguration: 'Startkonfiguration',
      launchDateDesc: 'Legen Sie das Zieldatum und die Uhrzeit fur den Countdown fest. Besucher sehen einen Countdown bis zu diesem Moment.',
      launchDateLabel: 'Startdatum & -uhrzeit',
      launchDatePlaceholder: 'Datum und Uhrzeit auswahlen',
      launchDateRequired: 'Startdatum ist erforderlich.',
      failedToSaveLaunchDate: 'Startdatum konnte nicht gespeichert werden.',
      saveLaunchDate: 'Startdatum speichern',
      saving: 'Speichern...',
      saved: 'Gespeichert',
      to: 'bis',
      cancellationPolicyDesc: 'Legen Sie fest, ob bei Stornierungen eine Gebuhr erhoben wird. Dies wird Kunden vor der Bestatigung angezeigt.',
      enableCancellationFee: 'Stornierungsgebuhr aktivieren',
      cancellationFeeWarning: 'Kunden sehen vor der Bestatigung einen Hinweis und die berechnete Gebuhr.',
      feeTypeLabel: 'Gebuhrenart',
      feeTypePercent: 'Prozentsatz vom Buchungswert',
      feeTypeFlat: 'Pauschalbetrag (QAR)',
      feePercentageLabel: 'Gebuhrenprozentsatz (%)',
      flatFeeLabel: 'Pauschalgebuhr (QAR)',
      freeCancellationWindowLabel: 'Kostenfreies Stornierungsfenster (Stunden)',
      freeCancellationWindowDesc: 'Stornierungen fruher als diese Stundenzahl vor dem Termin sind kostenfrei.',
      policyPreviewLabel: 'Richtlinienvorschau',
      policyPreviewText: 'Kunden, die innerhalb von {{hours}}h vor dem Termin stornieren, zahlen {{fee}}. Fruher als {{hours}}h ist kostenfrei.',
      businessConfigurationDesc: 'Setzen Sie Firmenname, Kontakt und Einsatzgebiet. Diese Werte erscheinen in der gesamten App.',
      logoUrlLabel: 'Logo-URL',
      logoUrlPlaceholder: 'https://example.com/logo.png',
      logoHint: 'Wird in Navbar, Footer, Gehaltsnachweisen und E-Mails verwendet',
      logoPreviewAlt: 'Logo-Vorschau',
      businessNameLabel: 'Firmenname',
      businessNamePlaceholder: 'z. B. Glanz',
      taglineLabel: 'Slogan',
      taglinePlaceholder: 'Kurze Beschreibung',
      phoneLabel: 'Telefon',
      phonePlaceholder: '+974 4444 4444',
      supportEmailLabel: 'Support-E-Mail',
      supportEmailPlaceholder: 'info@example.qa',
      operatingAreaLabel: 'Einsatzgebiet',
      operatingAreaPlaceholder: 'z. B. Doha, Katar',
      serviceAreasLabel: 'Servicegebiete (Stadte / Bezirke)',
      noAreasAdded: 'Keine Gebiete hinzugefugt',
      areaInputPlaceholder: 'Gebiet eingeben und Enter drucken',
      addAreaButton: '+ Hinzufugen',
      socialMediaLinksLabel: 'Social-Media-Links',
      failedToSaveBusinessConfig: 'Unternehmenskonfiguration konnte nicht gespeichert werden.',
      bookingTimeBuffersDesc: 'Steuern Sie, wie viel Abstand Mitarbeiter zwischen aufeinanderfolgenden Jobs brauchen.',
      workerTravelBufferTitle: 'Mitarbeiter-Fahrtpuffer',
      workerTravelBufferTag: 'Abstand zwischen aufeinanderfolgenden Jobs',
      workerTravelBufferDesc: 'Minimaler Abstand zwischen dem Ende einer Buchung und dem Start der nachsten. Beinhaltet Fahrt- und Vorbereitungszeit.',
      workerTravelRule: 'Mitarbeiter ist bei T nur verfugbar, wenn T >= letztes Buchungsende + {{minutes}} Min.',
      businessHoursDesc: 'Legen Sie Offnungs- und Schlusszeiten fur jeden Wochentag fest. Slots werden alle 30 Minuten erzeugt.',
      subscriptionDiscountDesc: 'Rabatt fur monatliche Abo-Buchungen vor Gutscheinen. Gultiger Bereich: 0-50%.',
      discountPercentageLabel: 'Rabattprozentsatz',
      discountPercentageDesc: '10% Rabatt bedeutet: Ein QAR-200-Abo wird vor Gutschein mit QAR 180 berechnet.',
      discountEndpointNote: 'Wird in CreatePaymentIntent- und CreateBookingV2-Endpunkten angewendet. Wirkt bei der nachsten Buchung, ohne Neustart.',
      referralSettingsDesc: 'Konfigurieren Sie Pramie fur Werbende und Rabatt fur Geworbene.',
      referredUserDiscountLabel: 'Rabatt fur Geworbene',
      firstBookingOnly: 'Nur fur die erste Buchung',
      referredUserDiscountDesc: 'Rabatt wird auf die erste abgeschlossene Buchung der geworbenen Person angewendet.',
      referrerRewardLabel: 'Pramie fur Werbende',
      afterXCompletedBookings: 'Nach X abgeschlossenen Buchungen',
      referrerRewardDesc: 'Die werbende Person erhalt diese Pramie, nachdem die geworbene Person so viele bezahlte Buchungen abgeschlossen hat.',
      completedBookingsRequiredLabel: 'Erforderliche abgeschlossene Buchungen',
      rewardAmountLabel: 'Pramienbetrag:',
      failedToSaveReferralSettings: 'Empfehlungseinstellungen konnten nicht gespeichert werden.',
      vehiclePriceMultipliersDesc: 'Konfigurieren Sie Preis-Multiplikatoren fur Fahrzeugtypen. Diese beeinflussen den Basispreis aller Pakete.',
      vehicleMultiplierExample: 'Beispiel: Ein QAR-100-Paket kostet: QAR {{motorcycle}} fur Motorrad, QAR {{sedan}} fur Sedan, QAR {{suv}} fur SUV, QAR {{pickup}} fur Pickup.',
      smsFollowUpsDesc: 'Aktiviert automatische SMS fur Erinnerungen, Buchungs-Recovery und Win-Back-Kampagnen. In der Entwicklung auslassen, um Kosten zu vermeiden.',
      enableSmsFollowUps: 'SMS-Follow-ups aktivieren',
      enableSmsFollowUpsDesc: 'Bei Aktivierung werden SMS fur Erinnerungen, Win-Backs und abgebrochene Buchungen gesendet. Twilio-Integration erforderlich.',
      developmentMode: 'Entwicklungsmodus:',
      smsOffWarning: 'SMS ist aus. Es werden keine Nachrichten versendet und keine Kosten verursacht.',
      smsActiveWarning: 'SMS ist aktiv. Nachrichten werden an Kunden gesendet. Stellen Sie sicher, dass Twilio in appsettings konfiguriert ist.',
      social: {
        facebook: 'Facebook',
        twitter: 'Twitter/X',
        instagram: 'Instagram',
        linkedin: 'LinkedIn',
        youtube: 'YouTube',
      },
      days: {
        Sunday: 'Sonntag',
        Monday: 'Montag',
        Tuesday: 'Dienstag',
        Wednesday: 'Mittwoch',
        Thursday: 'Donnerstag',
        Friday: 'Freitag',
        Saturday: 'Samstag',
      },
      vehicles: {
        motorcycle: 'Motorrad',
        sedan: 'Sedan',
        suv: 'SUV',
        pickup: 'Pickup',
      },
    },
  }[lang] || {
    loadingSettings: 'Loading settings...',
    failedToLoadSettings: 'Failed to load settings.',
    failedToSaveSettings: 'Failed to save settings.',
    workerTravelRangeError: 'Worker travel buffer must be between 0 and 480 minutes.',
    failedToSaveWorkerBuffer: 'Failed to save worker travel buffer setting.',
    failedToSaveSms: 'Failed to save SMS setting.',
    discountRangeError: 'Discount must be between 0 and 50 percent.',
    failedToSaveDiscount: 'Failed to save discount.',
    referralRewardRangeError: 'Referral reward must be between 0 and 500 QAR.',
    failedToSaveReferralReward: 'Failed to save referral reward.',
    referralDiscountRangeError: 'Referral discount must be between 0 and 100 percent.',
    failedToSaveReferralDiscount: 'Failed to save referral discount.',
    multiplierRangeError: 'Each multiplier must be between 0 and 5.',
    failedToSaveMultipliers: 'Failed to save vehicle multipliers.',
    failedToSaveBusinessHours: 'Failed to save business hours.',
    closedDays: 'Special Closed Days',
    closedDaysDesc: 'Mark specific calendar dates as fully closed. Customers will see no available slots on these days. Contact customers with existing bookings to reschedule manually.',
    addClosedDate: 'Mark Closed',
    closedDatesNone: 'No closed days scheduled.',
    failedToSaveClosedDates: 'Failed to save closed dates.',
    featureFlags: 'Feature Flags',
    featureFlagsDesc: 'Enable or disable platform features. Changes take effect immediately for all users.',
    featureFlagFavoriteDetailer: 'Favourite Detailer',
    featureFlagFavoriteDetailerDesc: 'Allows VIP customers to select a preferred detailer during booking. Enable per-customer via CRM.',
    adminSettings: 'Admin Settings',
    settingsSubtitle: 'Control system-wide policies and fees.',
    cancellationPolicy: 'Cancellation Policy',
    businessConfiguration: 'Business Configuration',
    bookingTimeBuffers: 'Booking Time Buffers',
    businessHours: 'Business Hours',
    subscriptionDiscount: 'Subscription Discount',
    referralSettings: 'Referral Settings',
    vehiclePriceMultipliers: 'Vehicle Price Multipliers',
    smsFollowUps: 'SMS Follow-Up Notifications',
    saveSettings: 'Save Settings',
    saveBusinessConfig: 'Save Business Config',
    saveWorkerBuffer: 'Save Worker Buffer',
    saveBusinessHours: 'Save Business Hours',
    saveDiscount: 'Save Discount',
    saveReferralSettings: 'Save Referral Settings',
    saveMultipliers: 'Save Multipliers',
    saveSmsSetting: 'Save SMS Setting',
    saving: 'Saving...',
    saved: 'Saved',
    to: 'to',
    cancellationPolicyDesc: 'Configure whether a fee is charged when customers cancel a booking. Shown to customers before they confirm cancellation.',
    enableCancellationFee: 'Enable Cancellation Fee',
    cancellationFeeWarning: 'Customers will see a warning and calculated fee before confirming cancellation.',
    feeTypeLabel: 'Fee Type',
    feeTypePercent: 'Percentage of booking',
    feeTypeFlat: 'Flat amount (QAR)',
    feePercentageLabel: 'Fee Percentage (%)',
    flatFeeLabel: 'Flat Fee (QAR)',
    freeCancellationWindowLabel: 'Free Cancellation Window (hours)',
    freeCancellationWindowDesc: 'Cancellations made more than this many hours before the appointment incur no fee.',
    policyPreviewLabel: 'Policy Preview',
    policyPreviewText: 'Customers who cancel within {{hours}}h of their appointment will be charged {{fee}}. Cancellations made more than {{hours}}h before are free.',
    businessConfigurationDesc: 'Set the business name, contact info, and operating area. These values are shown throughout the app.',
    logoUrlLabel: 'Logo URL',
    logoUrlPlaceholder: 'https://example.com/logo.png',
    logoHint: 'Used in navbar, footer, payslips, and emails',
    logoPreviewAlt: 'Logo preview',
    businessNameLabel: 'Business Name',
    businessNamePlaceholder: 'e.g. Glanz',
    taglineLabel: 'Tagline',
    taglinePlaceholder: 'Short description',
    phoneLabel: 'Phone',
    phonePlaceholder: '+974 4444 4444',
    supportEmailLabel: 'Support Email',
    supportEmailPlaceholder: 'info@example.qa',
    operatingAreaLabel: 'Operating Area',
    operatingAreaPlaceholder: 'e.g. Doha, Qatar',
    serviceAreasLabel: 'Service Areas (cities / districts)',
    noAreasAdded: 'No areas added',
    areaInputPlaceholder: 'Type area name and press Enter',
    addAreaButton: '+ Add',
    socialMediaLinksLabel: 'Social Media Links',
    failedToSaveBusinessConfig: 'Failed to save business configuration.',
    bookingTimeBuffersDesc: 'Control how much gap workers need between consecutive jobs.',
    workerTravelBufferTitle: 'Worker Travel Buffer',
    workerTravelBufferTag: 'Gap between consecutive jobs',
    workerTravelBufferDesc: 'Minimum gap between end of one booking and start of the next. Accounts for travel and preparation time between jobs.',
    workerTravelRule: 'Worker available at T only if T >= lastBookingEnd + {{minutes}} min.',
    businessHoursDesc: 'Set opening and closing hours for each day of the week. Slots are generated in 30-minute steps within these bounds.',
    subscriptionDiscountDesc: 'Percentage discount applied automatically to monthly subscription bookings before any coupon is applied. Valid range: 0-50%.',
    discountPercentageLabel: 'Discount Percentage',
    discountPercentageDesc: 'A 10% discount means: a QAR 200 monthly plan is billed at QAR 180 before any coupon.',
    discountEndpointNote: 'Applied in CreatePaymentIntent and CreateBookingV2 endpoints. Change takes effect on the next booking creation and needs no restart.',
    referralSettingsDesc: 'Configure referral rewards for the referrer and discount for the referred user.',
    referredUserDiscountLabel: 'Referred User Discount',
    firstBookingOnly: 'First booking only',
    referredUserDiscountDesc: 'Discount applied to the referred user\'s first completed booking.',
    referrerRewardLabel: 'Referrer Reward',
    afterXCompletedBookings: 'After X completed bookings',
    referrerRewardDesc: 'The referrer receives this reward after their referred friend completes this many paid bookings.',
    completedBookingsRequiredLabel: 'Completed Bookings Required',
    rewardAmountLabel: 'Reward amount:',
    failedToSaveReferralSettings: 'Failed to save referral settings.',
    vehiclePriceMultipliersDesc: 'Configure price multipliers for different vehicle types. These affect the base price of all packages.',
    vehicleMultiplierExample: 'Example: A QAR 100 package costs: QAR {{motorcycle}} for Motorcycle, QAR {{sedan}} for Sedan, QAR {{suv}} for SUV, QAR {{pickup}} for Pickup.',
    smsFollowUpsDesc: 'Enable automated SMS messages for booking reminders, abandoned booking recovery, and win-back campaigns. Keep off during development to avoid carrier costs.',
    enableSmsFollowUps: 'Enable SMS Follow-Ups',
    enableSmsFollowUpsDesc: 'When enabled, SMS messages will fire for reminders, win-backs, and abandoned bookings. Requires a Twilio integration to be configured.',
    developmentMode: 'Development mode:',
    smsOffWarning: 'SMS is off. No messages will be sent and no costs will be incurred.',
    smsActiveWarning: 'SMS is active. Messages will be sent to customers. Ensure Twilio credentials are configured in appsettings.',
    social: {
      facebook: 'Facebook',
      twitter: 'Twitter/X',
      instagram: 'Instagram',
      linkedin: 'LinkedIn',
      youtube: 'YouTube',
    },
    days: {
      Sunday: 'Sunday',
      Monday: 'Monday',
      Tuesday: 'Tuesday',
      Wednesday: 'Wednesday',
      Thursday: 'Thursday',
      Friday: 'Friday',
      Saturday: 'Saturday',
    },
    vehicles: {
      motorcycle: 'Motorcycle',
      sedan: 'Sedan',
      suv: 'SUV',
      pickup: 'Pickup',
    },
  };
  const [policy, setPolicy] = useState({ feeEnabled:false, feeType:'Percent', feeAmount:20, freeWindowHours:24 });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  // Business config state
  const [biz, setBiz] = useState(() => getBusiness());
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved,  setBizSaved]  = useState(false);
  const [bizError,  setBizError]  = useState('');
  const [newArea,   setNewArea]   = useState('');

  // Scheduling: worker travel/prep gap between consecutive bookings
  const [workerTravelMinutes,  setWorkerTravelMinutes]  = useState(30);
  const [workerTravelSaving,   setWorkerTravelSaving]   = useState(false);
  const [workerTravelSaved,    setWorkerTravelSaved]    = useState(false);
  const [workerTravelError,    setWorkerTravelError]    = useState('');

  // SMS follow-up state
  const [smsEnabled,       setSmsEnabled]       = useState(false);
  const [smsSaving,        setSmsSaving]        = useState(false);
  const [smsSaved,         setSmsSaved]         = useState(false);
  const [smsError,         setSmsError]         = useState('');

  // Site visibility state
  const [sitePublished,    setSitePublished]    = useState(false);
  const [_siteSaving,      setSiteSaving]       = useState(false);
  const [_siteSaved,       setSiteSaved]        = useState(false);
  const [_siteError,       setSiteError]        = useState('');

  // Launch date state
  const [launchDate,       setLaunchDate]       = useState('2026-06-01T00:00');
  const [_launchSaving,    setLaunchSaving]     = useState(false);
  const [_launchSaved,     setLaunchSaved]      = useState(false);
  const [_launchError,     setLaunchError]      = useState('');

  // Subscription discount state
  const [discountPct,      setDiscountPct]      = useState(10);
  const [discountSaving,   setDiscountSaving]   = useState(false);
  const [discountSaved,    setDiscountSaved]    = useState(false);
  const [discountError,    setDiscountError]    = useState('');

  // Referral reward state
  const [referralReward,   setReferralReward]   = useState(50);
  const [referralSaving,   setReferralSaving]   = useState(false);
  const [referralSaved,    setReferralSaved]    = useState(false);
  const [referralError,    setReferralError]    = useState('');

  // Referral discount for referred user state
  const [referralDiscountPct, setReferralDiscountPct] = useState(0);
  const [referralDiscountSaving, setReferralDiscountSaving] = useState(false);
  const [referralDiscountSaved, setReferralDiscountSaved] = useState(false);
  const [referralDiscountError, setReferralDiscountError] = useState('');

  // Referral required bookings for referrer reward
  const [referralRequiredBookings, setReferralRequiredBookings] = useState(1);

  // Vehicle multipliers state
  const [vehicleMultipliers, setVehicleMultipliers] = useState({ motorcycle: 0.8, sedan: 1.0, suv: 1.25, pickup: 1.5 });
  const [multipliersSaving, setMultipliersSaving] = useState(false);
  const [multipliersSaved, setMultipliersSaved] = useState(false);
  const [multipliersError, setMultipliersError] = useState('');

  // Business hours state
  const defaultBusinessHours = {
    Sunday: '09:00-18:00', Monday: '09:00-18:00', Tuesday: '09:00-18:00',
    Wednesday: '09:00-18:00', Thursday: '09:00-18:00', Friday: '00:00-00:00', Saturday: '00:00-00:00',
  };
  const [businessHours, setBusinessHours] = useState(defaultBusinessHours);
  const [bizHoursSaving, setBizHoursSaving] = useState(false);
  const [bizHoursSaved, setBizHoursSaved] = useState(false);
  const [bizHoursError, setBizHoursError] = useState('');

  // Closed days
  const [closedDates, setClosedDates] = useState([]);
  const [newClosedDate, setNewClosedDate] = useState('');
  const [closedDatesSaving, setClosedDatesSaving] = useState(false);
  const [closedDatesError, setClosedDatesError] = useState('');

  // Feature flags
  const [featureFlags, setFeatureFlags] = useState({ favoriteDetailer: false });
  const [featureFlagsSaving, setFeatureFlagsSaving] = useState({});

  const formatDateTimeLocal = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsAPI.getCancellationPolicy();
        setPolicy({ feeEnabled: data.feeEnabled ?? false, feeType: data.feeType ?? 'Percent', feeAmount: data.feeAmount ?? 20, freeWindowHours: data.freeWindowHours ?? 24 });
      } catch { setError(ui.failedToLoadSettings); }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    settingsAPI.getSystemSettings()
      .then(data => {
        setWorkerTravelMinutes(data?.booking?.workerTravelBufferMinutes ?? data?.workerTravelBufferMinutes ?? 30);
        setDiscountPct(data?.subscriptionDiscountPercent ?? 10);
        setSmsEnabled(data?.sms?.followUpEnabled ?? false);
        setSitePublished(data?.site?.published ?? false);
        // Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
        if (data?.site?.launchDate) {
          try {
            const localDateTime = formatDateTimeLocal(data.site.launchDate);
            setLaunchDate(localDateTime);
          } catch {
            setLaunchDate('2026-06-01T00:00');
          }
        }
        setReferralReward(data?.referralRewardAmount ?? 50);
        setReferralDiscountPct(data?.referralDiscountPercent ?? 0);
        setReferralRequiredBookings(data?.referralRequiredBookings ?? 1);
        if (data?.pricing?.vehicleMultipliers) {
          const vm = data.pricing.vehicleMultipliers;
          setVehicleMultipliers({
            motorcycle: vm.Motorcycle ?? 0.8,
            sedan: vm.Sedan ?? 1.0,
            suv: vm.SUV ?? 1.25,
            pickup: vm.Pickup ?? 1.5,
          });
        }
        if (data?.businessHours) {
          setBusinessHours({
            Sunday:    data.businessHours.sunday    || '09:00-18:00',
            Monday:    data.businessHours.monday    || '09:00-18:00',
            Tuesday:   data.businessHours.tuesday   || '09:00-18:00',
            Wednesday: data.businessHours.wednesday || '09:00-18:00',
            Thursday:  data.businessHours.thursday  || '09:00-18:00',
            Friday:    data.businessHours.friday    || '00:00-00:00',
            Saturday:  data.businessHours.saturday  || '00:00-00:00',
          });
        }
        if (Array.isArray(data?.closedDates)) setClosedDates(data.closedDates);
                if (data?.businessConfig) {
                  const bc = data.businessConfig;
                  setBiz(b => ({
                    ...b,
                    ...(bc.name         && { name:         bc.name }),
                    ...(bc.tagline      && { tagline:       bc.tagline }),
                    ...(bc.phone        && { phone:         bc.phone }),
                    ...(bc.email        && { email:         bc.email }),
                    ...(bc.location     && { location:      bc.location }),
                    ...(bc.serviceAreas && { serviceAreas:  bc.serviceAreas }),
                    ...(bc.socialLinks  && { socialLinks:   bc.socialLinks }),
                  }));
                }
      })
      .catch(() => {});

    // Load feature flags
    settingsAPI.getFeatureFlags().then(flags => {
      setFeatureFlags(f => ({ ...f, ...flags }));
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      const updated = await settingsAPI.updateCancellationPolicy(policy);
      setPolicy({ feeEnabled: updated.feeEnabled, feeType: updated.feeType, feeAmount: updated.feeAmount, freeWindowHours: updated.freeWindowHours });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err?.response?.data?.message || ui.failedToSaveSettings); }
    finally { setSaving(false); }
  };

  const handleSaveWorkerTravel = async () => {
    const v = Number(workerTravelMinutes);
    if (!Number.isFinite(v) || v < 0 || v > 480) {
      setWorkerTravelError(ui.workerTravelRangeError); return;
    }
    try {
      setWorkerTravelSaving(true); setWorkerTravelError('');
      await settingsAPI.updateSystemSettings({ WorkerTravelBufferMinutes: v });
      setWorkerTravelSaved(true);
      setTimeout(() => setWorkerTravelSaved(false), 3000);
    } catch (err) { setWorkerTravelError(err?.response?.data?.message || ui.failedToSaveWorkerBuffer); }
    finally { setWorkerTravelSaving(false); }
  };

  const handleSaveSms = async () => {
    try {
      setSmsSaving(true); setSmsError('');
      await settingsAPI.updateSmsSettings({ followUpEnabled: smsEnabled });
      setSmsSaved(true);
      setTimeout(() => setSmsSaved(false), 3000);
    } catch (err) { setSmsError(err?.response?.data?.message || ui.failedToSaveSms); }
    finally { setSmsSaving(false); }
  };

  const _handleToggleSitePublished = async () => {
    const next = !sitePublished;
    try {
      setSiteSaving(true); setSiteError('');
      await settingsAPI.updateSystemSettings({ SitePublished: next });
      setSitePublished(next);
      setSiteSaved(true);
      setTimeout(() => setSiteSaved(false), 3000);
    } catch (err) { setSiteError(err?.response?.data?.message || ui.failedToSaveSiteVisibility); }
    finally { setSiteSaving(false); }
  };

  const _handleSaveLaunchDate = async () => {
    if (!launchDate) {
      setLaunchError(ui.launchDateRequired);
      return;
    }
    try {
      setLaunchSaving(true); setLaunchError('');
      // Convert datetime-local to ISO format with UTC timezone
      const date = new Date(launchDate);
      const isoString = date.toISOString();
      await settingsAPI.updateSystemSettings({ SiteLaunchDate: isoString });
      setLaunchSaved(true);
      setTimeout(() => setLaunchSaved(false), 3000);
    } catch (err) { setLaunchError(err?.response?.data?.message || ui.failedToSaveLaunchDate); }
    finally { setLaunchSaving(false); }
  };

  const handleSaveDiscount = async () => {
    const v = Number(discountPct);
    if (!Number.isFinite(v) || v < 0 || v > 50) {
      setDiscountError(ui.discountRangeError); return;
    }
    try {
      setDiscountSaving(true); setDiscountError('');
      await settingsAPI.updateSystemSettings({ subscriptionDiscountPercent: v });
      setDiscountSaved(true);
      setTimeout(() => setDiscountSaved(false), 3000);
    } catch (err) { setDiscountError(err?.response?.data?.message || ui.failedToSaveDiscount); }
    finally { setDiscountSaving(false); }
  };

  const _handleSaveReferralReward = async () => {
    const v = Number(referralReward);
    if (!Number.isFinite(v) || v < 0 || v > 500) {
      setReferralError(ui.referralRewardRangeError); return;
    }
    try {
      setReferralSaving(true); setReferralError('');
      await settingsAPI.updateSystemSettings({ ReferralRewardAmount: v });
      setReferralSaved(true);
      setTimeout(() => setReferralSaved(false), 3000);
    } catch (err) { setReferralError(err?.response?.data?.message || ui.failedToSaveReferralReward); }
    finally { setReferralSaving(false); }
  };

  const _handleSaveReferralDiscount = async () => {
    const v = Number(referralDiscountPct);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      setReferralDiscountError(ui.referralDiscountRangeError); return;
    }
    try {
      setReferralDiscountSaving(true); setReferralDiscountError('');
      await settingsAPI.updateSystemSettings({ ReferralDiscountPercent: v });
      setReferralDiscountSaved(true);
      setTimeout(() => setReferralDiscountSaved(false), 3000);
    } catch (err) { setReferralDiscountError(err?.response?.data?.message || ui.failedToSaveReferralDiscount); }
    finally { setReferralDiscountSaving(false); }
  };

  const handleSaveVehicleMultipliers = async () => {
    const vm = vehicleMultipliers;
    const valid = [vm.motorcycle, vm.sedan, vm.suv, vm.pickup].every(v => Number.isFinite(v) && v >= 0 && v <= 5);
    if (!valid) {
      setMultipliersError(ui.multiplierRangeError); return;
    }
    try {
      setMultipliersSaving(true); setMultipliersError('');
      await settingsAPI.updateSystemSettings({
        VehicleMultipliers: { Motorcycle: vm.motorcycle, Sedan: vm.sedan, SUV: vm.suv, Pickup: vm.pickup }
      });
      setMultipliersSaved(true);
      setTimeout(() => setMultipliersSaved(false), 3000);
    } catch (err) { setMultipliersError(err?.response?.data?.message || ui.failedToSaveMultipliers); }
    finally { setMultipliersSaving(false); }
  };

  const handleSaveBusinessHours = async () => {
    try {
      setBizHoursSaving(true); setBizHoursError('');
      await settingsAPI.updateSystemSettings({ BusinessHours: businessHours });
      setBizHoursSaved(true);
      setTimeout(() => setBizHoursSaved(false), 3000);
    } catch (err) { setBizHoursError(err?.response?.data?.message || ui.failedToSaveBusinessHours); }
    finally { setBizHoursSaving(false); }
  };

  const updateBusinessHours = (day, start, end) => {
    setBusinessHours(prev => ({ ...prev, [day]: `${start}-${end}` }));
  };

  const handleAddClosedDate = async () => {
    if (!newClosedDate) return;
    const updated = [...new Set([...closedDates, newClosedDate])].sort();
    setClosedDatesSaving(true); setClosedDatesError('');
    try {
      await settingsAPI.updateClosedDates(updated);
      setClosedDates(updated);
      setNewClosedDate('');
    } catch (err) { setClosedDatesError(err?.response?.data?.message || ui.failedToSaveClosedDates); }
    finally { setClosedDatesSaving(false); }
  };

  const handleRemoveClosedDate = async (date) => {
    const updated = closedDates.filter(d => d !== date);
    setClosedDatesSaving(true); setClosedDatesError('');
    try {
      await settingsAPI.updateClosedDates(updated);
      setClosedDates(updated);
    } catch (err) { setClosedDatesError(err?.response?.data?.message || ui.failedToSaveClosedDates); }
    finally { setClosedDatesSaving(false); }
  };

  const handleToggleFeatureFlag = async (flag) => {
    const current = featureFlags[flag] || false;
    setFeatureFlagsSaving(p => ({ ...p, [flag]: true }));
    try {
      await settingsAPI.setFeatureFlag(flag, !current);
      setFeatureFlags(f => ({ ...f, [flag]: !current }));
    } catch { }
    finally { setFeatureFlagsSaving(p => ({ ...p, [flag]: false })); }
  };

  const exampleFee = policy.feeType === 'Percent'
    ? `${policy.feeAmount}% of booking total`
    : formatQAR(policy.feeAmount);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-[var(--muted-color)] text-sm">{ui.loadingSettings}</p>
    </div>
  );

  return (
    <>
      <style>{PRISM_CSS}</style>
      <PrismaticCursorOrb />
      <div className="min-h-screen py-10 relative"
        style={{ background:'radial-gradient(circle at 7% 6%,rgba(200,169,107,.05) 0%,transparent 38%),radial-gradient(circle at 93% 92%,rgba(14,165,160,.04) 0%,transparent 32%)' }}>
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background:'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter:'blur(85px)', animation:'spectrum-float 20s ease-in-out infinite' }} />
        <div className="container mx-auto px-4 max-w-2xl relative z-10 space-y-6">

          {/* ── Header ── */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background:'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">{t('adminPanel')}</p>
              <span className="h-px w-7" style={{ background:'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                <Settings size={16} style={{ color:'#c8a96b' }} />
              </div>
              <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.adminSettings}</h1>
            </div>
            <p className="text-sm text-[var(--muted-color)] ml-12">{ui.settingsSubtitle}</p>
          </div>

          {/* ── Cancellation Policy card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#c8a96b 0%,#c8a96b44 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'72%', width:'14%', animation:'prism-ray-sweep 20s ease-in-out 4s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                  <Shield size={14} style={{ color:'#c8a96b' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.cancellationPolicy}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.cancellationPolicyDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{error}</p>
                </div>
              )}

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] mb-5">
                <div>
                  <p className="font-bold text-sm text-[var(--heading-color)] mb-0.5">{ui.enableCancellationFee}</p>
                  <p className="text-xs text-[var(--muted-color)]">{ui.cancellationFeeWarning}</p>
                </div>
                <Toggle checked={policy.feeEnabled} onClick={() => setPolicy(p => ({ ...p, feeEnabled:!p.feeEnabled }))} />
              </div>

              {/* Fee type pills */}
              <div className="mb-5">
                <label className="field-label">{ui.feeTypeLabel}</label>
                <div className="flex gap-2">
                  {['Percent','Flat'].map(t => (
                    <button key={t} type="button" disabled={!policy.feeEnabled}
                      onClick={() => setPolicy(p => ({ ...p, feeType:t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-40 ${
                        policy.feeType !== t ? 'border-[var(--border-color)] text-[var(--muted-color)] hover:border-primary/30 hover:text-[var(--text-color)]' : ''
                      }`}
                      style={policy.feeType === t ? { background:'rgba(200,169,107,.10)', borderColor:'rgba(200,169,107,.45)', color:'#c8a96b' } : {}}>
                      {t === 'Percent' ? ui.feeTypePercent : ui.feeTypeFlat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee amount */}
              <div className="mb-5">
                <label className="field-label">{policy.feeType === 'Percent' ? ui.feePercentageLabel : ui.flatFeeLabel}</label>
                <input type="number" min={0} max={policy.feeType === 'Percent' ? 100 : undefined}
                  step={policy.feeType === 'Percent' ? 1 : 0.5}
                  value={policy.feeAmount} disabled={!policy.feeEnabled}
                  onChange={e => setPolicy(p => ({ ...p, feeAmount: parseFloat(e.target.value) || 0 }))}
                  className="field-input disabled:opacity-40" />
              </div>

              {/* Free window */}
              <div className="mb-5">
                <label className="field-label">{ui.freeCancellationWindowLabel}</label>
                <p className="text-xs text-[var(--muted-color)] mb-2">{ui.freeCancellationWindowDesc}</p>
                <input type="number" min={0} step={1} value={policy.freeWindowHours} disabled={!policy.feeEnabled}
                  onChange={e => setPolicy(p => ({ ...p, freeWindowHours: parseInt(e.target.value) || 0 }))}
                  className="field-input disabled:opacity-40" />
              </div>

              {/* Preview */}
              {policy.feeEnabled && (
                <div className="rounded-xl border p-4 mb-6"
                  style={{ background:'rgba(245,158,11,.08)', borderColor:'rgba(245,158,11,.28)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={12} style={{ color:'#f59e0b' }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#f59e0b' }}>{ui.policyPreviewLabel}</p>
                  </div>
                  <p className="text-sm text-[var(--text-color)]">
                    {ui.policyPreviewText
                      .replace('{{hours}}', String(policy.freeWindowHours))
                      .replace('{{fee}}', exampleFee)}
                  </p>
                </div>
              )}

              {/* Save */}
              <div className="cta-prism-glow rounded-xl">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition disabled:opacity-60">
                  {saving ? ui.saving : saved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveSettings}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Business Configuration card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#10b981 38%,#0ea5a0 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#10b981 0%,#10b98144 60%,transparent 100%)' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.24)' }}>
                  <Building2 size={14} style={{ color:'#10b981' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.businessConfiguration}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.businessConfigurationDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {bizError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{bizError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="sm:col-span-2">
                  <label className="field-label">{ui.logoUrlLabel}</label>
                  <input type="url" value={biz.logo || ''}
                    onChange={e => setBiz(b => ({ ...b, logo: e.target.value }))}
                    className="field-input" placeholder={ui.logoUrlPlaceholder} />
                  <p className="text-xs text-[var(--muted-color)] mt-1">{ui.logoHint}</p>
                  {biz.logo && (
                    <div className="mt-2 p-2 rounded-lg border border-[var(--border-color)] inline-block">
                      <img src={biz.logo} alt={ui.logoPreviewAlt} className="h-12 object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="field-label">{ui.businessNameLabel}</label>
                  <input type="text" value={biz.name}
                    onChange={e => setBiz(b => ({ ...b, name: e.target.value }))}
                    className="field-input" placeholder={ui.businessNamePlaceholder} />
                </div>
                <div>
                  <label className="field-label">{ui.taglineLabel}</label>
                  <input type="text" value={biz.tagline}
                    onChange={e => setBiz(b => ({ ...b, tagline: e.target.value }))}
                    className="field-input" placeholder={ui.taglinePlaceholder} />
                </div>
                <div>
                  <label className="field-label">{ui.phoneLabel}</label>
                  <input type="text" value={biz.phone}
                    onChange={e => setBiz(b => ({ ...b, phone: e.target.value }))}
                    className="field-input" placeholder={ui.phonePlaceholder} />
                </div>
                <div>
                  <label className="field-label">{ui.supportEmailLabel}</label>
                  <input type="email" value={biz.email}
                    onChange={e => setBiz(b => ({ ...b, email: e.target.value }))}
                    className="field-input" placeholder={ui.supportEmailPlaceholder} />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">{ui.operatingAreaLabel}</label>
                  <input type="text" value={biz.location}
                    onChange={e => setBiz(b => ({ ...b, location: e.target.value }))}
                    className="field-input" placeholder={ui.operatingAreaPlaceholder} />
                </div>
                 <div className="sm:col-span-2">
                   <label className="field-label">{ui.serviceAreasLabel}</label>
                   <div className="flex flex-wrap gap-2 mb-3">
                     {(biz.serviceAreas || []).map((area, i) => (
                       <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                         style={{ background: 'rgba(200,169,107,.12)', color: '#c8a96b', border: '1px solid rgba(200,169,107,.28)' }}>
                         {area}
                         <button type="button"
                           onClick={() => setBiz(b => ({ ...b, serviceAreas: (b.serviceAreas || []).filter((_, j) => j !== i) }))}
                           className="text-[var(--muted-color)] hover:text-rose-400 transition-colors ml-0.5">
                           ×
                         </button>
                       </span>
                     ))}
                     {(!biz.serviceAreas || biz.serviceAreas.length === 0) && (
                       <span className="text-xs text-[var(--muted-color)]">{ui.noAreasAdded}</span>
                     )}
                   </div>
                   <div className="flex gap-2">
                     <input
                       type="text"
                       value={newArea}
                       onChange={e => setNewArea(e.target.value)}
                       onKeyDown={e => {
                         if (e.key === 'Enter' && newArea.trim()) {
                           setBiz(b => ({ ...b, serviceAreas: [...(b.serviceAreas || []), newArea.trim()] }));
                           setNewArea('');
                         }
                       }}
                       placeholder={ui.areaInputPlaceholder}
                       className="field-input flex-1"
                     />
                     <button type="button"
                       onClick={() => {
                         if (newArea.trim()) {
                           setBiz(b => ({ ...b, serviceAreas: [...(b.serviceAreas || []), newArea.trim()] }));
                           setNewArea('');
                         }
                       }}
                       className="px-4 py-2.5 rounded-xl text-xs font-bold transition"
                       style={{ background: 'rgba(200,169,107,.12)', color: '#c8a96b', border: '1px solid rgba(200,169,107,.28)' }}>
                       {ui.addAreaButton}
                     </button>
                   </div>
                 </div>

                 {/* Social Links */}
                 <div className="sm:col-span-2 mt-4">
                   <label className="field-label">{ui.socialMediaLinksLabel}</label>
                   <div className="space-y-3">
                     {[
                       { id: 'facebook', label: ui.social.facebook },
                       { id: 'twitter', label: ui.social.twitter },
                       { id: 'instagram', label: ui.social.instagram },
                       { id: 'linkedin', label: ui.social.linkedin },
                       { id: 'youtube', label: ui.social.youtube },
                     ].map(({ id, label }) => (
                       <div key={id} className="flex items-center gap-3">
                         <span className="w-24 text-xs font-medium text-[var(--muted-color)]">{label}</span>
                         <input
                           type="url"
                           value={biz.socialLinks?.[id] || ''}
                           onChange={e => setBiz(b => ({
                             ...b,
                             socialLinks: { ...(b.socialLinks || {}), [id]: e.target.value }
                           }))}
                           placeholder={`https://${id}.com/your-page`}
                           className="field-input flex-1"
                         />
                       </div>
                     ))}
                   </div>
                 </div>
              </div>

              <div className="cta-prism-glow rounded-xl">
                <button
                  type="button"
                  disabled={bizSaving}
                  onClick={async () => {
                    setBizSaving(true);
                    setBizError('');
                try {
                    await settingsAPI.updateBusinessConfig({
                      name:         biz.name,
                      logo:         biz.logo,
                      tagline:      biz.tagline,
                      phone:        biz.phone,
                      email:        biz.email,
                      location:     biz.location,
                      serviceAreas: biz.serviceAreas,
                      socialLinks:  biz.socialLinks,
                    });
                      saveBusiness(biz);
                      setBizSaved(true);
                      setTimeout(() => setBizSaved(false), 3000);
                    } catch (err) {
                      setBizError(err?.response?.data?.message || ui.failedToSaveBusinessConfig);
                    } finally {
                      setBizSaving(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.35)', color:'#10b981' }}
                >
                  {bizSaving ? ui.saving : bizSaved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveBusinessConfig}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Booking Time Buffers card (combined Customer Lead Time + Worker Travel Buffer) ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#6366f1 38%,#06b6d4 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#6366f1 0%,#06b6d488 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'55%', width:'14%', animation:'prism-ray-sweep 22s ease-in-out 2s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(99,102,241,.12)', border:'1px solid rgba(99,102,241,.24)' }}>
                  <Clock size={14} style={{ color:'#6366f1' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.bookingTimeBuffers}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.bookingTimeBuffersDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {/* ── Worker Travel Buffer ── */}
              <div className="mb-6 p-5 rounded-xl border"
                style={{ background:'rgba(6,182,212,.06)', borderColor:'rgba(6,182,212,.20)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background:'rgba(6,182,212,.15)' }}>
                    <Clock size={10} style={{ color:'#22d3ee' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--heading-color)]">{ui.workerTravelBufferTitle}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#22d3ee' }}>{ui.workerTravelBufferTag}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-color)] mb-4 mt-2">{ui.workerTravelBufferDesc}</p>

                {workerTravelError && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 mb-4">
                    <AlertCircle size={12} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-rose-300 text-xs font-semibold">{workerTravelError}</p>
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  {[0, 15, 30, 45, 60].map(v => (
                    <button key={v} type="button" onClick={() => setWorkerTravelMinutes(v)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition"
                      style={workerTravelMinutes === v
                        ? { background:'rgba(6,182,212,.18)', borderColor:'rgba(6,182,212,.55)', color:'#22d3ee' }
                        : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                      {v} min
                    </button>
                  ))}
                </div>
                <input type="number" min={0} max={480} step={5} value={workerTravelMinutes}
                  onChange={e => setWorkerTravelMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="field-input" />

                <p className="text-xs text-[var(--text-color)] mt-3">{ui.workerTravelRule.replace('{{minutes}}', String(workerTravelMinutes))}</p>
              </div>

              {/* ── Save ── */}
              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(6,182,212,.40)' }}>
                <button type="button" onClick={handleSaveWorkerTravel} disabled={workerTravelSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(6,182,212,.15)', border:'1px solid rgba(6,182,212,.35)', color:'#22d3ee' }}>
                  {workerTravelSaving ? ui.saving : workerTravelSaved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveWorkerBuffer}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Business Hours card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#10b981 38%,#06b6d4 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#10b981 0%,#10b98144 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'60%', width:'14%', animation:'prism-ray-sweep 20s ease-in-out 3s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.24)' }}>
                  <Clock size={14} style={{ color:'#10b981' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.businessHours}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.businessHoursDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {bizHoursError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{bizHoursError}</p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                  const [start, end] = (businessHours[day] || '09:00-18:00').split('-');
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="w-28 text-sm font-medium text-[var(--text-color)]">{ui.days[day] || day}</span>
                      <input type="time" value={start} step="1800"
                        onChange={e => updateBusinessHours(day, e.target.value, end)}
                        className="field-input flex-1" />
                      <span className="text-[var(--muted-color)]">{ui.to}</span>
                      <input type="time" value={end} step="1800"
                        onChange={e => updateBusinessHours(day, start, e.target.value)}
                        className="field-input flex-1" />
                    </div>
                  );
                })}
              </div>

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(16,185,129,.40)' }}>
                <button type="button" onClick={handleSaveBusinessHours} disabled={bizHoursSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.35)', color:'#10b981' }}>
                  {bizHoursSaving ? ui.saving : bizHoursSaved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveBusinessHours}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Special Closed Days card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#ef4444 38%,#f97316 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#ef4444 0%,#ef444444 60%,transparent 100%)' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.24)' }}>
                  <Clock size={14} style={{ color:'#ef4444' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.closedDays}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.closedDaysDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {closedDatesError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{closedDatesError}</p>
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <input type="date" value={newClosedDate}
                  onChange={e => setNewClosedDate(e.target.value)}
                  className="field-input flex-1" />
                <button type="button" onClick={handleAddClosedDate} disabled={closedDatesSaving || !newClosedDate}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.35)', color:'#f87171' }}>
                  {ui.addClosedDate}
                </button>
              </div>

              {closedDates.length === 0 ? (
                <p className="text-xs text-[var(--muted-color)] mb-2">{ui.closedDatesNone}</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-2">
                  {closedDates.map(d => (
                    <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background:'rgba(239,68,68,.10)', color:'#f87171', border:'1px solid rgba(239,68,68,.28)' }}>
                      {d}
                      <button type="button" onClick={() => handleRemoveClosedDate(d)} disabled={closedDatesSaving}
                        className="hover:text-rose-200 transition-colors ml-0.5 disabled:opacity-50">
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Feature Flags card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#8b5cf6 38%,#06b6d4 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#8b5cf6 0%,#8b5cf644 60%,transparent 100%)' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(139,92,246,.12)', border:'1px solid rgba(139,92,246,.24)' }}>
                  <FlaskConical size={14} style={{ color:'#8b5cf6' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.featureFlags}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.featureFlagsDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)]">
                <div>
                  <p className="font-bold text-sm text-[var(--heading-color)] mb-0.5">{ui.featureFlagFavoriteDetailer}</p>
                  <p className="text-xs text-[var(--muted-color)]">{ui.featureFlagFavoriteDetailerDesc}</p>
                </div>
                {featureFlagsSaving.favoriteDetailer ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                ) : (
                  <Toggle checked={featureFlags.favoriteDetailer || false} onClick={() => handleToggleFeatureFlag('favoriteDetailer')} />
                )}
              </div>
            </div>
          </div>

          {/* ── Subscription Discount card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#f59e0b 38%,#10b981 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#f59e0b 0%,#f59e0b44 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'65%', width:'14%', animation:'prism-ray-sweep 18s ease-in-out 1s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.24)' }}>
                  <span style={{ color:'#f59e0b', fontWeight:700, fontSize:14 }}>%</span>
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.subscriptionDiscount}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.subscriptionDiscountDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {discountError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{discountError}</p>
                </div>
              )}

              <div className="mb-5">
                <label className="field-label">{ui.discountPercentageLabel}</label>
                <p className="text-xs text-[var(--muted-color)] mb-3">{ui.discountPercentageDesc}</p>
                <div className="flex gap-2 mb-3">
                  {[0, 5, 10, 15, 20].map(v => (
                    <button key={v} type="button" onClick={() => setDiscountPct(v)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border transition"
                      style={discountPct === v
                        ? { background:'rgba(245,158,11,.14)', borderColor:'rgba(245,158,11,.50)', color:'#fbbf24' }
                        : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                      {v}%
                    </button>
                  ))}
                </div>
                <input type="number" min={0} max={50} step={1} value={discountPct}
                  onChange={e => setDiscountPct(Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="field-input" />
              </div>

              <div className="rounded-xl border p-4 mb-6"
                style={{ background:'rgba(245,158,11,.07)', borderColor:'rgba(245,158,11,.25)' }}>
                <p className="text-sm text-[var(--text-color)]">{ui.discountEndpointNote}</p>
              </div>

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(245,158,11,.40)' }}>
                <button type="button" onClick={handleSaveDiscount} disabled={discountSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(245,158,11,.15)', border:'1px solid rgba(245,158,11,.35)', color:'#fbbf24' }}>
                  {discountSaving ? ui.saving : discountSaved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveDiscount}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Referral Settings card (Reward + Discount) ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#8b5cf6 38%,#f97316 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#8b5cf6 0%,#8b5cf644 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'60%', width:'14%', animation:'prism-ray-sweep 19s ease-in-out 2s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(139,92,246,.12)', border:'1px solid rgba(139,92,246,.24)' }}>
                  <Gift size={14} style={{ color:'#8b5cf6' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.referralSettings}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.referralSettingsDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {(referralError || referralDiscountError) && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{referralError || referralDiscountError}</p>
                </div>
              )}

              {/* ── Referral Discount for Referred User ── */}
              <div className="mb-6 p-5 rounded-xl border"
                style={{ background:'rgba(249,115,22,.06)', borderColor:'rgba(249,115,22,.20)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background:'rgba(249,115,22,.15)' }}>
                    <Gift size={10} style={{ color:'#fb923c' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--heading-color)]">{ui.referredUserDiscountLabel}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#fb923c' }}>{ui.firstBookingOnly}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-color)] mb-4 mt-2">{ui.referredUserDiscountDesc}</p>
                <div className="flex gap-2 mb-3">
                  {[0, 5, 10, 15, 20, 25].map(v => (
                    <button key={v} type="button" onClick={() => setReferralDiscountPct(v)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition"
                      style={referralDiscountPct === v
                        ? { background:'rgba(249,115,22,.18)', borderColor:'rgba(249,115,22,.55)', color:'#fb923c' }
                        : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                      {v}%
                    </button>
                  ))}
                </div>
                <input type="number" min={0} max={100} step={1} value={referralDiscountPct}
                  onChange={e => setReferralDiscountPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="field-input" />
              </div>

              {/* ── Referral Reward for Referrer ── */}
              <div className="mb-6 p-5 rounded-xl border"
                style={{ background:'rgba(139,92,246,.06)', borderColor:'rgba(139,92,246,.20)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background:'rgba(139,92,246,.15)' }}>
                    <Gift size={10} style={{ color:'#a78bfa' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--heading-color)]">{ui.referrerRewardLabel}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#a78bfa' }}>{ui.afterXCompletedBookings}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-color)] mb-3 mt-2">{ui.referrerRewardDesc}</p>
                <div className="mb-3">
                  <label className="field-label text-xs">{ui.completedBookingsRequiredLabel}</label>
                  <div className="flex gap-2 mb-2">
                    {[1, 3, 5, 10].map(v => (
                      <button key={v} type="button" onClick={() => setReferralRequiredBookings(v)}
                        className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition"
                        style={referralRequiredBookings === v
                          ? { background:'rgba(139,92,246,.18)', borderColor:'rgba(139,92,246,.55)', color:'#a78bfa' }
                          : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={1} max={100} step={1} value={referralRequiredBookings}
                    onChange={e => setReferralRequiredBookings(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="field-input" />
                </div>
                <p className="text-xs text-[var(--muted-color)] mb-4">{ui.rewardAmountLabel}</p>
                <div className="flex gap-2 mb-3">
                  {[25, 50, 75, 100].map(v => (
                    <button key={v} type="button" onClick={() => setReferralReward(v)}
                      className="flex-1 py-1.5 rounded-xl text-xs font-bold border transition"
                      style={referralReward === v
                        ? { background:'rgba(139,92,246,.18)', borderColor:'rgba(139,92,246,.55)', color:'#a78bfa' }
                        : { borderColor:'var(--border-color)', color:'var(--muted-color)' }}>
                      {v} QAR
                    </button>
                  ))}
                </div>
                <input type="number" min={0} max={500} step={5} value={referralReward}
                  onChange={e => setReferralReward(Math.min(500, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="field-input" />
              </div>

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(139,92,246,.40)' }}>
                <button 
                  type="button" 
                  onClick={async () => {
                    try {
                      setReferralSaving(true); setReferralError('');
                      await settingsAPI.updateSystemSettings({ ReferralRewardAmount: referralReward, ReferralDiscountPercent: referralDiscountPct, ReferralRequiredBookings: referralRequiredBookings });
                      setReferralSaved(true);
                      setReferralDiscountSaved(true);
                      setTimeout(() => { setReferralSaved(false); setReferralDiscountSaved(false); }, 3000);
                    } catch (err) { setReferralError(err?.response?.data?.message || ui.failedToSaveReferralSettings); }
                    finally { setReferralSaving(false); setReferralDiscountSaving(false); }
                  }} 
                  disabled={referralSaving || referralDiscountSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(139,92,246,.15)', border:'1px solid rgba(139,92,246,.35)', color:'#a78bfa' }}>
                  {(referralSaving || referralDiscountSaving) ? ui.saving : (referralSaved || referralDiscountSaved) ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveReferralSettings}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Vehicle Multipliers card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#3b82f6 38%,#8b5cf6 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#3b82f6 0%,#3b82f644 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'58%', width:'14%', animation:'prism-ray-sweep 23s ease-in-out 2s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(59,130,246,.12)', border:'1px solid rgba(59,130,246,.24)' }}>
                  <Shield size={14} style={{ color:'#3b82f6' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.vehiclePriceMultipliers}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.vehiclePriceMultipliersDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {multipliersError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{multipliersError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  { key: 'motorcycle', label: ui.vehicles.motorcycle, icon: '🏍️' },
                  { key: 'sedan', label: ui.vehicles.sedan, icon: '🚗' },
                  { key: 'suv', label: ui.vehicles.suv, icon: '🚙' },
                  { key: 'pickup', label: ui.vehicles.pickup, icon: '🛻' },
                ].map(({ key, label, icon }) => (
                  <div key={key}>
                    <label className="field-label">{icon} {label}</label>
                    <input type="number" min={0} max={5} step={0.05} value={vehicleMultipliers[key]}
                      onChange={e => setVehicleMultipliers(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      className="field-input text-center font-mono" />
                  </div>
                ))}
              </div>

              <div className="rounded-xl border p-4 mb-6"
                style={{ background:'rgba(59,130,246,.07)', borderColor:'rgba(59,130,246,.25)' }}>
                <p className="text-sm text-[var(--text-color)]">{ui.vehicleMultiplierExample
                  .replace('{{motorcycle}}', String(Math.round(100 * vehicleMultipliers.motorcycle)))
                  .replace('{{sedan}}', String(Math.round(100 * vehicleMultipliers.sedan)))
                  .replace('{{suv}}', String(Math.round(100 * vehicleMultipliers.suv)))
                  .replace('{{pickup}}', String(Math.round(100 * vehicleMultipliers.pickup)))}</p>
              </div>

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(59,130,246,.40)' }}>
                <button type="button" onClick={handleSaveVehicleMultipliers} disabled={multipliersSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(59,130,246,.15)', border:'1px solid rgba(59,130,246,.35)', color:'#60a5fa' }}>
                  {multipliersSaving ? ui.saving : multipliersSaved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveMultipliers}</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── SMS Follow-Up Notifications card ── */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#06b6d4 38%,#3b82f6 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#06b6d4 0%,#06b6d444 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'58%', width:'14%', animation:'prism-ray-sweep 25s ease-in-out 3s infinite' }} />

            <div className="p-7">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(6,182,212,.12)', border:'1px solid rgba(6,182,212,.24)' }}>
                  <MessageSquare size={14} style={{ color:'#06b6d4' }} />
                </div>
                <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{ui.smsFollowUps}</h2>
              </div>
              <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.smsFollowUpsDesc}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {smsError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 mb-5">
                  <AlertCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-rose-300 text-sm font-semibold">{smsError}</p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-color)] mb-4">
                <div>
                  <p className="font-bold text-sm text-[var(--heading-color)] mb-0.5">{ui.enableSmsFollowUps}</p>
                  <p className="text-xs text-[var(--muted-color)]">{ui.enableSmsFollowUpsDesc}</p>
                </div>
                <Toggle checked={smsEnabled} onClick={() => setSmsEnabled(v => !v)} />
              </div>

              {!smsEnabled && (
                <div className="rounded-xl border p-3 mb-5"
                  style={{ background:'rgba(245,158,11,.07)', borderColor:'rgba(245,158,11,.28)' }}>
                  <p className="text-xs text-[var(--muted-color)]"><span style={{ color:'#fbbf24', fontWeight:700 }}>{ui.developmentMode}</span>{' '}{ui.smsOffWarning}</p>
                </div>
              )}

              {smsEnabled && (
                <div className="rounded-xl border p-3 mb-5"
                  style={{ background:'rgba(239,68,68,.07)', borderColor:'rgba(239,68,68,.28)' }}>
                  <p className="text-xs" style={{ color:'#f87171' }}><strong>{ui.smsActiveWarning}</strong></p>
                </div>
              )}

              <div className="cta-prism-glow rounded-xl" style={{ boxShadow:'0 0 0 1.5px rgba(6,182,212,.40)' }}>
                <button type="button" onClick={handleSaveSms} disabled={smsSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60"
                  style={{ background:'rgba(6,182,212,.15)', border:'1px solid rgba(6,182,212,.35)', color:'#22d3ee' }}>
                  {smsSaving ? ui.saving : smsSaved ? <><CheckCircle size={14} /> {ui.saved}</> : <><Save size={14} /> {ui.saveSmsSetting}</>}
                </button>
              </div>
            </div>
          </div>


          {/* ── Dev Testing Section ── */}
          <div className="glass-card relative overflow-hidden card-stagger mt-6">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#ef4444 38%,#c8a96b 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#ef4444 0%,#ef444444 60%,transparent 100%)' }} />
            <div className="p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.24)' }}>
                  <FlaskConical size={18} style={{ color:'#ef4444' }} />
                </div>
                <h2 className="text-lg font-bold" style={{ color:'var(--heading-color)' }}>Dev Testing</h2>
              </div>
              <p className="text-xs text-[var(--muted-color)] mb-5">
                Test notification cleanup logic. No actual changes in production.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
                  style={{ background:'rgba(168,85,247,.15)', border:'1px solid rgba(168,85,247,.35)', color:'#a855f7' }}
                >
                  <Trash2 size={14} />
                  Simulate 7-Day Cleanup
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
                  style={{ background:'rgba(59,130,246,.15)', border:'1px solid rgba(59,130,246,.35)', color:'#3b82f6' }}
                >
                  <Trash2 size={14} />
                  Simulate 30-Day Cleanup
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
                  style={{ background:'rgba(234,179,8,.15)', border:'1px solid rgba(234,179,8,.35)', color:'#eab308' }}
                >
                  <Database size={14} />
                  Run Full Cleanup
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}