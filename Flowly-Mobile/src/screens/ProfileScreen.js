// ─── ProfileScreen.js ─────────────────────────────────────────────────────────
import React, { useMemo, useState, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Image, Alert, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n/i18n';
import { applyRTLAndReload } from '../i18n/useRTL';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import { API_BASE_URL } from '../config/api';

/* ── Constants ───────────────────────────────────────────── */
const LANGS = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', flag: '🇦🇪' },
];

const ADDRESS_TYPES = ['Home', 'Work', 'Other'];
const DEFAULT_AVATAR_OPTIONS = [
  '/assets/avatars/default-gulf-male-1.svg',
  '/assets/avatars/default-gulf-male-2.svg',
  '/assets/avatars/default-gulf-female-1.svg',
  '/assets/avatars/default-gulf-female-2.svg',
  '/assets/avatars/default-expat-male-1.svg',
  '/assets/avatars/default-expat-female-1.svg',
];
const ADDRESS_CONFIG = [
  { key: 'homeAddress',  houseKey: 'homeHouseNumber',  type: 'Home',  icon: 'home-outline',      placeholder: 'Search your home area',  iconBg: 'rgba(59,130,246,0.12)',  iconColor: '#60A5FA' },
  { key: 'workAddress',  houseKey: 'workHouseNumber',  type: 'Work',  icon: 'briefcase-outline', placeholder: 'Search your work area',  iconBg: 'rgba(139,92,246,0.12)', iconColor: '#A78BFA' },
  { key: 'otherAddress', houseKey: 'otherHouseNumber', type: 'Other', icon: 'location-outline',  placeholder: 'Search another address', iconBg: 'rgba(245,158,11,0.12)', iconColor: '#FBBF24' },
];
const PADDING = 20;

/* ── Palette ─────────────────────────────────────────────── */
const G = (a) => `rgba(200,169,107,${a})`;
const T = (a) => `rgba(14,165,160,${a})`;

/* ── Prism plain styles ──────────────────────────────────── */
const prismStyles = {
  topLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 2 },
  leftBar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, zIndex: 2 },
};

