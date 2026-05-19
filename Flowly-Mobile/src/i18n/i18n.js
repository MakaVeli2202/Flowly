import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import de from '../locales/de.json';
import ar from '../locales/ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'ar'];
const STORAGE_KEY = '@app/language';

// Synchronous init — translations are bundled, no network needed.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    ar: { translation: ar },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4', // required for RN bundler
});

/**
 * Call once at startup (before rendering any UI).
 * Reads the persisted language from AsyncStorage, then falls back
 * to the device locale, then to English.
 */
export async function initLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      await i18n.changeLanguage(stored);
      return;
    }
    // expo-localization — lazy require so a stale APK (missing native module) doesn't crash at startup
    let deviceLang = 'en';
    try {
      const Localization = require('expo-localization');
      deviceLang = (Localization.getLocales()[0]?.languageCode ?? 'en').split('-')[0];
    } catch { /* native module not compiled into this build — fall back to English */ }
    const lang = SUPPORTED_LANGUAGES.includes(deviceLang) ? deviceLang : 'en';
    await i18n.changeLanguage(lang);
  } catch {
    /* silently stay on English */
  }
}

/** Change language and persist the choice. */
export async function changeLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(STORAGE_KEY, lang);
}

export default i18n;