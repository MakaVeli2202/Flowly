import React from 'react';
import { Check } from 'lucide-react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';
const apiOrigin = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;

const AVATARS = [
  { path: '/assets/avatars/default-gulf-male-1.svg', label: 'Gulf Male', desc: 'Kufiya & agal' },
  { path: '/assets/avatars/default-gulf-male-2.svg', label: 'Gulf Male', desc: 'Kufiya' },
  { path: '/assets/avatars/default-gulf-male-3.svg', label: 'Gulf Male', desc: 'Kufiya & beard' },
  { path: '/assets/avatars/default-gulf-female-1.svg', label: 'Gulf Female', desc: 'Black hijab' },
  { path: '/assets/avatars/default-gulf-female-2.svg', label: 'Gulf Female', desc: 'Teal hijab' },
  { path: '/assets/avatars/default-gulf-female-3.svg', label: 'Gulf Female', desc: 'Burgundy hijab' },
  { path: '/assets/avatars/default-arab-male-1.svg', label: 'Arab Male', desc: 'Wavy hair' },
  { path: '/assets/avatars/default-arab-male-2.svg', label: 'Arab Male', desc: 'Short hair' },
  { path: '/assets/avatars/default-arab-female-1.svg', label: 'Arab Female', desc: 'Purple hijab' },
  { path: '/assets/avatars/default-arab-female-2.svg', label: 'Arab Female', desc: 'Coral hijab' },
  { path: '/assets/avatars/default-expat-male-1.svg', label: 'Expat Male', desc: 'Casual' },
  { path: '/assets/avatars/default-expat-female-1.svg', label: 'Expat Female', desc: 'Casual' },
];

function AvatarPicker({ currentUrl, onSelect, disabled }) {
  const isSelected = (path) =>
    currentUrl === path || (currentUrl && currentUrl.endsWith(path));

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
      <p className="mb-1 text-sm font-semibold text-[var(--heading-color)]">Choose an avatar</p>
      <p className="mb-4 text-xs text-[var(--muted-color)]">Arab-world styled avatars — click one to apply instantly.</p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {AVATARS.map((avatar) => {
          const selected = isSelected(avatar.path);
          return (
            <button
              key={avatar.path}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(avatar.path)}
              title={`${avatar.label} – ${avatar.desc}`}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition disabled:opacity-50 ${
                selected
                  ? 'bg-primary/15 ring-2 ring-primary'
                  : 'hover:bg-[var(--cta-soft-bg)] hover:ring-1 hover:ring-primary/40'
              }`}
            >
              <img
                src={`${apiOrigin}${avatar.path}`}
                alt={`${avatar.label} – ${avatar.desc}`}
                className="h-14 w-14 rounded-full object-cover"
              />
              <span className="text-center text-[10px] leading-tight text-[var(--muted-color)] group-hover:text-[var(--text-color)]">
                {avatar.desc}
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
