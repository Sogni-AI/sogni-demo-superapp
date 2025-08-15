module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '*.config.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-refresh',
  ],
  rules: {
    // Code quality
    'no-console': 'warn',
    'no-debugger': 'warn',
    'no-unused-vars': 'off', // Use TypeScript version
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // React specific
    'react/jsx-uses-react': 'off', // React 17+ JSX transform
    'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // Code style (handled by Prettier)
    'indent': 'off',
    'quotes': 'off',
    'semi': 'off',

    // Sogni SDK specific allowances
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
  },
  overrides: [
    // Frontend specific rules
    {
      files: ['web/src/**/*.{ts,tsx}'],
      env: {
        browser: true,
        node: false,
      },
      rules: {
        'no-console': 'error', // Stricter for frontend
      },
    },
    // Backend specific rules
    {
      files: ['server/**/*.{js,ts}'],
      env: {
        browser: false,
        node: true,
      },
      rules: {
        'no-console': 'warn', // Console.log is OK for server logging
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    // Configuration files
    {
      files: ['*.config.{js,ts}', '*.config.*.{js,ts}'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};
