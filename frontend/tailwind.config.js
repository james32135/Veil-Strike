/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: '#06080F',
          50: '#0D1117',
          100: '#111822',
          200: '#161D2A',
          300: '#1C2333',
          400: '#232B3D',
          500: '#2A3348',
        },
        teal: {
          DEFAULT: '#00D4B8',
          50: '#E0FFF9',
          100: '#B3FFF0',
          200: '#66FFE1',
          300: '#33FFD7',
          400: '#00FFCC',
          500: '#00D4B8',
          600: '#00AA93',
          700: '#008070',
          800: '#00554A',
          900: '#002B25',
        },
        accent: {
          green: '#22C55E',
          red: '#EF4444',
        },
      },
      fontFamily: {
        heading: ['"Instrument Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'hero-pattern': "url('/images/bg.jpg')",
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 212, 184, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 212, 184, 0.4)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
