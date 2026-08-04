/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eaf2fc",
          100: "#cde2fb",
          200: "#9ec5f4",
          300: "#6da7ec",
          400: "#3987e5",
          500: "#2a78d6",
          600: "#256abf",
          700: "#1c5cab",
          800: "#184f95",
          900: "#0d366b",
        },
        ink: {
          DEFAULT: "#0b0b0b",
          secondary: "#52514e",
          muted: "#898781",
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
        surface: {
          page: "#f9f9f7",
          card: "#fcfcfb",
          border: "#e1e0d9",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
}
