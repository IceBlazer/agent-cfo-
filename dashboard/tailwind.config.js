/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#16A34A", light: "#ECFDF3", dark: "#15803D" },
        muted: "#6B7280",
        border: "#E5E7EB",
      },
      borderRadius: { card: "18px" },
      boxShadow: { soft: "0 8px 30px rgba(17,24,39,0.06)" },
    },
  },
  plugins: [],
};
