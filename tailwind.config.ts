import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8edf2',
          100: '#c5d1de',
          200: '#9eb3c8',
          300: '#7795b2',
          400: '#597fa2',
          500: '#3b6992',
          600: '#33608a',
          700: '#28547d',
          800: '#1a3147',
          900: '#0f1f2e',
        },
        campaign: {
          red: '#dc2626',
          redHover: '#b91c1c',
          navy: '#1a3147',
          navyLight: '#243d55',
          gold: '#f59e0b',
          green: '#10b981',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};

export default config;
