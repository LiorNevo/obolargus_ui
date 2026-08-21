import js from "@eslint/js";
import tseslintParser from "@typescript-eslint/parser";
import jsonc from "eslint-plugin-jsonc";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "storybook-static/**"],
  },
  js.configs.recommended,
  ...jsonc.configs["flat/recommended-with-json"],
  {
    files: ["**/*.config.js", ".storybook/**/*.js"],
    languageOptions: { globals: globals.node },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["js/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.browser,
        process: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        jest: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];
