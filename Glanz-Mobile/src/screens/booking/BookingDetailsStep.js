// ─── BookingDetailsStep.js ────────────────────────────────────────────────────
// Sections 4 (Customer Details) + 5 (Delivery Address) + 6 (Vehicle Details)
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import AddressAutocompleteInput from '../../components/AddressAutocompleteInput';
import { SectionHeader, Card, FieldLabel, s } from './BookingShared';

function BookingDetailsStep({
  canAutofillCustomerData,
  form,
  setForm,
  savedAddresses,
  savedAddress,
  needsManualAddress,
  normalizedPreferredAddressType,
  savedVehicles,
  onLoadSavedAddress,
  navigation,
}) {
  return (
    <>
      {/* ══════════════ 4. CUSTOMER DETAILS ══════════════════════ */}
      <Card>
        <SectionHeader icon="person-outline" step={4}>Customer Details</SectionHeader>
        {canAutofillCustomerData ? (
          <>
            {[
              { label: 'Name',  value: form.customerName  },
              { label: 'Email', value: form.customerEmail },
              { label: 'Phone', value: form.customerPhone },
            ].map(({ label, value }) => (
              <View key={label} style={s.readRow}>
                <Text style={s.readLabel}>{label}</Text>
                <Text style={s.readValue}>{value || '—'}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.editProfileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} />
              <Text style={s.editProfileText}>Edit in Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <FieldLabel>Full Name</FieldLabel>
            <TextInput style={s.input} value={form.customerName}  onChangeText={(v) => setForm((p) => ({ ...p, customerName: v }))}  placeholder="Customer name"  placeholderTextColor={theme.colors.textMuted} />
            <FieldLabel>Email</FieldLabel>
            <TextInput style={s.input} value={form.customerEmail} onChangeText={(v) => setForm((p) => ({ ...p, customerEmail: v }))} placeholder="Email address" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <FieldLabel>Phone</FieldLabel>
            <TextInput style={s.input} value={form.customerPhone} onChangeText={(v) => setForm((p) => ({ ...p, customerPhone: v }))} placeholder="Phone number"  placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" />
          </>
        )}
      </Card>

      {/* ══════════════ 5. DELIVERY ADDRESS ══════════════════════ */}
      <Card>
        <SectionHeader icon="location-outline" step={5}>Delivery Address</SectionHeader>
        {canAutofillCustomerData && savedAddress.address ? (
          <>
            {Object.values(savedAddresses).some(a => a.address) && (
              <View style={s.chipRow}>
                {['Home', 'Work', 'Other'].map((type) => {
                  if (!savedAddresses[type]?.address) return null;
                  const active = form.addressType === type;
                  const icons  = { Home: 'home-outline', Work: 'business-outline', Other: 'location-outline' };
                  return (
                    <TouchableOpacity key={type} style={[s.chip, active && s.chipActive]} onPress={() => onLoadSavedAddress(type)}>
                      <Ionicons name={icons[type]} size={12} color={active ? theme.colors.ink : theme.colors.textMuted} />
                      <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={s.addressDisplay}>
              <Text style={s.addressDisplayText}>
                {form.customerAddress || savedAddress.address}
                {(form.houseNumber || savedAddress.houseNumber) ? ` — ${form.houseNumber || savedAddress.houseNumber}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={s.editProfileBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="pencil-outline" size={13} color={theme.colors.primary} />
              <Text style={s.editProfileText}>Edit addresses in Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!savedAddress.address && canAutofillCustomerData && (
              <Text style={s.helperText}>No default address saved. Add one below or manage in Profile.</Text>
            )}
            {canAutofillCustomerData && Object.values(savedAddresses).some(a => a.address) && (
              <>
                <FieldLabel>Quick Select Saved Address</FieldLabel>
                <View style={s.chipRow}>
                  {['Home', 'Work', 'Other'].map((type) => {
                    const saved  = savedAddresses[type];
                    const active = form.addressType === type && form.customerAddress === saved.address;
                    if (!saved.address) return null;
                    return (
                      <TouchableOpacity key={type} style={[s.chip, active && s.chipActive]} onPress={() => onLoadSavedAddress(type)}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <AddressAutocompleteInput
              label="Area / Street"
              value={form.customerAddress}
              onChangeText={(v) => setForm((p) => ({ ...p, customerAddress: v }))}
              placeholder="Search area or street name"
              helperText="Select your service area or street."
            />
            <FieldLabel>House / Building Number</FieldLabel>
            <TextInput style={s.input} value={form.houseNumber || ''} onChangeText={(v) => setForm((p) => ({ ...p, houseNumber: v }))} placeholder="e.g. 53, Villa 12" placeholderTextColor={theme.colors.textMuted} />
            <FieldLabel>Address Type</FieldLabel>
            <View style={s.chipRow}>
              {['Home', 'Work', 'Other'].map((type) => {
                const active = form.addressType === type;
                return (
                  <TouchableOpacity key={type} style={[s.chip, active && s.chipActive]} onPress={() => setForm((p) => ({ ...p, addressType: type }))}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </Card>

      {/* ══════════════ 6. VEHICLE DETAILS ═══════════════════════ */}
      <Card>
        <SectionHeader icon="speedometer-outline" step={6}>Vehicle Details</SectionHeader>
        {savedVehicles.length > 0 && (
          <>
            <FieldLabel>Saved Vehicles</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {savedVehicles.map((v) => {
                  const isSelected =
                    form.vehicleMake  === (v.make  || '') &&
                    form.vehicleModel === (v.model || '') &&
                    form.vehicleYear  === (v.year  || '') &&
                    form.vehicleType  === (v.vehicleType || 'Sedan');
                  const label = v.nickname || [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[s.savedVehicleChip, isSelected && s.savedVehicleChipActive]}
                      onPress={() => setForm((p) => ({
                        ...p,
                        vehicleType:  v.vehicleType || p.vehicleType,
                        vehicleMake:  v.make        || '',
                        vehicleModel: v.model       || '',
                        vehicleYear:  v.year        || '',
                      }))}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'car' : 'car-outline'}
                        size={14}
                        color={isSelected ? theme.colors.ink : theme.colors.textMuted}
                      />
                      <Text style={[s.savedVehicleChipText, isSelected && s.savedVehicleChipTextActive]} numberOfLines={1}>
                        {label}
                      </Text>
                      {v.isDefault && (
                        <Ionicons name="star" size={10} color={isSelected ? theme.colors.ink : theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}
        <FieldLabel>Make</FieldLabel>
        <TextInput style={s.input} value={form.vehicleMake}  onChangeText={(v) => setForm((p) => ({ ...p, vehicleMake: v }))}  placeholder="e.g. Toyota" placeholderTextColor={theme.colors.textMuted} />
        <FieldLabel>Model</FieldLabel>
        <TextInput style={s.input} value={form.vehicleModel} onChangeText={(v) => setForm((p) => ({ ...p, vehicleModel: v }))} placeholder="e.g. Camry"  placeholderTextColor={theme.colors.textMuted} />
        <FieldLabel>Year</FieldLabel>
        <TextInput style={s.input} value={form.vehicleYear}  onChangeText={(v) => setForm((p) => ({ ...p, vehicleYear: v }))}  placeholder="e.g. 2022"  placeholderTextColor={theme.colors.textMuted} keyboardType="number-pad" />
      </Card>
    </>
  );
}

export default React.memo(BookingDetailsStep);
