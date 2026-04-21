import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'react'],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
});
