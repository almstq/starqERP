/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { execSync } from 'child_process';

const envCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
let commitHash = envCommit ? envCommit.slice(0, 7) : '';
if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {}
}
if (!commitHash) {
  commitHash = 'dev';
}

export default defineConfig(({ mode }) => {
  const rootDir = process.cwd();
  const env = loadEnv(mode, rootDir, '');
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  return {
    root: rootDir,
    plugins: [react(), tailwindcss()],
    define: {
      __BUILD_COMMIT__: JSON.stringify(commitHash),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    server: {
      port: 3001,
      proxy: supabaseUrl ? {
        '/api': {
          target: `${supabaseUrl}/functions/v1/starq-api`,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
            });
          },
        },
      } : {},
    },
    test: {
      globals: true,
      environment: 'jsdom',
      pool: 'forks',
      setupFiles: [path.resolve(rootDir, 'src/test/setup.ts')],
      include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
      watch: false,
    },
  };
});
