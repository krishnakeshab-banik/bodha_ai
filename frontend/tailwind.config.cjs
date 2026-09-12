/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f3efe6',
        rule: '#cfc8ba',
        ink: {
          DEFAULT: '#141814',
          muted: '#4a4f4a',
        },
        brand: {
          50: '#eef6f2',
          100: '#d5ebe1',
          200: '#a9d4c0',
          300: '#73b59a',
          400: '#3d8f6e',
          500: '#1b7a56',
          600: '#0d6b4c',
          700: '#0a5540',
          800: '#0c3d2e',
          900: '#10241c',
          950: '#0a1612',
        },
        profit: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#0d6b4c',
          700: '#0a5540',
        },
        risk: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: [
          'IBM Plex Sans',
          'Noto Sans Devanagari',
          'Noto Sans Tamil',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'IBM Plex Serif',
          'Noto Sans Devanagari',
          'Noto Sans Tamil',
          'Georgia',
          'serif',
        ],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        display: ['3.15rem', { lineHeight: '1.08', letterSpacing: '-0.028em' }],
        headline: ['2rem', { lineHeight: '1.18', letterSpacing: '-0.018em' }],
        title: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        ambient: ['0.8125rem', { lineHeight: '1.5' }],
      },
      boxShadow: {
        card: 'none',
        lifted: 'none',
        glow: 'none',
      },
      borderRadius: {
        xl: '0.25rem',
        '2xl': '0.25rem',
        '3xl': '0.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'slide-in': 'slide-in 0.25s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
