/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#C8A96B',
        secondary: '#0EA5A0',
        ink: '#0D1117',
        panel: '#121A23',
        mist: '#E8E9EC',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 12px 40px rgba(200, 169, 107, 0.22)',
      },
      height: {
        22: '5.5rem',
        24: '6rem',
        28: '7rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
      },
      width: {
        22: '5.5rem',
        24: '6rem',
        28: '7rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
      },
    },
  },
  plugins: [],
}