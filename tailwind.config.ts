import type { Config } from 'tailwindcss';

// Palette ported 1:1 from the Vetora Live prototype so the production
// app looks identical to what was already validated with the client.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#EEF2FA',
        surface: '#FFFFFF',
        surface2: '#F5F8FD',
        border: '#E1E7F4',
        borderStrong: '#C9D3E8',
        text: '#141B33',
        text2: '#57628A',
        text3: '#8A93B8',
        navy: '#131C3B',
        navy2: '#1D2C57',
        navySoft: '#E9ECFA',
        accent: '#2F5FE0',
        accent2: '#1E46B8',
        accentSoft: '#E7EEFE',
        green: '#158A4C',
        red: '#C23636',
        amber: '#B4790A',
        orange: '#C2591F',
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        xl2: '18px',
      },
    },
  },
  plugins: [],
};
export default config;
