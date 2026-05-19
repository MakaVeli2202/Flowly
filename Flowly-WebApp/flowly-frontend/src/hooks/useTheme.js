import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme || 'light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
