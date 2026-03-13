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
          DEFAULT: '#E2B33E',
          50: '#FFF8E7',
          100: '#FCEDC4',
          200: '#F5D97A',
          300: '#EDCA5A',
          400: '#E8C044',
          500: '#E2B33E',
          600: '#C99A2E',
          700: '#A07A22',
          800: '#775A18',
          900: '#4E3B0F',
        },
        accent: {
          green: '#22C55E',
          red: '#EF4444',
        },
      },
      fontFamily: {
        heading: ['"Bodoni Moda"', 'serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"Source Code Pro"', 'monospace'],
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
          '0%': { boxShadow: '0 0 5px rgba(226, 179, 62, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(226, 179, 62, 0.4)' },
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
