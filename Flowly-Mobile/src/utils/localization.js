export const normalizeLangCode = (lang) => (lang || 'en').toLowerCase().split('-')[0];

export const pickLocalizedField = (item, baseKey, lang) => {
  if (!item || typeof item !== 'object') return '';

  const langCode = normalizeLangCode(lang);
  const suffix = langCode.charAt(0).toUpperCase() + langCode.slice(1);

  const candidates = [
    `${baseKey}${suffix}`,
    `${baseKey}_${langCode}`,
    `${baseKey}${langCode.toUpperCase()}`,
    `${baseKey}Localized`,
  ];

  for (const key of candidates) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const raw = item[baseKey];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw[langCode] ?? raw.en;
    if (typeof value === 'string' && value.trim()) return value;
  }

  const translations = item.translations || item.translation || item.localizations;
  if (Array.isArray(translations)) {
    const row = translations.find((t) => normalizeLangCode(t?.language || t?.lang || t?.code) === langCode)
      || translations.find((t) => normalizeLangCode(t?.language || t?.lang || t?.code) === 'en');

    if (row) {
      const fromRow = row[baseKey] || row[baseKey.toLowerCase()] || row.value || row.text;
      if (typeof fromRow === 'string' && fromRow.trim()) return fromRow;
    }
  }

  return typeof raw === 'string' ? raw : '';
};
