// src/hooks/useLenis.js
import { useEffect } from 'react';
import Lenis        from 'lenis';
import { gsap }     from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;
export const getLenis = () => lenisInstance;

export default function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration:        1.2,
      easing:          (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel:     true,
      touchMultiplier: 2,
      infinite:        false,
    });

    lenisInstance = lenis;

    /*
      ✅ Correct integration order:
        1. GSAP ticker drives Lenis RAF — single animation loop, no double-firing
        2. Lenis scroll event → ScrollTrigger.update() keeps ST positions accurate
        3. lagSmoothing(0) prevents GSAP from skipping frames under CPU load
      ❌ Never use a raw requestAnimationFrame loop alongside gsap.ticker
    */
    const rafFn = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(rafFn);
    gsap.ticker.lagSmoothing(0);

    lenis.on('scroll', ScrollTrigger.update);

    return () => {
      lenis.off('scroll', ScrollTrigger.update);
      gsap.ticker.remove(rafFn);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}