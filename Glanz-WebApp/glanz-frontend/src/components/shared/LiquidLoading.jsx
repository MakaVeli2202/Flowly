/* eslint-disable react-hooks/purity */
import React, { useState, useEffect } from 'react';

const BARS = [
  { gradient: 'from-purple-500 to-pink-500',  shadow: '#a855f7' },
  { gradient: 'from-blue-500 to-purple-500',   shadow: '#3b82f6' },
  { gradient: 'from-cyan-400 to-blue-500',     shadow: '#06b6d4' },
  { gradient: 'from-green-400 to-cyan-400',    shadow: '#10b981' },
  { gradient: 'from-yellow-400 to-green-400',  shadow: '#eab308' },
  { gradient: 'from-orange-400 to-yellow-400', shadow: '#f97316' },
  { gradient: 'from-red-500 to-orange-400',    shadow: '#ef4444' },
];

const LiquidLoading = () => {
  const [heights, setHeights] = useState(BARS.map(() => 0));
  const [droplets, setDroplets] = useState(BARS.map(() => false));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() * 0.001;
      setHeights(prev => prev.map((_, index) => {
        const delay = index * 0.8;
        const primaryWave = Math.sin(now + delay);
        const bounceWave = Math.sin(now * 4 + delay) * 0.15;
        const ripple = Math.sin(now * 8 + delay) * 0.05;
        return 80 * (primaryWave + bounceWave + ripple);
      }));

      setDroplets(prev => prev.map((_, index) => {
        const delay = index * 0.8;
        return Math.sin(now + delay) > 0.8;
      }));
    }, 32);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-end space-x-4 p-8">
      {heights.map((height, index) => {
        const bar = BARS[index];
        return (
          <div key={index} className="relative flex flex-col items-center">
            <div
              className={`w-4 h-4 rounded-full bg-gradient-to-r ${bar.gradient} mb-3 transition-all duration-500 ease-out`}
              style={{
                opacity: droplets[index] ? 1 : 0,
                filter: 'blur(0.5px)',
                transform: droplets[index]
                  ? `translateY(${Math.sin(Date.now() * 0.008 + index * 0.5) * 3}px) scale(${0.8 + Math.sin(Date.now() * 0.006 + index * 0.3) * 0.4})`
                  : 'translateY(10px) scale(0.5)',
                boxShadow: droplets[index] ? `0 0 15px ${bar.shadow}40` : 'none'
              }}
            />

            <div
              className={`w-10 bg-gradient-to-t ${bar.gradient} rounded-full transition-all duration-200 ease-out relative overflow-hidden shadow-lg`}
              style={{
                height: `${Math.abs(height)}px`,
                transform: height < 0 ? 'scaleY(-1)' : 'scaleY(1)',
                transformOrigin: 'bottom',
                filter: 'blur(0.3px)',
                boxShadow: `0 0 20px ${bar.shadow}50, inset 0 0 20px rgba(255,255,255,0.1)`
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/40 to-transparent rounded-full"
                style={{
                  transform: `translateY(${Math.sin(Date.now() * 0.003 + index * 0.5) * 1}px) scaleY(${0.8 + Math.sin(Date.now() * 0.004 + index * 0.3) * 0.3})`
                }}
              />

              <div
                className="absolute inset-0 bg-gradient-to-t from-white/20 via-white/10 to-transparent rounded-full"
                style={{
                  transform: `translateY(${Math.sin(Date.now() * 0.002 + index * 0.5) * 2}px)`,
                  background: `linear-gradient(0deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)`
                }}
              />

              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full"
                style={{
                  transform: `translateX(${Math.sin(Date.now() * 0.0015 + index * 0.7) * 8}px)`,
                  width: '140%',
                  left: '-20%'
                }}
              />

              <div
                className="absolute w-2 h-2 bg-white/30 rounded-full"
                style={{
                  top: `${20 + Math.sin(Date.now() * 0.003 + index * 0.8) * 10}%`,
                  left: `${30 + Math.sin(Date.now() * 0.002 + index * 0.6) * 20}%`,
                  transform: `scale(${0.5 + Math.sin(Date.now() * 0.004 + index * 0.4) * 0.5})`,
                  opacity: Math.sin(Date.now() * 0.005 + index * 0.9) * 0.3 + 0.3
                }}
              />
            </div>

            <div
              className={`w-3 h-3 rounded-full bg-gradient-to-r ${bar.gradient} mt-2 transition-all duration-300`}
              style={{
                opacity: Math.sin(Date.now() * 0.003 + index * 0.9) * 0.4 + 0.6,
                transform: `scale(${0.6 + Math.sin(Date.now() * 0.002 + index * 0.6) * 0.4}) translateY(${Math.sin(Date.now() * 0.004 + index * 0.8) * 1}px)`,
                filter: 'blur(0.2px)',
                boxShadow: `0 2px 8px ${bar.shadow}40`
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default LiquidLoading;
