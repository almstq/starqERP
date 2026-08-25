/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const rootDir = process.cwd();
  return {
    root: rootDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [path.resolve(rootDir, 'src/test/setup.ts')],
      watch: false,
    },
  };
});
