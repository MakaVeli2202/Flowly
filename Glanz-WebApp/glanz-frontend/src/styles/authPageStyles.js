export const BASE_PRISM_CSS = `
@keyframes holo-sweep {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes prism-ray-sweep {
  0%   { transform: translateX(-130%) skewX(-15deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(460%) skewX(-15deg); opacity: 0; }
}
@keyframes spectrum-float {
  0%,100% { transform: translate(0,0) rotate(0deg);          opacity: 0.28; }
  33%      { transform: translate(18px,-24px) rotate(120deg); opacity: 0.55; }
  66%      { transform: translate(-12px,12px) rotate(240deg); opacity: 0.38; }
}
@keyframes cta-rainbow-glow {
  0%,100% { box-shadow: 0 0 0 1.5px rgba(255,80,80,.5),  0 0 28px rgba(255,165,0,.2), 0 0 55px rgba(0,255,100,.15); }
  25%      { box-shadow: 0 0 0 1.5px rgba(255,210,0,.5),  0 0 28px rgba(0,255,150,.2), 0 0 55px rgba(0,150,255,.15); }
  50%      { box-shadow: 0 0 0 1.5px rgba(0,200,255,.5),  0 0 28px rgba(160,0,255,.2), 0 0 55px rgba(255,0,100,.15); }
  75%      { box-shadow: 0 0 0 1.5px rgba(0,255,120,.5),  0 0 28px rgba(255,0,100,.2), 0 0 55px rgba(255,210,0,.15); }
}
@keyframes hero-ring-pulse {
  0%,100% { transform: scale(1);     opacity: 0.38; }
  50%      { transform: scale(1.07); opacity: 0.62; }
}
@keyframes icon-pop-in {
  0%   { transform: scale(0.45) rotate(-18deg); opacity: 0; }
  70%  { transform: scale(1.12)  rotate(3deg);  opacity: 1; }
  100% { transform: scale(1)     rotate(0deg);  opacity: 1; }
}
@keyframes card-enter {
  from { transform: translateY(28px) scale(0.985); opacity: 0; }
  to   { transform: translateY(0)    scale(1);     opacity: 1; }
}
@keyframes field-in {
  from { transform: translateX(-10px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
.prism-cursor-blob {
  position: fixed; pointer-events: none; z-index: 0;
  border-radius: 50%; filter: blur(85px); mix-blend-mode: screen;
  will-change: transform, background;
}
.prism-ray {
  position: absolute; top: -30%; height: 160%; pointer-events: none;
  transform: skewX(-18deg);
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,55,55,.055) 15%, rgba(255,200,0,.08) 30%,
    rgba(0,255,145,.07) 50%, rgba(0,145,255,.07) 70%,
    rgba(195,0,255,.05) 85%, transparent 100%);
}
.prism-glass { position: relative; overflow: hidden; transition: box-shadow 0.45s ease; }
.prism-glass::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(
    circle at var(--px,50%) var(--py,50%),
    rgba(255,200,80,.2) 0%, rgba(80,255,160,.14) 25%,
    rgba(40,130,255,.14) 50%, rgba(200,40,255,.1) 70%, transparent 86%
  );
  opacity: 0; transition: opacity 0.3s; mix-blend-mode: screen;
}
.prism-glass:hover::after { opacity: 1; }
.cta-prism-glow  { animation: cta-rainbow-glow 5s ease-in-out infinite; }
.spectrum-line {
  height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,0,100,.85) 12%, rgba(255,165,0,.9) 24%,
    rgba(255,255,0,.9) 36%, rgba(0,255,100,.9) 48%,
    rgba(0,150,255,.9) 60%, rgba(150,0,255,.85) 72%, transparent 85%);
  background-size: 200% 100%;
  animation: holo-sweep 5s linear infinite; opacity: 0.45;
}
.card-enter { animation: card-enter  0.65s cubic-bezier(0.22,1,0.36,1) both; }
.icon-pop   { animation: icon-pop-in 0.70s cubic-bezier(0.34,1.56,0.64,1) 0.20s both; }
`;
