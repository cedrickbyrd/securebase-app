/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#d6e0fd',
          300: '#b3c5fb',
          400: '#8ca5f8',
          500: '#667eea',
          600: '#5568d3',
          700: '#4553b8',
          800: '#3a4595',
          900: '#333d7a',
        },
      },
    },
  },
  plugins: [],
}
