import React, { useEffect, useState } from 'react';
import {
  Eye, EyeOff, Images, KeyRound, MapPin, Phone,
  Save, Upload, User, CheckCircle, AlertCircle, Shield, Gift,
} from 'lucide-react';
import { loyaltyAPI } from '../../api/loyalty';
import { useAuth } from '../../context/AuthContext';
import AddressAutocompleteInput from '../../components/shared/AddressAutocompleteInput';
import AvatarPicker from '../../components/shared/AvatarPicker';

const addressTypes = ['Home', 'Work', 'Other'];
const apiBaseUrl   = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';

const toAbsoluteImageUrl = (value) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const apiOrigin = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
  return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
};

/* ── Section heading ─────────────────────────────────────────────────────────── */
function SectionHeading({ icon: Icon, children, step }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {step !== undefined && (
        <span
          className="text-[0.58rem] font-bold tracking-[0.2em] flex-shrink-0"
          style={{ color: 'var(--muted-color)', opacity: 0.45 }}
        >
          {String(step).padStart(2, '0')}
        </span>
      )}
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
      )}
      <h2 className="text-lg font-bold text-[var(--heading-color)] tracking-tight">{children}</h2>
      <span
        className="flex-1 h-px ml-1 hidden sm:block"
        style={{ background: 'linear-gradient(90deg, rgba(200,169,107,0.18), transparent)' }}
      />
    </div>
  );
}

