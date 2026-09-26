/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        serif: ["'Playfair Display'", "serif"],
      },
      colors: {
        gold: "#E5AC5F",
        "gold-dark": "#C9914A",
        "gold-light": "#F2CB8E",
        "gold-soft": "#FBF1E0",
        brand: "#211C16",
      },
    },
  },
  plugins: [],
};