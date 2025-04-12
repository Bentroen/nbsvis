import pluginJs from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.browser,
      parser: tsParser,
      sourceType: 'module',
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      semi: ['warn', 'always'],
      quotes: ['warn', 'double'],
      '@typescript-eslint/no-unused-vars': ['warn'],
      'import/order': [
        'warn',
        {
          groups: [
            'builtin', // Node.js built-in modules (fs, path, etc.)
            'external', // npm packages (react, express, etc.)
            'internal', // Aliases like @utils, @components
            ['parent', 'sibling', 'index'], // Relative imports
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': ['warn'],
      'unused-imports/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'unused-imports/no-unused-imports': 'warn',
    },
  },
  prettier,
];
