/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vfr: '#22c55e',
        mvfr: '#3b82f6',
        ifr: '#ef4444',
        lifr: '#d946ef',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'fade-in':  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer:    { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in':  'fade-in .25s ease-out both',
        'slide-up': 'slide-up .3s ease-out both',
        'scale-in': 'scale-in .15s ease-out both',
      },
    },
  },
  plugins: [],
};
