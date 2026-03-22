/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: '#0A0A0A',
          50: '#111111',
          100: '#141414',
          200: '#1A1A1A',
          300: '#222222',
          400: '#2A2A2A',
          500: '#333333',
        },
        teal: {
          DEFAULT: '#FF6B35',
          50: '#FFF0E8',
          100: '#FFD9C4',
          200: '#FFB896',
          300: '#FF9868',
          400: '#FF7D4A',
          500: '#FF6B35',
          600: '#E85A25',
          700: '#CC4A18',
          800: '#993912',
          900: '#66270C',
        },
        accent: {
          green: '#22C55E',
          red: '#EF4444',
          teal: '#FF6B35',
          purple: '#FF3D00',
        },
        neon: {
          orange: '#FF6B35',
          red: '#FF3D00',
          coral: '#FF5722',
        },
        smoke: '#8A8A8A',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],   // 10px
        'xs': ['0.6875rem', { lineHeight: '1rem' }],        // 11px
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],     // 13px
        'base': ['0.875rem', { lineHeight: '1.375rem' }],   // 14px
        'md': ['0.9375rem', { lineHeight: '1.5rem' }],      // 15px
        'lg': ['1.0625rem', { lineHeight: '1.625rem' }],    // 17px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],       // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],          // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],     // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],       // 36px
        '5xl': ['3rem', { lineHeight: '1.1' }],             // 48px
        '6xl': ['3.75rem', { lineHeight: '1.08' }],         // 60px
        '7xl': ['4.5rem', { lineHeight: '1.05' }],          // 72px
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 8s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 107, 53, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(255, 107, 53, 0.3), 0 0 60px rgba(255, 107, 53, 0.08)' },
        },
        float: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(20px, -30px)' },
          '66%': { transform: 'translate(-15px, 15px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 107, 53, 0.15)' },
          '100%': { boxShadow: '0 0 30px rgba(255, 107, 53, 0.25)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px -4px rgba(255, 107, 53, 0.3)',
        'glow': '0 0 24px -6px rgba(255, 107, 53, 0.3)',
        'glow-lg': '0 0 40px -8px rgba(255, 107, 53, 0.35)',
        'neon': '0 0 5px rgba(255, 107, 53, 0.5), 0 0 20px rgba(255, 107, 53, 0.25)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.8)',
        'card-hover': '0 16px 48px -8px rgba(0, 0, 0, 0.8), 0 0 50px -15px rgba(255, 107, 53, 0.15)',
      },
      borderRadius: {
        '3xl': '20px',
        '4xl': '24px',
      },
    },
  },
  plugins: [],
};
