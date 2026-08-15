import js from "@eslint/js";
import tseslintParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**", "storybook-static/**"],
  },
  js.configs.recommended,
  {
    files: ["js/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        navigator: "readonly",
        process: "readonly",
        fetch: "readonly",
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