/* ── Status banner ───────────────────────────────────────────────────────────── */
function StatusBanner({ type, message }) {
  const isError = type === 'error';
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 mb-6 ${
      isError
        ? 'bg-red-500/8 border-red-500/20 text-red-400'
        : 'bg-green-500/8 border-green-500/20 text-green-400'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isError ? 'bg-red-500/15' : 'bg-green-500/15'
      }`}>
        {isError ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
      </div>
      <p className="text-sm font-medium leading-relaxed">{message}</p>
    </div>
  );
}

/* ── Address type colour map ─────────────────────────────────────────────────── */
const addressTypeStyle = {
  Home:  { iconBg: 'bg-blue-500/15',   iconColor: 'text-blue-400'   },
  Work:  { iconBg: 'bg-purple-500/15', iconColor: 'text-purple-400' },
  Other: { iconBg: 'bg-amber-500/15',  iconColor: 'text-amber-400'  },
};

const addressPlaceholders = {
  Home:  'Search your home area',
  Work:  'Search your work area',
  Other: 'Search another address',
};

/* ── Shared input class ──────────────────────────────────────────────────────── */
const inputCls =
  'w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] px-4 py-3 text-sm text-[var(--text-color)] placeholder:text-[var(--muted-color)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition';

/* ════════════════════════════════════════════════════════════════════════════════
   PROFILE PAGE
   ════════════════════════════════════════════════════════════════════════════════ */
function Profile() {
  const { user, updateProfile, uploadProfileImage, changePassword, isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    firstName:            '',
    lastName:             '',
    phone:                '',
    profileImageUrl:      '',
    homeAddress:          '',
    homeHouseNumber:      '',
    workAddress:          '',
    workHouseNumber:      '',
    otherAddress:         '',
    otherHouseNumber:     '',
    preferredAddressType: 'Home',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword:    '',
    newPassword:        '',
    confirmNewPassword: '',
  });
  const [showAvatarPicker,       setShowAvatarPicker]       = useState(false);
  const [saving,                 setSaving]                 = useState(false);
  const [changingPassword,       setChangingPassword]       = useState(false);
  const [profileError,           setProfileError]           = useState('');
  const [profileSuccess,         setProfileSuccess]         = useState('');
  const [passwordError,          setPasswordError]          = useState('');
  const [passwordSuccess,        setPasswordSuccess]        = useState('');
  const [showCurrentPassword,    setShowCurrentPassword]    = useState(false);
  const [showNewPassword,        setShowNewPassword]        = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    loyaltyAPI.getBalance().then(d => setLoyalty(d)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setFormData({
      firstName:            user.firstName            || '',
      lastName:             user.lastName             || '',
      phone:                user.phone                || '',
      profileImageUrl:      user.profileImageUrl      || '',
      homeAddress:          user.homeAddress          || '',
      homeHouseNumber:      user.homeHouseNumber      || '',
      workAddress:          user.workAddress          || '',
      workHouseNumber:      user.workHouseNumber      || '',
      otherAddress:         user.otherAddress         || '',
      otherHouseNumber:     user.otherHouseNumber     || '',
      preferredAddressType: user.preferredAddressType || 'Home',
    });
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setProfileError('');
    setProfileSuccess('');
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true); setProfileError(''); setProfileSuccess('');
    try {
      await updateProfile({
        firstName:            formData.firstName,
        lastName:             formData.lastName,
        phone:                formData.phone,
        profileImageUrl:      formData.profileImageUrl      || null,
        homeAddress:          formData.homeAddress          || null,
        homeHouseNumber:      formData.homeHouseNumber      || null,
        workAddress:          formData.workAddress          || null,
        workHouseNumber:      formData.workHouseNumber      || null,
        otherAddress:         formData.otherAddress         || null,
        otherHouseNumber:     formData.otherHouseNumber     || null,
        preferredAddressType: formData.preferredAddressType,
      });
      setProfileSuccess('Profile updated. Future bookings will use your selected default address.');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally { setSaving(false); }
  };

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('image', file);
    setSaving(true); setProfileError(''); setProfileSuccess('');
    try {
      const updatedUser = await uploadProfileImage(body);
      setFormData((prev) => ({
        ...prev,
        profileImageUrl: updatedUser.profileImageUrl || prev.profileImageUrl,
      }));
      setProfileSuccess('Profile image updated.');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to upload profile image.');
    } finally { setSaving(false); event.target.value = ''; }
  };

  const handleAvatarSelect = async (avatarPath) => {
    setSaving(true); setProfileError(''); setProfileSuccess('');
    try {
      await updateProfile({
        firstName:            formData.firstName  || user.firstName,
        lastName:             formData.lastName   || user.lastName,
        phone:                formData.phone      || user.phone,
        profileImageUrl:      avatarPath,
        homeAddress:          formData.homeAddress          || null,
        homeHouseNumber:      formData.homeHouseNumber      || null,
        workAddress:          formData.workAddress          || null,
        workHouseNumber:      formData.workHouseNumber      || null,
        otherAddress:         formData.otherAddress         || null,
        otherHouseNumber:     formData.otherHouseNumber     || null,
        preferredAddressType: formData.preferredAddressType,
      });
      setFormData((prev) => ({ ...prev, profileImageUrl: avatarPath }));
      setShowAvatarPicker(false);
      setProfileSuccess('Avatar updated.');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to set avatar.');
    } finally { setSaving(false); }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setChangingPassword(true); setPasswordError(''); setPasswordSuccess('');
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      setChangingPassword(false); return;
    }
    try {
      const response = await changePassword(passwordData);
      setPasswordSuccess(response.message || 'Password updated successfully.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to update password.');
    } finally { setChangingPassword(false); }
  };

  const passwordFields = [
    {
      label:  'Current Password',
      name:   'currentPassword',
      show:   showCurrentPassword,
      toggle: () => setShowCurrentPassword((p) => !p),
    },
    {
      label:  'New Password',
      name:   'newPassword',
      show:   showNewPassword,
      toggle: () => setShowNewPassword((p) => !p),
    },
    {
      label:  'Confirm New Password',
      name:   'confirmNewPassword',
      show:   showConfirmNewPassword,
      toggle: () => setShowConfirmNewPassword((p) => !p),
    },
  ];

  const PAGE_BG = [
    'radial-gradient(circle at 10% 15%, rgba(200,169,107,0.10), transparent 34%)',
    'radial-gradient(circle at 85% 8%,  rgba(14,165,160,0.08),  transparent 30%)',
    'linear-gradient(160deg, var(--surface-bg) 0%, var(--surface-bg-alt) 52%, var(--surface-bg) 100%)',
  ].join(', ');

  return (
    <div className="min-h-screen text-[var(--text-color)] py-10 md:py-16" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-5xl px-4">

        {/* ══════════════════════════════════════════════════════════════
            PAGE HEADER
            ══════════════════════════════════════════════════════════════ */}
        <div className="relative text-center mb-12 reveal-up">
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-56 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(200,169,107,0.09), transparent 70%)' }}
          />
          <div
            className="absolute -top-10 left-[30%] w-48 h-48 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(14,165,160,0.06)' }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, #c8a96b)' }} />
              <p className="uppercase tracking-[0.28em] text-primary text-[0.7rem] font-semibold whitespace-nowrap">
                {isAdmin ? 'Admin Profile' : 'Customer Profile'}
              </p>
              <span className="h-px w-10" style={{ background: 'linear-gradient(90deg, #c8a96b, transparent)' }} />
            </div>
            <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)] mb-3">
              {isAdmin ? 'Manage Your Account' : 'Manage Your Details'}
            </h1>
            <p className="text-[var(--muted-color)] text-base max-w-xl mx-auto">
              {isAdmin
                ? 'Update your name or change your account password.'
                : 'Add saved addresses and choose which one new bookings use by default.'}
            </p>
          </div>
        </div>

        {/* Spectrum divider */}
        <div className="mb-10"><div className="spectrum-line" /></div>

        {/* ══════════════════════════════════════════════════════════════
            PROFILE CARD
            ══════════════════════════════════════════════════════════════ */}
        <div className="glass-card prism-glass p-8 md:p-10 mb-6 reveal-up relative overflow-hidden"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
            e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
          }}>
          <div className="absolute top-0 left-[15%] right-[15%] h-[1.5px]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(200,169,107,0.55),transparent)' }} />
          <div className="prism-ray" style={{ left: '70%', width: '18%', animation: 'prism-ray-sweep 17s ease-in-out 3s infinite' }} />
          {profileError   && <StatusBanner type="error"   message={profileError}   />}
          {profileSuccess && <StatusBanner type="success" message={profileSuccess} />}

          <form onSubmit={handleSubmit} className="space-y-0">

            {/* ── 01 Profile Image ───────────────────────────────────── */}
            <div
              className="pb-8 mb-8 border-b border-[var(--border-color)]"
              style={{ borderColor: 'rgba(200,169,107,0.12)' }}
            >
              <SectionHeading icon={User} step={1}>Profile Image</SectionHeading>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  {/* Avatar preview */}
                  <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                      <img
                        src={
                          toAbsoluteImageUrl(formData.profileImageUrl) ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'
                        }
                        alt="Profile"
                        className="h-20 w-20 rounded-full object-cover"
                        style={{ border: '2px solid rgba(200,169,107,0.35)' }}
                      />
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ boxShadow: '0 0 0 3px rgba(200,169,107,0.12)' }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--heading-color)]">Profile photo</p>
                      <p className="text-xs text-[var(--muted-color)] mt-1">
                        Upload your own or pick an avatar below.
                      </p>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-semibold text-[var(--text-color)] transition hover:border-primary/60 hover:bg-primary/8">
                      <Upload size={14} className="text-primary" />
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileImageUpload}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAvatarPicker((prev) => !prev)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        showAvatarPicker
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-[var(--border-color)] text-[var(--text-color)] hover:border-primary/60 hover:bg-primary/8'
                      }`}
                    >
                      <Images size={14} className={showAvatarPicker ? 'text-primary' : ''} />
                      Choose Avatar
                    </button>
                  </div>
                </div>
                {/* Avatar picker */}
                {showAvatarPicker && (
                  <div
                    className="mt-6 pt-6"
                    style={{ borderTop: '1px solid rgba(200,169,107,0.12)' }}
                  >
                    <AvatarPicker
                      currentUrl={formData.profileImageUrl}
                      onSelect={handleAvatarSelect}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── 02 Basic Information ───────────────────────────────── */}
            <div
              className="pb-8 mb-8 border-b border-[var(--border-color)]"
              style={{ borderColor: 'rgba(200,169,107,0.12)' }}
            >
              <SectionHeading icon={User} step={2}>Basic Information</SectionHeading>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className={inputCls}
                  />
                </div>
                {!isAdmin && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                      <Phone size={12} className="text-primary" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── 03 & 04 — customer only ────────────────────────────── */}
            {!isAdmin && (
              <>
                {/* ── 03 Saved Addresses ─────────────────────────────── */}
                <div
                  className="pb-8 mb-8 border-b border-[var(--border-color)]"
                  style={{ borderColor: 'rgba(200,169,107,0.12)' }}
                >
                  <SectionHeading icon={MapPin} step={3}>Saved Addresses</SectionHeading>
                  <p className="text-xs text-[var(--muted-color)] -mt-2 mb-5">
                    Select a suggestion from the dropdown to ensure addresses work correctly at booking.
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {['Home', 'Work', 'Other'].map((type) => {
                      const style       = addressTypeStyle[type];
                      const addressName = `${type.toLowerCase()}Address`;
                      const houseField  = `${type.toLowerCase()}HouseNumber`;
                      return (
                        <div
                          key={type}
                          className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] p-5"
                        >
                          <div className="flex items-center gap-2.5 mb-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.iconBg}`}>
                              <MapPin size={14} className={style.iconColor} />
                            </div>
                            <span className="text-sm font-bold text-[var(--heading-color)]">{type}</span>
                          </div>
                          <AddressAutocompleteInput
                            label=""
                            value={formData[addressName] || ''}
                            onChange={(value) =>
                              handleChange({ target: { name: addressName, value } })
                            }
                            placeholder={addressPlaceholders[type]}
                          />
                          <input
                            type="text"
                            name={houseField}
                            value={formData[houseField] || ''}
                            onChange={handleChange}
                            placeholder="House / Building Number"
                            className={`${inputCls} mt-3`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── 04 Default Booking Address ─────────────────────── */}
                <div className="pb-8 mb-8">
                  <SectionHeading icon={MapPin} step={4}>Default Booking Address</SectionHeading>
                  <p className="text-xs text-[var(--muted-color)] mb-4 -mt-2">
                    New bookings will pre-fill with whichever address you select here.
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {addressTypes.map((addressType) => {
                      const isActive  = formData.preferredAddressType === addressType;
                      const addrValue =
                        addressType === 'Home'  ? formData.homeAddress  :
                        addressType === 'Work'  ? formData.workAddress  :
                        formData.otherAddress;
                      return (
                        <label
                          key={addressType}
                          className={`cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 relative overflow-hidden ${
                            isActive
                              ? 'border-primary bg-primary/8'
                              : 'border-[var(--border-color)] hover:border-primary/40 hover:bg-white/3'
                          }`}
                        >
                          {isActive && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{ background: 'linear-gradient(135deg, rgba(200,169,107,0.06) 0%, transparent 55%)' }}
                            />
                          )}
                          <input
                            type="radio"
                            name="preferredAddressType"
                            value={addressType}
                            checked={isActive}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <div className="relative flex items-center gap-2 mb-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isActive ? 'border-primary bg-primary' : 'border-[var(--border-color)]'
                            }`}>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--ink)]" />}
                            </div>
                            <p className="text-sm font-bold text-[var(--heading-color)]">{addressType}</p>
                          </div>
                          <p className="text-xs text-[var(--muted-color)] leading-relaxed truncate pl-6">
                            {addrValue || 'No address saved'}
                          </p>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── Save button ────────────────────────────────────────── */}
            <button
              type="submit"
              disabled={saving}
              className="btn-chrome disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* ── Loyalty Points Card ──────────────────────────────────────── */}
        {loyalty && loyalty.isEnabled && (
          <div className="glass-card p-6 mb-6 reveal-up">
            <div className="flex items-center gap-3 mb-5" style={{ borderBottom: '1px solid rgba(200,169,107,0.12)', paddingBottom: '1.25rem' }}>
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Gift size={15} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--heading-color)] tracking-tight">Loyalty Points</h2>
                <p className="text-xs text-[var(--muted-color)] mt-0.5">Earn points on every booking and redeem for discounts.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Balance</p>
                <p className="text-2xl font-black text-primary">{Number(loyalty.balance || 0).toFixed(0)}</p>
                <p className="text-[10px] text-[var(--muted-color)] mt-0.5">pts</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Lifetime Earned</p>
                <p className="text-xl font-bold text-[var(--heading-color)]">{Number(loyalty.lifetimeEarned || 0).toFixed(0)}</p>
                <p className="text-[10px] text-[var(--muted-color)] mt-0.5">pts</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Redeemed</p>
                <p className="text-xl font-bold text-[var(--muted-color)]">{Number(loyalty.lifetimeRedeemed || 0).toFixed(0)}</p>
                <p className="text-[10px] text-[var(--muted-color)] mt-0.5">pts</p>
              </div>
            </div>
            {loyalty.balance >= loyalty.minRedemptionPoints && (
              <p className="text-xs text-green-400 mt-4 text-center">
                You have enough points to redeem! Use your points at checkout for a discount.
              </p>
            )}
            <p className="text-[10px] text-[var(--muted-color)] mt-3 text-center">
              {loyalty.pointsPerQar} pt per QAR spent - {loyalty.redemptionRateQar} QAR per point
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PASSWORD CARD
            ══════════════════════════════════════════════════════════════ */}
        <div className="glass-card prism-glass p-8 md:p-10 reveal-up relative overflow-hidden"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--px', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
            e.currentTarget.style.setProperty('--py', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
          }}>
          <div className="absolute top-0 left-[15%] right-[15%] h-[1.5px]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(14,165,160,0.5),transparent)' }} />
          <div className="prism-ray" style={{ left: '20%', width: '18%', animation: 'prism-ray-sweep 14s ease-in-out 7s infinite' }} />
          {/* Card header */}
          <div
            className="flex items-center gap-3 pb-6 mb-6"
            style={{ borderBottom: '1px solid rgba(200,169,107,0.12)' }}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <KeyRound size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--heading-color)] tracking-tight">
                Change Password
              </h2>
              <p className="text-xs text-[var(--muted-color)] mt-0.5">
                Updates your password without affecting saved profile details.
              </p>
            </div>
            <span
              className="flex-1 h-px ml-1 hidden sm:block"
              style={{ background: 'linear-gradient(90deg, rgba(200,169,107,0.18), transparent)' }}
            />
          </div>

          {passwordError   && <StatusBanner type="error"   message={passwordError}   />}
          {passwordSuccess && <StatusBanner type="success" message={passwordSuccess} />}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              {passwordFields.map(({ label, name, show, toggle }) => (
                <div key={name}>
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-color)] mb-2">
                    {label}
                  </label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      name={name}
                      value={passwordData[name]}
                      onChange={handlePasswordChange}
                      required
                      minLength={name !== 'currentPassword' ? 8 : undefined}
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-primary transition"
                      aria-label={show ? `Hide ${label}` : `Show ${label}`}
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Security note */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted-color)]">
              <Shield size={11} className="text-primary flex-shrink-0" />
              Use at least 8 characters with a mix of letters and numbers.
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="btn-chrome disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <KeyRound size={16} />
              {changingPassword ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default Profile;