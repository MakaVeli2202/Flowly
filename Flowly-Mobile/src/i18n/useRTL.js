import { I18nManager, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Returns RTL state and style helpers.
 * Safe on both web and native.
 */
export function useRTL() {
  const { i18n } = useTranslation();
  const isRTL = RTL_LANGS.has(i18n.language);
  return {
    isRTL,
    rowDir:    isRTL ? 'row-reverse'   : 'row',
    textAlign: isRTL ? 'right'         : 'left',
    backIcon:  isRTL ? 'arrow-forward' : 'arrow-back',
    nextIcon:  isRTL ? 'chevron-back'  : 'chevron-forward',
  };
}

/**
 * Applies RTL direction after a language change.
 *
 * Web   → instant, no reload needed (sets document.dir)
 * Native → sets the I18nManager flag; layout flip needs an app restart.
 *          expo-updates removed — caused web bundler crash and doesn't
 *          work in Expo Go anyway.
 */
export function applyRTLAndReload(lang) {
  const shouldBeRTL = RTL_LANGS.has(lang);

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir  = shouldBeRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return;
  }

  // Native — text direction changes immediately.
  // Full layout flip (flex direction etc.) needs an app restart.
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }
}