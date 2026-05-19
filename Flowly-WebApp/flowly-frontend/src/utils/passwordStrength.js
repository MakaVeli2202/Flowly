export function pwStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)   && /[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0–4
}

export const STRENGTH_BAR   = ['bg-rose-500', 'bg-orange-400', 'bg-amber-400', 'bg-green-500'];
export const STRENGTH_LABEL = ['Weak', 'Fair', 'Good', 'Strong'];
export const STRENGTH_CLR   = ['text-rose-400', 'text-orange-400', 'text-amber-400', 'text-green-400'];
