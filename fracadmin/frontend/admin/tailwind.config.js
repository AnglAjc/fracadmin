/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#E6F1FB",
          100: "#C2D9F5",
          500: "#185FA5",
          600: "#1252912",
          700: "#0C447C",
        },
      },
    },
  },
  plugins: [],
};
