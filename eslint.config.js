import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'frontend/coverage/**',
      'backend/coverage/**',
      'backend/src/types/database.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'frontend/src/**/*.{ts,tsx}',
      'frontend/vite.config.ts',
      'frontend/playwright.config.ts',
      'frontend/playwright/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['frontend/src/**/*.test.{ts,tsx}', 'frontend/src/tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['backend/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['backend/tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  {
    files: [
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      'frontend/playwright/**/*.{js,jsx,ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='only']",
          message: 'Focused test markers must not be committed.',
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='skip']",
          message: 'Skipped test markers must not be committed.',
        },
        ...['fdescribe', 'fit'].map(name => ({
          selector: `CallExpression[callee.type='Identifier'][callee.name='${name}']`,
          message: 'Focused test markers must not be committed.',
        })),
        ...['xdescribe', 'xit', 'xtest'].map(name => ({
          selector: `CallExpression[callee.type='Identifier'][callee.name='${name}']`,
          message: 'Skipped test markers must not be committed.',
        })),
      ],
    },
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          modifiers: ['destructured'],
          format: null,
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          modifiers: ['destructured'],
          format: null,
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
    },
  },
);
