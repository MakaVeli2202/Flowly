// src/hooks/useScrollTrigger.js
import { useEffect } from 'react';
import { gsap }      from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/*
  syncGsapWithLenis is no longer needed.
  The ticker + lenis.on('scroll', ScrollTrigger.update) in useLenis.js
  is the correct and complete integration.
  Keeping this as a no-op so existing import calls don't break.
*/
export function syncGsapWithLenis() {
  ScrollTrigger.refresh();
}

export default function useScrollTrigger(ref, buildTimeline, deps = []) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const ctx = gsap.context(() => buildTimeline(gsap, ScrollTrigger), el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}