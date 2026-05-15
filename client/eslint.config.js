import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat"; // 1. Import Prettier Config
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default defineConfig([
  // Global Ignores
  globalIgnores(["dist"]),

  // Base ESLint JavaScript Configuration
  js.configs.recommended,

  // React JS & JSX Configuration Block
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // 2. MUST BE LAST: Turns off conflicting stylistic rules
  eslintConfigPrettier,
]);
