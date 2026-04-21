import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './app/globals.css',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        sidebar: 'var(--color-sidebar)',
        border: 'var(--color-border)',
        accent: '#E8450A',
        success: '#276749',
        warning: '#92400E',
        danger: '#9B2C2C',
        muted: 'var(--color-muted)',
        body: 'var(--color-body)',
        heading: 'var(--color-heading)',
        badge: {
          brand: '#E8450A',
          seo: '#1E40AF',
          blacklist: '#9B2C2C',
          agency: '#276749',
          client: '#6B21A8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Playfair Display"', 'serif'],
      },
      borderRadius: {
        input: '8px',
        card: '12px',
      },
      boxShadow: {
        'glass': '0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.3)',
        'glass-light': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'glow-accent': '0 0 12px rgba(232,69,10,0.15)',
        'glow-accent-strong': '0 0 20px rgba(232,69,10,0.25)',
        'glow-success': '0 0 16px rgba(39,103,73,0.3)',
        'glow-warning': '0 0 16px rgba(146,64,14,0.3)',
        'glow-danger': '0 0 16px rgba(155,44,44,0.3)',
      },
      animation: {
        'dash-rotate': 'dash-rotate 20s linear infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
      },
      keyframes: {
        'dash-rotate': {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 100%' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(-2%)' },
          '50%': { transform: 'translateY(2%)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
