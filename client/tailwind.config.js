/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charte "Corail" (2026-08-23) — remplace la couleur de marque
        // indigo par un corail chaud. Toutes les classes indigo-* du
        // codebase (bg-indigo-600, text-indigo-400, from-indigo-950...)
        // héritent automatiquement de cette palette, sans avoir à
        // renommer les classes dans chaque composant.
        indigo: {
          50: '#fff6f2',
          100: '#ffeee6',
          200: '#ffd9cb',
          300: '#ffb79f',
          400: '#ff9270',
          500: '#fb7a4d',
          600: '#ea5a2b',
          700: '#c2410c',
          800: '#7a2410',
          900: '#431a11',
          950: '#2b0f0a',
        },
      },
    },
  },
  plugins: [],
};
