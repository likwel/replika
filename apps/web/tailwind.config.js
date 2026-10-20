/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        serif: ["'Playfair Display'", "serif"],
      },
      // Arrondis plus discrets, façon Notion
      borderRadius: {
        lg: "0.375rem",
        xl: "0.5rem",
        "2xl": "0.625rem",
        "3xl": "0.875rem",
      },
      colors: {
        // Suit l'accent choisi (index.css) ; la forme rgb permet les opacités (ring-gold/40…)
        gold: "rgb(var(--color-gold-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
