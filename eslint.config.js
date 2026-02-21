// eslint.config.js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "react-hooks": fixupPluginRules(reactHooks),
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "warn",
    },
  },
  {
    ignores: ["dist/**", "build/**", "node_modules/**"],
  },
];
