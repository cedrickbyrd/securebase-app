/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../src/**/*.{js,ts,jsx,tsx}", // Also scan the parent styles you're importing
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
