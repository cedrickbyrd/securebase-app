module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true, // Add node environment for config files
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    react: {
      version: '18.2',
    },
  },
  plugins: ['react-refresh'],
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|^_', argsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off', // Turn off prop-types as we're not using them
  },
  overrides: [
    {
      // Config files can use Node.js globals
      files: ['*.config.js', '*.config.cjs', 'vitest.config.js', 'vite.config.js'],
      env: {
        node: true,
      },
    },
    {
      // Test files can use testing globals
      files: ['**/__tests__/**/*', '**/*.test.{js,jsx}', '**/test/**/*', 'src/test/**/*'],
      env: {
        jest: true,
        node: true,
      },
    },
  ],
};
