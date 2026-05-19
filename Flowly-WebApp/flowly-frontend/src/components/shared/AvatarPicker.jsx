import React from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';
const apiOrigin = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;

const AVATARS = [
  { path: '/assets/avatars/default-gulf-male-1.svg', labelKey: 'common.avatarPicker.labels.gulfMale', descKey: 'common.avatarPicker.desc.kufiyaAgal' },
  { path: '/assets/avatars/default-gulf-male-2.svg', labelKey: 'common.avatarPicker.labels.gulfMale', descKey: 'common.avatarPicker.desc.kufiya' },
  { path: '/assets/avatars/default-gulf-male-3.svg', labelKey: 'common.avatarPicker.labels.gulfMale', descKey: 'common.avatarPicker.desc.kufiyaBeard' },
  { path: '/assets/avatars/default-gulf-female-1.svg', labelKey: 'common.avatarPicker.labels.gulfFemale', descKey: 'common.avatarPicker.desc.blackHijab' },
  { path: '/assets/avatars/default-gulf-female-2.svg', labelKey: 'common.avatarPicker.labels.gulfFemale', descKey: 'common.avatarPicker.desc.tealHijab' },
  { path: '/assets/avatars/default-gulf-female-3.svg', labelKey: 'common.avatarPicker.labels.gulfFemale', descKey: 'common.avatarPicker.desc.burgundyHijab' },
  { path: '/assets/avatars/default-arab-male-1.svg', labelKey: 'common.avatarPicker.labels.arabMale', descKey: 'common.avatarPicker.desc.wavyHair' },
  { path: '/assets/avatars/default-arab-male-2.svg', labelKey: 'common.avatarPicker.labels.arabMale', descKey: 'common.avatarPicker.desc.shortHair' },
  { path: '/assets/avatars/default-arab-female-1.svg', labelKey: 'common.avatarPicker.labels.arabFemale', descKey: 'common.avatarPicker.desc.purpleHijab' },
  { path: '/assets/avatars/default-arab-female-2.svg', labelKey: 'common.avatarPicker.labels.arabFemale', descKey: 'common.avatarPicker.desc.coralHijab' },
  { path: '/assets/avatars/default-expat-male-1.svg', labelKey: 'common.avatarPicker.labels.expatMale', descKey: 'common.avatarPicker.desc.casual' },
  { path: '/assets/avatars/default-expat-female-1.svg', labelKey: 'common.avatarPicker.labels.expatFemale', descKey: 'common.avatarPicker.desc.casual' },
];

function AvatarPicker({ currentUrl, onSelect, disabled }) {
  const { t } = useLanguage();
  const isSelected = (path) =>
    currentUrl === path || (currentUrl && currentUrl.endsWith(path));

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      <p className="mb-1 text-sm font-semibold text-[var(--heading-color)]">{t('common.avatarPicker.title')}</p>
      <p className="mb-4 text-xs text-[var(--muted-color)]">{t('common.avatarPicker.subtitle')}</p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {AVATARS.map((avatar) => {
          const label = t(avatar.labelKey);
          const desc = t(avatar.descKey);
          const selected = isSelected(avatar.path);
          return (
            <button
              key={avatar.path}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(avatar.path)}
              title={`${label} - ${desc}`}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition disabled:opacity-50 ${
                selected
                  ? 'bg-primary/15 ring-2 ring-primary'
                  : 'hover:bg-[var(--cta-soft-bg)] hover:ring-1 hover:ring-primary/40'
              }`}
            >
              <img
                src={`${apiOrigin}${avatar.path}`}
                alt={`${label} - ${desc}`}
                className="h-14 w-14 rounded-full object-cover"
              />
              <span className="text-center text-[10px] leading-tight text-[var(--muted-color)] group-hover:text-[var(--text-color)]">
                {desc}
              </span>
              {selected && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow">
                  <Check size={11} strokeWidth={3}/>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AvatarPicker;
