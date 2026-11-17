/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["'Playfair Display'", "serif"],
      },
      // Arrondis généreux du design system pr.social : boutons et champs 11–14 px, cartes 18 px, feuilles 26 px
      borderRadius: {
        md: "0.6875rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.125rem",
        "3xl": "1.625rem",
      },
      transitionTimingFunction: {
        // Courbe de mouvement unique de l'interface (index.css : --ease)
        brand: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      colors: {
        // Suit l'accent choisi (index.css) ; la forme rgb permet les opacités (ring-gold/40…)
        gold: "rgb(var(--color-gold-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