/* ── Visual primitives ──────────────────────────────────── */
const SpectrumLine = ({ style }) => (
  <LinearGradient
    colors={['transparent', G(0.75), T(0.70), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={[{ height: 1.5, borderRadius: 1 }, style]}
  />
);

const PrismTopLine = () => (
  <LinearGradient
    colors={['transparent', G(0.82), T(0.65), 'transparent']}
    locations={[0, 0.38, 0.62, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    style={prismStyles.topLine}
    pointerEvents="none"
  />
);

const PrismLeftBar = () => (
  <LinearGradient
    colors={[G(0.90), T(0.55), 'transparent']}
    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    style={prismStyles.leftBar}
    pointerEvents="none"
  />
);

/* ── SectionHeader ──────────────────────────────────────── */
/*
  sectionDivider is now a LinearGradient (transparent → gold)
  instead of the original flat backgroundColor line.
*/
const SectionHeader = ({ children, icon, step, style }) => (
  <View style={[h.sectionHeaderRow, style]}>
    {step !== undefined && (
      <Text style={h.sectionStep}>{String(step).padStart(2, '0')}</Text>
    )}
    {!!icon && <Ionicons name={icon} size={15} color={theme.colors.primary} />}
    <Text style={h.sectionTitle}>{children}</Text>
    <LinearGradient
      colors={['transparent', G(0.55)]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={h.sectionDivider}
    />
  </View>
);

/* ── FieldInput — focus-aware, gold border on focus ────────── */
function FieldInput({
  label, disabled, containerStyle, style,
  onFocus: onFocusProp, onBlur: onBlurProp,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[h.fieldWrap, containerStyle]}>
      {!!label && <Text style={h.fieldLabel}>{label}</Text>}
      <TextInput
        style={[h.input, focused && h.inputFocused, disabled && h.inputDisabled, style]}
        editable={!disabled}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={(e) => { setFocused(true); onFocusProp?.(e); }}
        onBlur={(e)  => { setFocused(false); onBlurProp?.(e); }}
        {...props}
      />
    </View>
  );
}

/* ── StatusBanner ────────────────────────────────────────── */
const StatusBanner = ({ type, message }) => {
  const isError = type === 'error';
  return (
    <View style={isError ? h.errorBanner : h.successBanner}>
      <View style={isError ? h.errorIconBox : h.successIconBox}>
        <Ionicons
          name={isError ? 'alert-circle-outline' : 'checkmark-circle-outline'}
          size={15}
          color={isError ? '#FCA5A5' : '#A7F3D0'}
        />
      </View>
      <Text style={isError ? h.errorText : h.successText}>{message}</Text>
    </View>
  );
};

/* ── GradientBtn — replaces the three primaryBtn instances ── */
/*
  overflow:'hidden' on primaryBtnWrap clips the gradient fill
  to the button's borderRadius. Opacity disabled state applied
  to the wrapper so the gradient dims together with the text.
*/
function GradientBtn({ onPress, disabled, loading, icon, label, style }) {
  return (
    <View style={[s.primaryBtnWrap, (disabled || loading) && s.btnDisabled, style]}>
      <LinearGradient
        colors={[theme.colors.primary, G(0.82)]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <TouchableOpacity
        style={s.primaryBtnTouch}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={theme.colors.ink} size="small" />
          : (
            <>
              {!!icon && <Ionicons name={icon} size={17} color={theme.colors.ink} />}
              <Text style={s.primaryBtnText}>{label}</Text>
            </>
          )}
      </TouchableOpacity>
    </View>
  );
}

/* ── PasswordField — replaces renderPasswordField ─────────── */
/*
  Converted from inline render function to a proper component.
  Tracks focus independently to apply the gold border.
*/
function PasswordField({ label, value, onChange, placeholder, visible, setVisible, isCurrent = false }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={h.fieldWrap}>
      <Text style={h.fieldLabel}>{label}</Text>
      <View style={[s.passwordWrap, focused && s.passwordWrapFocused]}>
        <TextInput
          style={s.passwordInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!visible}
          autoComplete={isCurrent ? 'off' : 'new-password'}
          textContentType={isCurrent ? 'none' : 'newPassword'}
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity
          onPress={() => setVisible((p) => !p)}
          style={s.eyeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════ */
export default function ProfileScreen() {
  const { i18n } = useTranslation();
  const { user, updateProfile, uploadProfileImage, changePassword, logout } = useAuth();
  const isWorker = user?.role === 'Employee';
  const TABS = [
    { id: 'profile',  label: 'Profile',  icon: 'person-outline'     },
    { id: 'security', label: 'Security', icon: 'lock-closed-outline' },
    ...(isWorker ? [{ id: 'timeoff', label: 'Time Off', icon: 'calendar-outline' }] : []),
  ];

  const scrollRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const switchTab = (tabId) => {
    setActiveTab(tabId);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  /* ── State ───────────────────────────────────────────── */
  const [savingProfile,   setSavingProfile]   = useState(false);
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [profileError,    setProfileError]    = useState('');
  const [profileSuccess,  setProfileSuccess]  = useState('');
  const [passwordError,   setPasswordError]   = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [profileForm, setProfileForm] = useState(() => ({
    firstName:            user?.firstName            || '',
    lastName:             user?.lastName             || '',
    phone:                user?.phone                || '',
    profileImageUrl:      user?.profileImageUrl      || '',
    homeAddress:          user?.homeAddress          || '',
    homeHouseNumber:      user?.homeHouseNumber      || '',
    workAddress:          user?.workAddress          || '',
    workHouseNumber:      user?.workHouseNumber      || '',
    otherAddress:         user?.otherAddress         || '',
    otherHouseNumber:     user?.otherHouseNumber     || '',
    preferredAddressType: user?.preferredAddressType || 'Home',
  }));
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '', confirmNewPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword,     setShowNewPassword]     = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [langSwitching, setLangSwitching] = useState(false);

  const handleLangSwitch = async (code) => {
    if (code === i18n.language || langSwitching) return;
    setLangSwitching(true);
    try {
      await changeLanguage(code);
      await applyRTLAndReload(code);
    } catch { /* silent */ } finally {
      setLangSwitching(false);
    }
  };

  const [requestType,      setRequestType]      = useState('Free Time');
  const [requestStartDate, setRequestStartDate] = useState('');
  const [requestEndDate,   setRequestEndDate]   = useState('');
  const [requestReason,    setRequestReason]    = useState('');
  const [requestStatus,    setRequestStatus]    = useState('');

  const currentDefaultAddress = useMemo(() => {
    if (profileForm.preferredAddressType === 'Work')  return profileForm.workAddress;
    if (profileForm.preferredAddressType === 'Other') return profileForm.otherAddress;
    return profileForm.homeAddress;
  }, [profileForm]);

  /* ── Handlers — logic unchanged ──────────────────────── */
  const saveProfile = async () => {
    try {
      setSavingProfile(true); setProfileError(''); setProfileSuccess('');
      await updateProfile({
        firstName:            profileForm.firstName.trim(),
        lastName:             profileForm.lastName.trim(),
        phone:                profileForm.phone.trim(),
        profileImageUrl:      profileForm.profileImageUrl.trim() || null,
        homeAddress:          profileForm.homeAddress.trim()          || null,
        homeHouseNumber:      profileForm.homeHouseNumber?.trim()     || null,
        workAddress:          profileForm.workAddress.trim()          || null,
        workHouseNumber:      profileForm.workHouseNumber?.trim()     || null,
        otherAddress:         profileForm.otherAddress.trim()         || null,
        otherHouseNumber:     profileForm.otherHouseNumber?.trim()    || null,
        preferredAddressType: profileForm.preferredAddressType,
      });
      setProfileSuccess('Profile updated. Future bookings will use your saved default address when available.');
    } catch (err) {
      setProfileError(err?.response?.data?.message || 'Failed to update profile.');
    } finally { setSavingProfile(false); }
  };

  const resolveImageUrl = (value) => {
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    const apiOrigin = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
    return `${apiOrigin}${value.startsWith('/') ? value : `/${value}`}`;
  };

  const selectProfileImage = async () => {
    try {
      setSavingProfile(true); setProfileError(''); setProfileSuccess('');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setProfileError('Photo permission is required to upload a profile image.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const formData = new FormData();
      if (asset.file) {
        formData.append('image', asset.file);
      } else {
        formData.append('image', { uri: asset.uri, name: asset.fileName || `profile-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' });
      }
      const updatedUser = await uploadProfileImage(formData);
      setProfileForm((p) => ({ ...p, profileImageUrl: updatedUser.profileImageUrl || p.profileImageUrl }));
      setProfileSuccess('Profile image updated.');
    } catch (err) {
      setProfileError(err?.response?.data?.message || 'Failed to upload profile image.');
    } finally { setSavingProfile(false); }
  };

  const applyPresetAvatar = async (avatarUrl) => {
    try {
      setSavingProfile(true); setProfileError(''); setProfileSuccess('');
      const updatedUser = await updateProfile({
        firstName:            (user?.firstName || profileForm.firstName || '').trim(),
        lastName:             (user?.lastName  || profileForm.lastName  || '').trim(),
        phone:                (user?.phone     || profileForm.phone     || '').trim(),
        profileImageUrl:      avatarUrl,
        homeAddress:          profileForm.homeAddress?.trim()          || null,
        homeHouseNumber:      profileForm.homeHouseNumber?.trim()      || null,
        workAddress:          profileForm.workAddress?.trim()          || null,
        workHouseNumber:      profileForm.workHouseNumber?.trim()      || null,
        otherAddress:         profileForm.otherAddress?.trim()         || null,
        otherHouseNumber:     profileForm.otherHouseNumber?.trim()     || null,
        preferredAddressType: profileForm.preferredAddressType,
      });
      setProfileForm((p) => ({ ...p, profileImageUrl: updatedUser.profileImageUrl || avatarUrl }));
      setProfileSuccess('Avatar updated.');
    } catch (err) {
      setProfileError(err?.response?.data?.message || 'Failed to update avatar.');
    } finally { setSavingProfile(false); }
  };

  const updatePassword = async () => {
    try {
      setSavingPassword(true); setPasswordError(''); setPasswordSuccess('');
      await changePassword(passwordForm);
      setPasswordSuccess('Password updated successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      setPasswordError(err?.response?.data?.message || 'Failed to update password.');
    } finally { setSavingPassword(false); }
  };

  const submitTimeOffRequest = async () => {
    if (!requestStartDate.trim() || !requestEndDate.trim() || !requestReason.trim()) {
      setRequestStatus('Please fill start date, end date, and reason.');
      return;
    }
    const body = [
      `Worker: ${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      `Email: ${user?.email || 'N/A'}`,
      `Type: ${requestType}`,
      `Start: ${requestStartDate.trim()}`,
      `End: ${requestEndDate.trim()}`,
      `Reason: ${requestReason.trim()}`,
    ].join('\n');
    const mailto = `mailto:dispatch@flowly.app?subject=${encodeURIComponent(`${requestType} Request - ${user?.firstName || 'Worker'}`)}&body=${encodeURIComponent(body)}`;
    try {
      if (await Linking.canOpenURL(mailto)) {
        await Linking.openURL(mailto);
        setRequestStatus('Request draft opened. Please send it to dispatch.');
        return;
      }
    } catch {}
    Alert.alert('Request Ready', body);
    setRequestStatus('Email app not available. Request details shown in alert.');
  };

  /* ── Derived ──────────────────────────────────────────── */
  const resolvedAvatarUrl =
    resolveImageUrl(profileForm.profileImageUrl) || resolveImageUrl(DEFAULT_AVATAR_OPTIONS[0]);
  const fullName = `${profileForm.firstName} ${profileForm.lastName}`.trim();

  /* ── Render ───────────────────────────────────────────── */
  return (
    <View style={s.screen}>

      {/* ── Hero ───────────────────────────────────────── */}
      {/*
        LinearGradient body tint sits behind all hero content.
        overflow:'hidden' clips it to the hero bounds — the camBadge
        is positioned relative to avatarTouchable (its direct parent),
        which is well within hero bounds, so nothing gets clipped.
      */}
      <View style={s.hero}>
        <LinearGradient
          colors={[G(0.07), 'transparent', T(0.04)]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Avatar — gradient ring replaces flat borderColor */}
        <TouchableOpacity
          style={s.avatarTouchable}
          onPress={selectProfileImage}
          disabled={savingProfile}
        >
          <LinearGradient
            colors={[G(0.90), T(0.60)]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.avatarRingOuter}
          >
            <View style={s.avatarRingInner}>
              <Image source={{ uri: resolvedAvatarUrl }} style={s.heroAvatar} />
            </View>
          </LinearGradient>
          <View style={s.camBadge}>
            {savingProfile
              ? <ActivityIndicator size={10} color={theme.colors.ink} />
              : <Ionicons name="camera" size={13} color={theme.colors.ink} />}
          </View>
        </TouchableOpacity>

        <Text style={s.heroName}>{fullName || 'Your Name'}</Text>
        <View style={s.rolePill}>
          <Ionicons
            name={isWorker ? 'construct-outline' : 'home-outline'}
            size={11}
            color={theme.colors.primary}
          />
          <Text style={s.roleText}>{isWorker ? 'Employee' : 'Customer'}</Text>
        </View>
        <Text style={s.heroEmail}>{user?.email || ''}</Text>
        {/* SpectrumLine replaces the flat borderBottomColor on hero */}
        <SpectrumLine style={{ alignSelf: 'stretch', marginTop: 20 }} />
      </View>

      {/* ── Tab bar ────────────────────────────────────── */}
      <View style={s.tabBarWrap}>
        <View style={s.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[s.tab, active && s.tabActive]}
                onPress={() => switchTab(tab.id)}
              >
                {active && (
                  <LinearGradient
                    colors={[theme.colors.primary, G(0.82)]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                )}
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={active ? theme.colors.ink : theme.colors.textMuted}
                />
                <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Scrollable content ─────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
      >

        {/* ══════════ PROFILE TAB ══════════════════════ */}
        {activeTab === 'profile' && (
          <>
            {!!profileError   && <StatusBanner type="error"   message={profileError}   />}
            {!!profileSuccess && <StatusBanner type="success" message={profileSuccess} />}

            {/* ── Avatar card ──────────────────────────── */}
            <View style={s.card}>
              <PrismTopLine />
              <PrismLeftBar />
              <LinearGradient
                colors={[G(0.05), 'transparent', T(0.03)]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <SectionHeader icon="images-outline" step={1}>Choose Avatar</SectionHeader>
              <View style={s.avatarGrid}>
                {DEFAULT_AVATAR_OPTIONS.map((url) => {
                  const selected = profileForm.profileImageUrl === url;
                  return (
                    <TouchableOpacity
                      key={url}
                      style={[s.avatarOption, selected && s.avatarOptionActive]}
                      onPress={() => applyPresetAvatar(url)}
                      disabled={savingProfile}
                    >
                      <Image source={{ uri: resolveImageUrl(url) }} style={s.avatarOptionImg} />
                      {selected && (
                        <View style={s.avatarCheck}>
                          <Ionicons name="checkmark" size={11} color={theme.colors.ink} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={s.uploadRow}
                onPress={selectProfileImage}
                disabled={savingProfile}
              >
                <View style={s.uploadIconBox}>
                  <Ionicons name="cloud-upload-outline" size={15} color={theme.colors.primary} />
                </View>
                <Text style={s.uploadText}>
                  {savingProfile ? 'Uploading…' : 'Upload a custom photo'}
                </Text>
              </TouchableOpacity>
            </View>

            {!isWorker && (
              <>
                {/* ── Personal info ───────────────────── */}
                <View style={s.card}>
                  <PrismTopLine />
                  <PrismLeftBar />
                  <LinearGradient
                    colors={[G(0.05), 'transparent', T(0.03)]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <SectionHeader icon="person-outline" step={2}>Personal Information</SectionHeader>
                  <View style={s.row}>
                    <FieldInput
                      label="First Name"
                      value={profileForm.firstName}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, firstName: v }))}
                      placeholder="First name"
                      containerStyle={{ flex: 1 }}
                    />
                    <FieldInput
                      label="Last Name"
                      value={profileForm.lastName}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, lastName: v }))}
                      placeholder="Last name"
                      containerStyle={{ flex: 1 }}
                    />
                  </View>
                  <FieldInput
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    placeholder="Email"
                  />
                  <FieldInput
                    label="Phone"
                    value={profileForm.phone}
                    onChangeText={(v) => setProfileForm((p) => ({ ...p, phone: v }))}
                    placeholder="+974 3300 0000"
                    keyboardType="phone-pad"
                  />
                </View>

                {/* ── Saved addresses ─────────────────── */}
                <View style={s.card}>
                  <PrismTopLine />
                  <PrismLeftBar />
                  <LinearGradient
                    colors={[G(0.05), 'transparent', T(0.03)]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <SectionHeader icon="location-outline" step={3}>Saved Addresses</SectionHeader>
                  <Text style={s.addressHelperText}>
                    Select a suggestion from the dropdown to ensure addresses work correctly at booking.
                  </Text>
                  {ADDRESS_CONFIG.map(({ key, houseKey, type, icon, placeholder, iconBg, iconColor }, idx) => (
                    <View
                      key={key}
                      style={[s.addressBlock, idx < ADDRESS_CONFIG.length - 1 && s.addressBlockBorder]}
                    >
                      <View style={[s.addrIconCircle, { backgroundColor: iconBg }]}>
                        <Ionicons name={icon} size={15} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.addrTypeLabel}>{type}</Text>
                        <AddressAutocompleteInput
                          label=""
                          value={profileForm[key]}
                          onChangeText={(v) => setProfileForm((p) => ({ ...p, [key]: v }))}
                          placeholder={placeholder}
                        />
                        <TextInput
                          style={[h.input, { marginTop: 8 }]}
                          value={profileForm[houseKey] || ''}
                          onChangeText={(v) => setProfileForm((p) => ({ ...p, [houseKey]: v }))}
                          placeholder="House / Building Number"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                      </View>
                    </View>
                  ))}
                </View>

                {/* ── Default address ─────────────────── */}
                <View style={s.card}>
                  <PrismTopLine />
                  <PrismLeftBar />
                  <LinearGradient
                    colors={[G(0.05), 'transparent', T(0.03)]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
                  <SectionHeader icon="navigate-outline" step={4}>Default Booking Address</SectionHeader>
                  <Text style={s.addressHelperText}>
                    New bookings will pre-fill with whichever address you select here.
                  </Text>
                  <View style={s.chipRow}>
                    {ADDRESS_TYPES.map((type) => {
                      const active = profileForm.preferredAddressType === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[s.chip, active && s.chipActive]}
                          onPress={() => setProfileForm((p) => ({ ...p, preferredAddressType: type }))}
                        >
                          {active && (
                            <Ionicons name="checkmark-circle" size={13} color={theme.colors.ink} />
                          )}
                          <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={s.previewBox}>
                    <View style={s.previewBoxRow}>
                      <Ionicons name="navigate" size={13} color={theme.colors.primary} />
                      <Text style={s.previewBoxLabel}>Active Default</Text>
                    </View>
                    <Text style={s.previewBoxValue}>
                      {currentDefaultAddress || 'No address set for this type yet.'}
                    </Text>
                  </View>
                  <GradientBtn
                    onPress={saveProfile}
                    loading={savingProfile}
                    icon="checkmark-done"
                    label="Save Profile"
                    style={{ marginTop: 8 }}
                  />
                </View>
              </>
            )}
          </>
        )}

        {/* ══════════ SECURITY TAB ══════════════════════ */}
        {activeTab === 'security' && (
          <View style={s.card}>
            <PrismTopLine />
            <PrismLeftBar />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {!!passwordError   && <StatusBanner type="error"   message={passwordError}   />}
            {!!passwordSuccess && <StatusBanner type="success" message={passwordSuccess} />}
            <SectionHeader icon="lock-closed-outline" step={1}>Change Password</SectionHeader>
            <Text style={s.addressHelperText}>
              Use at least 8 characters with a mix of letters and numbers.
            </Text>
            <PasswordField
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(v) => setPasswordForm((p) => ({ ...p, currentPassword: v }))}
              placeholder="Enter current password"
              visible={showCurrentPassword}
              setVisible={setShowCurrentPassword}
              isCurrent
            />
            <PasswordField
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(v) => setPasswordForm((p) => ({ ...p, newPassword: v }))}
              placeholder="Enter new password"
              visible={showNewPassword}
              setVisible={setShowNewPassword}
            />
            <PasswordField
              label="Confirm New Password"
              value={passwordForm.confirmNewPassword}
              onChange={(v) => setPasswordForm((p) => ({ ...p, confirmNewPassword: v }))}
              placeholder="Re-enter new password"
              visible={showConfirmPassword}
              setVisible={setShowConfirmPassword}
            />
            <GradientBtn
              onPress={updatePassword}
              loading={savingPassword}
              icon="key"
              label="Update Password"
              style={{ marginTop: 8 }}
            />
          </View>
        )}

        {/* ══════════ TIME OFF TAB (workers only) ═══════ */}
        {activeTab === 'timeoff' && isWorker && (
          <View style={s.card}>
            <PrismTopLine />
            <PrismLeftBar />
            <LinearGradient
              colors={[G(0.05), 'transparent', T(0.03)]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {!!requestStatus && <StatusBanner type="success" message={requestStatus} />}
            <SectionHeader icon="calendar-outline" step={1}>Request Type</SectionHeader>
            <View style={s.chipRow}>
              {['Free Time', 'Vacation'].map((type) => {
                const active = requestType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setRequestType(type)}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <SectionHeader icon="calendar-number-outline" step={2} style={{ marginTop: 8 }}>Dates</SectionHeader>
            <View style={s.row}>
              <FieldInput
                label="Start Date"
                value={requestStartDate}
                onChangeText={setRequestStartDate}
                placeholder="YYYY-MM-DD"
                containerStyle={{ flex: 1 }}
              />
              <FieldInput
                label="End Date"
                value={requestEndDate}
                onChangeText={setRequestEndDate}
                placeholder="YYYY-MM-DD"
                containerStyle={{ flex: 1 }}
              />
            </View>
            <FieldInput
              label="Reason"
              value={requestReason}
              onChangeText={setRequestReason}
              placeholder="Briefly describe your reason…"
              multiline
              style={s.reasonInput}
            />
            <GradientBtn
              onPress={submitTimeOffRequest}
              icon="send"
              label="Submit Request"
              style={{ marginTop: 8 }}
            />
          </View>
        )}

        {/* ── Language ────────────────────────────────── */}
        <View style={s.card}>
          <PrismTopLine />
          <PrismLeftBar />
          <LinearGradient
            colors={[G(0.05), 'transparent', T(0.03)]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <SectionHeader icon="language-outline">
            Language
            {langSwitching && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 8 }} />
            )}
          </SectionHeader>
          <View style={s.chipRow}>
            {LANGS.map(({ code, label, flag }) => {
              const active = i18n.language === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => handleLangSwitch(code)}
                  disabled={langSwitching}
                  activeOpacity={0.75}
                >
                  {active && (
                    <Ionicons name="checkmark-circle" size={13} color={theme.colors.ink} />
                  )}
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {flag}{'  '}{label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Sign out ────────────────────────────────── */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={17} color="#FCA5A5" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ── Shared helper styles ────────────────────────────────── */
const h = StyleSheet.create({
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionStep:      { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, opacity: 0.5 },
  sectionTitle:     { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  /* flex: 1 + marginLeft gives the gradient room to fill the row remainder */
  sectionDivider:   { flex: 1, height: 1, marginLeft: 4, borderRadius: 1 },
  fieldWrap:        { marginBottom: 12 },
  fieldLabel:       { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', marginBottom: 6, letterSpacing: 1.2, textTransform: 'uppercase' },
  input:            { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, color: theme.colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  inputFocused:     { borderColor: G(0.65) },
  inputDisabled:    { opacity: 0.45 },
  errorBanner:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(28,10,10,0.9)', borderWidth: 1, borderColor: 'rgba(127,29,29,0.4)', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorIconBox:     { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  errorText:        { color: '#FCA5A5', flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  successBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(6,78,59,0.5)', borderWidth: 1, borderColor: 'rgba(4,120,87,0.4)', borderRadius: 12, padding: 12, marginBottom: 14 },
  successIconBox:   { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  successText:      { color: '#A7F3D0', flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
});

/* ── Screen styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  /* Hero — borderBottomColor removed; SpectrumLine handles separation */
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: PADDING, overflow: 'hidden' },

  /* Avatar gradient ring */
  avatarTouchable: { position: 'relative', marginBottom: 12 },
  avatarRingOuter: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  avatarRingInner: { width: 98,  height: 98,  borderRadius: 49, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  heroAvatar:      { width: 92,  height: 92,  borderRadius: 46 },
  camBadge: {
    position: 'absolute', bottom: 3, right: 3,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: theme.colors.bg,
  },
  heroName:  { color: theme.colors.text, fontSize: 21, fontWeight: '800', marginBottom: 6 },
  rolePill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(200,169,107,0.35)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(200,169,107,0.08)', marginBottom: 5 },
  roleText:  { color: theme.colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  heroEmail: { color: theme.colors.textMuted, fontSize: 13 },

  /* Tab bar */
  tabBarWrap: { paddingHorizontal: PADDING, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tabBar:     { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4 },
  /*
    overflow:'hidden' on tab clips the absoluteFillObject gradient
    to the tab's own borderRadius when active.
  */
  tab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11, overflow: 'hidden' },
  tabActive:     {},   /* visual handled by the absoluteFillObject gradient */
  tabText:       { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: theme.colors.ink },

  /* Scroll */
  scroll:        { flex: 1, backgroundColor: theme.colors.bg },
  scrollContent: { padding: PADDING, paddingBottom: 48, flexGrow: 1, backgroundColor: theme.colors.bg },

  /* Cards — overflow:'hidden' required for prism elements */
  card: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 18, backgroundColor: 'rgba(19,27,37,0.8)', padding: 18, marginBottom: 14, overflow: 'hidden' },

  /* Avatar grid */
  avatarGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  avatarOption:       { position: 'relative', borderWidth: 2, borderColor: theme.colors.border, borderRadius: 40, padding: 3 },
  avatarOptionActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(200,169,107,0.1)' },
  avatarOptionImg:    { width: 52, height: 52, borderRadius: 26 },
  avatarCheck:        { position: 'absolute', bottom: 1, right: 1, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.bg },

  /* Upload row */
  uploadRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadIconBox:{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(200,169,107,0.1)', borderWidth: 1, borderColor: 'rgba(200,169,107,0.2)', alignItems: 'center', justifyContent: 'center' },
  uploadText:   { color: theme.colors.primary, fontSize: 13, fontWeight: '600' },

  /* Row layout */
  row: { flexDirection: 'row', gap: 10 },

  /* Password wrapper — focus border applied via passwordWrapFocused */
  passwordWrap:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.inputBg, paddingHorizontal: 14, overflow: 'hidden' },
  passwordWrapFocused: { borderColor: G(0.65) },
  passwordInput:       { flex: 1, color: theme.colors.text, paddingVertical: 12, backgroundColor: 'transparent', fontSize: 14 },
  eyeBtn:              { padding: 4 },

  /* Address helpers */
  addressHelperText: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 14, marginTop: -6 },
  addressBlock:      { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  addressBlockBorder:{ borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  addrIconCircle:    { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 },
  addrTypeLabel:     { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },

  /* Chips */
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: 'rgba(200,169,107,0.06)' },
  chipActive:     { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  chipText:       { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: theme.colors.ink },

  /* Default address preview */
  previewBox:      { borderWidth: 1, borderColor: 'rgba(200,169,107,0.22)', borderRadius: 12, backgroundColor: 'rgba(200,169,107,0.05)', padding: 14, marginBottom: 6 },
  previewBoxRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  previewBoxLabel: { color: theme.colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewBoxValue: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },

  /* Misc */
  reasonInput: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },

  /* GradientBtn */
  primaryBtnWrap:  { borderRadius: 12, overflow: 'hidden' },
  primaryBtnTouch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  primaryBtnText:  { color: theme.colors.ink, fontWeight: '800', fontSize: 15 },
  btnDisabled:     { opacity: 0.55 },

  /* Logout */
  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(127,29,29,0.5)', backgroundColor: 'rgba(31,10,10,0.45)', borderRadius: 12, paddingVertical: 13 },
  logoutText: { color: '#FCA5A5', fontWeight: '700', fontSize: 14 },
});