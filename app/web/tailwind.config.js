/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Atechbroe Bank brand: kiwi green, drawn from the logo. Referenced via
        // `brand-*` so the whole palette can be re-skinned in one place.
        brand: {
          50: '#f5fbe8',
          100: '#e8f6c6',
          200: '#d3ec96',
          300: '#bbdf5f',
          400: '#a1cf33',
          500: '#84b81b',
          600: '#659311',
          700: '#4c7013',
          800: '#3e5915',
          900: '#354b17',
          950: '#1b2a07',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 12px 28px -14px rgb(15 23 42 / 0.14)',
        glow: '0 18px 48px -18px rgb(101 147 17 / 0.5)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .3s ease-out both',
        'slide-up': 'slide-up .4s cubic-bezier(.21,1.02,.73,1) both',
        'scale-in': 'scale-in .18s ease-out both',
      },
    },
  },
  plugins: [],
};
