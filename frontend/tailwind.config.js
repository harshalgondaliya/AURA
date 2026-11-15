/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          ivory: '#F8F6F1',       // Primary Page Background
          cream: '#EFECE4',       // Secondary Surface / Light Panels
          espresso: '#28231F',    // Primary Text / Deep Surfaces / Solid Buttons
          olive: '#555941',       // Sophisticated WCAG AA Accent (6.72:1 contrast)
          taupe: '#B9AE9E',       // Secondary Accents / Borders
          champagne: '#D8C9B2',   // Luxury Highlights / Warm Badges
          muted: '#57524A',       // WCAG AA Compliant Subtitles / Prose (7.17:1 contrast)
          white: '#FFFFFF',       // Card Backgrounds
          dark: '#1C1917',        // Deepest Rich Charcoal
        }
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'serif'],
        sans: ['Calibri', 'Carlito', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        'editorial': '0.22em',
        'subtle': '0.08em',
      },
      boxShadow: {
        'aura-subtle': '0 2px 12px -2px rgba(40, 35, 31, 0.05)',
        'aura-card': '0 4px 20px -4px rgba(40, 35, 31, 0.07)',
        'aura-hover': '0 12px 32px -8px rgba(40, 35, 31, 0.12)',
      }
    },
  },
  plugins: [],
}
