import { useEffect, useRef } from 'react';

export default function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let curX = mouseX, curY = mouseY, rafId;
    const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const tick = () => {
      curX += (mouseX - curX) * 0.09; curY += (mouseY - curY) * 0.09;
      const hue = (mouseX / window.innerWidth) * 360;
      el.style.transform  = `translate3d(${curX}px,${curY}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.23),rgba(255,160,0,.21),rgba(255,255,0,.18),rgba(0,255,100,.21),rgba(0,160,255,.23),rgba(160,0,255,.21),rgba(255,0,80,.23))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width: 500, height: 500, top: '-250px', left: '-250px' }} />;
}
