import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@native': path.join(rootDir, 'native'),
      ...(mode === 'android'
        ? { '@elevenlabs/react': path.join(rootDir, 'frontend/src/shims/elevenlabsStub.ts') }
        : {}),
    },
    modules: [path.join(rootDir, 'frontend/node_modules'), path.join(rootDir, 'node_modules')],
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts + d3 dwarf the app code; splitting them out lets the browser
        // cache the charting bundle across app deploys.
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin in development, so no CORS preflight.
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
        timeout: 120_000,
      },
    },
  },
}));
