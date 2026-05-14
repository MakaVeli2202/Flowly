import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsAPI } from '../api/analytics';

const SESSION_KEY  = 'glanz.session';
const VISITOR_KEY  = 'glanz.visitor';
const HEARTBEAT_MS = 30_000;

function getOrCreateSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getIsNewVisitor() {
  if (localStorage.getItem(VISITOR_KEY)) return false;
  localStorage.setItem(VISITOR_KEY, '1');
  return true;
}

function detectSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) {
    const s = utmSource.toLowerCase();
    if (s.includes('google'))    return 'Google';
    if (s.includes('tiktok'))    return 'TikTok';
    if (s.includes('instagram')) return 'Instagram';
    if (s.includes('facebook') || s === 'fb') return 'Facebook';
    if (s.includes('twitter') || s === 'x')   return 'Twitter/X';
    if (s.includes('youtube'))   return 'YouTube';
    if (s.includes('snapchat'))  return 'Snapchat';
    if (s.includes('linkedin'))  return 'LinkedIn';
    return utmSource.slice(0, 50);
  }
  const ref = document.referrer;
  if (!ref) return 'Direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    if (host.includes('google'))             return 'Google';
    if (host.includes('tiktok'))             return 'TikTok';
    if (host.includes('instagram') || host.includes('ig.me')) return 'Instagram';
    if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('twitter') || host.includes('x.com') || host.includes('t.co')) return 'Twitter/X';
    if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('snapchat'))           return 'Snapchat';
    if (host.includes('linkedin'))           return 'LinkedIn';
    return 'Referral';
  } catch {
    return 'Direct';
  }
}

function detectDevice() {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua))                           return 'Tablet';
  if (/mobile|iphone|android|blackberry|windows phone/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

export function usePageTracking() {
  const location  = useLocation();
  const sessionId = useRef(getOrCreateSessionId());
  const source    = useRef(detectSource());
  const device    = useRef(detectDevice());
  const isNew     = useRef(getIsNewVisitor());

  useEffect(() => {
    let alive = true;
    const sid = sessionId.current;

    analyticsAPI.track({
      sessionId:   sid,
      page:        location.pathname,
      source:      source.current,
      referrer:    document.referrer || null,
      deviceType:  device.current,
      isNewVisitor: isNew.current,
    }).catch(() => {});

    isNew.current = false;

    const interval = setInterval(() => {
      if (alive) analyticsAPI.heartbeat(sid).catch(() => {});
    }, HEARTBEAT_MS);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [location.pathname]);
}
