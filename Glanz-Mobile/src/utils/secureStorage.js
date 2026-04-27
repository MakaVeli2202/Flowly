/**
 * Secure token storage.
 *
 * Tokens (JWT access token, refresh token) are stored in the platform keychain
 * via expo-secure-store so they are encrypted at rest and inaccessible to other
 * apps. expo-secure-store is limited to ~2KB per value — sufficient for JWTs
 * and 64-byte refresh tokens but NOT suitable for large JSON blobs (use
 * AsyncStorage for user profile data).
 *
 * Keys stored here: 'token', 'refreshToken'
 * Keys that remain in AsyncStorage: 'user'
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SECURE_KEYS = new Set(['token', 'refreshToken']);

// expo-secure-store is native-only (iOS/Android keychain).
// On web we fall back to AsyncStorage (sessionStorage-backed by Expo).
const canUseSecureStore = Platform.OS !== 'web';

export async function secureGet(key) {
  if (SECURE_KEYS.has(key) && canUseSecureStore) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

export async function secureSet(key, value) {
  if (SECURE_KEYS.has(key) && canUseSecureStore) {
    return SecureStore.setItemAsync(key, value);
  }
  return AsyncStorage.setItem(key, value);
}

export async function secureDelete(key) {
  if (SECURE_KEYS.has(key) && canUseSecureStore) {
    return SecureStore.deleteItemAsync(key);
  }
  return AsyncStorage.removeItem(key);
}

export async function secureMultiRemove(keys) {
  await Promise.all(keys.map(secureDelete));
}
