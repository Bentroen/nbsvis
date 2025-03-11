import pluginJs from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.browser,
      parser: tsParser,
      sourceType: "module",
    },
    plugins: {
      //    prettier: prettierPlugin,
      //import: importPlugin,
    },
    rules: {
      semi: ["warn", "always"],
      quotes: ["warn", "double"],
      "@typescript-eslint/no-unused-vars": ["warn"],
      //"prettier/prettier": [
      //  "warn",
      //  {
      //    semi: true,
      //    singleQuote: false,
      //    trailingComma: "all",
      //    printWidth: 100,
      //    tabWidth: 2,
      //  },
      //],
      //"import/order": [
      //  "warn",
      //  {
      //    groups: [
      //      "builtin", // Node.js built-in modules (fs, path, etc.)
      //      "external", // npm packages (react, express, etc.)
      //      "internal", // Aliases like @utils, @components
      //      ["parent", "sibling", "index"], // Relative imports
      //    ],
      //    "newlines-between": "always",
      //    alphabetize: { order: "asc", caseInsensitive: true },
      //  },
      //],
    },
  },
  prettier,
];
