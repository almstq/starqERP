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
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: 'https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      pool: 'threads',
      setupFiles: [path.resolve(rootDir, 'src/test/setup.ts')],
      watch: false,
    },
  };
});
