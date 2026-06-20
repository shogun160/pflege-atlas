import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = {
  '@': path.resolve(__dirname, './src'),
  // Next.js `server-only` is not a real npm package in this project; stub it out for Vitest.
  'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
};

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.{ts,tsx}'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
    ],
  },
  resolve: { alias },
});
