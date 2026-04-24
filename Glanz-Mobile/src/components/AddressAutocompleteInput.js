import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addressesAPI } from '../api/addresses';
import { theme } from '../theme/theme';

function AddressAutocompleteInput({ label, value, onChangeText, placeholder, helperText }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const suppressNextSearchRef = useRef(false);

  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      setSuggestions([]);
      return undefined;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await addressesAPI.autocomplete(trimmedValue, 8);
        if (!cancelled) {
          setSuggestions(results || []);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [value]);

  return (
    <View>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
      />
      {helperText ? <Text style={s.helper}>{helperText}</Text> : null}
      {loading ? <ActivityIndicator size="small" color={theme.colors.primary} style={s.loader} /> : null}
      {!loading && suggestions.length > 0 ? (
        <View style={s.suggestionsWrap}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={`${suggestion.displayName}-${index}`}
              style={s.suggestionBtn}
              onPress={() => {
                suppressNextSearchRef.current = true;
                onChangeText(suggestion.streetAddress || suggestion.displayName);
                setSuggestions([]);
              }}
            >
              <Text style={s.suggestionText}>{suggestion.displayName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default React.memo(AddressAutocompleteInput);

const s = StyleSheet.create({
  label: { color: theme.colors.mist, marginBottom: 6, fontWeight: '600', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.inputBg,
    color: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  helper: { color: theme.colors.textMuted, marginTop: 6, marginBottom: 4, fontSize: 12 },
  loader: { marginTop: 8 },
  suggestionsWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  suggestionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  suggestionText: { color: theme.colors.text, lineHeight: 22, fontSize: 16, fontWeight: '600' },
});