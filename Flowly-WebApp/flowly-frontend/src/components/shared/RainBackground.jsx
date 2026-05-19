import { useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';

export default function RainBackground() {
  const theme = useTheme();

  useEffect(() => {
    document.body.classList.add('has-video-bg');
    return () => document.body.classList.remove('has-video-bg');
  }, []);

  return (
    <video
      className="fixed inset-0 w-full h-full object-cover pointer-events-none select-none"
      style={{
        zIndex: 0,
        opacity: theme === 'light' ? 0.18 : 0.13,
        mixBlendMode: theme === 'light' ? 'multiply' : 'screen',
      }}
      autoPlay loop muted playsInline
      preload="none"
      poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect fill='%230d1117' width='1920' height='1080'/%3E%3C/svg%3E"
      aria-hidden="true"
    >
      <source src="/videos/RainOnGlass.mp4" type="video/mp4" />
    </video>
  );
}
