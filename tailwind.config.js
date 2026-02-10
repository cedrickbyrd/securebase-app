/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Corporate Blue (Primary)
        // Note: blue-600 and blue-700 are intentionally identical (#0066CC) 
        // This is the main corporate blue color defined in the design system
        blue: {
          50: '#F0F8FF',    // --color-primary-50
          100: '#E6F2FF',   // --color-primary-100
          200: '#CCE5FF',   // --color-primary-200
          300: '#99CCFF',   // --color-primary-300
          400: '#66B3FF',   // --color-primary-400
          500: '#3399FF',   // --color-primary-500
          600: '#0066CC',   // --color-primary-600 (MAIN)
          700: '#0066CC',   // --color-primary-700 (MAIN - same as 600)
          800: '#0052A3',   // --color-primary-800
          900: '#004080',   // --color-primary-900
        },
        // Slate Gray (Secondary)
        gray: {
          50: '#f8fafc',    // --color-secondary-50
          100: '#f1f5f9',   // --color-secondary-100
          200: '#e2e8f0',   // --color-secondary-200
          300: '#cbd5e1',   // --color-secondary-300
          400: '#94a3b8',   // --color-secondary-400
          500: '#64748b',   // --color-secondary-500
          600: '#475569',   // --color-secondary-600
          700: '#334155',   // --color-secondary-700
          800: '#1e293b',   // --color-secondary-800
          900: '#0f172a',   // --color-secondary-900
        },
        // Success Green
        green: {
          50: '#E6F8F0',    // --color-success-50
          100: '#CCF0DE',   // --color-success-100
          200: '#99E2CB',   // --color-success-200
          300: '#66D4B9',   // --color-success-300
          400: '#33C6A6',   // --color-success-400
          500: '#00B894',   // --color-success-500
          600: '#00A76F',   // --color-success-600
          700: '#008F60',   // --color-success-700
          800: '#007A52',   // --color-success-800
          900: '#006644',   // --color-success-900
        },
        // Warning Orange
        orange: {
          50: '#FFF6ED',    // --color-warning-50
          100: '#FFECDA',   // --color-warning-100
          200: '#FFD9B5',   // --color-warning-200
          300: '#FFC68F',   // --color-warning-300
          400: '#FFB269',   // --color-warning-400
          500: '#FF9F43',   // --color-warning-500
          600: '#FF8C1A',   // --color-warning-600
          700: '#F37F00',   // --color-warning-700
          800: '#E07300',   // --color-warning-800
          900: '#CC6600',   // --color-warning-900
        },
        // Error Red
        red: {
          50: '#fef2f2',    // --color-error-50
          100: '#fee2e2',   // --color-error-100
          200: '#fecaca',   // --color-error-200
          300: '#fca5a5',   // --color-error-300
          400: '#f87171',   // --color-error-400
          500: '#ef4444',   // --color-error-500
          600: '#dc2626',   // --color-error-600
          700: '#b91c1c',   // --color-error-700
          800: '#991b1b',   // --color-error-800
          900: '#7f1d1d',   // --color-error-900
        },
      },
    },
  },
  plugins: [],
}
