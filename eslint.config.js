// eslint.config.js
import js from "@eslint/js";
import globals from "globals"; // You may need to: npm install globals

export default [
  js.configs.recommended,
  {
    // Apply this to your Frontend / Browser files
    files: ["src/**/*.{js,jsx}", "phase3a-portal/src/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // Apply this to your Backend / Lambda / Node files
    files: ["src/functions/**/*.js", "infrastructure/**/*.js", "tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
];
