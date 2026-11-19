/** @type {import('tailwindcss').Config} */
// Greenhouse Explorer's Tailwind theme at 32a18ad (tailwind.config.js), as the A5.2 harness copies it; content adds
// perception-core's source (README "Consuming it"). The fam.* group palette is Greenhouse catalogue data and is left out.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}', './node_modules/@actualizer/perception-core/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces Variable"', '"Fraunces Fallback"', '"Iowan Old Style"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', '"Source Sans 3 Fallback"', '"Avenir Next"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono Fallback"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#2a231a', muted: '#5f5442' },
        paper: { DEFAULT: '#efe3c6', 2: '#e6d7b3', card: 'rgb(247 239 220 / 0.85)' },
        night: { DEFAULT: '#1a1712', 2: '#252019', card: 'rgb(42 36 28 / 0.85)', ink: '#efe6d3', muted: '#b8ab94' },
        cat: { a: '#2a5aa6', b: '#7b2c5e', c: '#1f7a63', d: '#a85a1f', e: '#4a4a8a', f: '#8a6d1f' },
      },
    },
  },
  plugins: [],
};
