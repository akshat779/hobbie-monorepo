/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        void: '#0D0B14',
        ink: {
          DEFAULT: '#17131F',
          raised: '#211C2E',
        },
        hairline: '#2C2739',
        signal: {
          violet: '#7B2FF7',
          light: '#D2BBFF',
        },
        pulse: {
          lilac: '#C77DFF',
          light: '#E1B6FF',
        },
        ember: {
          DEFAULT: '#FF6B5E',
          light: '#FFB4AB',
        },
        moonlight: '#F5F0FF',
        dusk: '#A99BC2',
      },
      fontFamily: {
        display: ['Bricolage-Grotesque', 'ClashDisplay-Bold', 'sans-serif'],
        body: ['General-Sans', 'sans-serif'],
        mono: ['JetBrains-Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '15px', letterSpacing: '0.2px' }],
        xs: ['13px', { lineHeight: '18px', letterSpacing: '0.1px' }],
        sm: ['14.5px', { lineHeight: '21px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['21px', { lineHeight: '28px' }],
        '2xl': ['25px', { lineHeight: '32px', letterSpacing: '-0.3px' }],
        '3xl': ['30px', { lineHeight: '38px', letterSpacing: '-0.6px' }],
        '4xl': ['38px', { lineHeight: '46px', letterSpacing: '-1px' }],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
