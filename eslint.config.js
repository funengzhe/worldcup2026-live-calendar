import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"]
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "no-console": "off"
    }
  }
];
