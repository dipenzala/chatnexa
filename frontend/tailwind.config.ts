import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', 50: '#EFF6FF', 100: '#DBEAFE', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
        mint: { DEFAULT: '#14B8A6', 50: '#F0FDFA', 100: '#CCFBF1', 500: '#14B8A6', 600: '#0D9488' },
        peach: { DEFAULT: '#F97316', 50: '#FFF7ED', 100: '#FFEDD5', 500: '#F97316', 600: '#EA580C' },
        rose: { DEFAULT: '#F43F5E', 50: '#FFF1F2', 100: '#FFE4E6', 500: '#F43F5E', 600: '#E11D48' },
        ink: '#0F172A',
        canvas: '#FAFBFC',
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '24px' },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
        lift: '0 4px 12px rgba(15,23,42,0.08), 0 16px 40px rgba(15,23,42,0.08)',
        glow: '0 8px 32px rgba(37,99,235,0.20)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-500px 0' }, '100%': { backgroundPosition: '500px 0' } },
      },
      animation: { 'fade-up': 'fade-up .4s ease-out both', shimmer: 'shimmer 1.6s infinite linear' },
    },
  },
  plugins: [],
};
export default config;
