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
      // `../native` sits outside this project, so its bare `@capacitor/*`
      // imports would otherwise resolve Node-style from ITS OWN folder
      // upward — reaching only a repo-root `node_modules`, which an isolated
      // single-service deploy (e.g. Vercel building this "frontend" service
      // alone) never installs. Pin them to this project's own node_modules
      // instead, where they're guaranteed to exist once `npm install` runs
      // here. (The previous `resolve.modules` entry that attempted this was
      // not a real Vite option and silently did nothing.)
      '@capacitor': path.join(rootDir, 'frontend/node_modules/@capacitor'),
      '@capacitor-community': path.join(rootDir, 'frontend/node_modules/@capacitor-community'),
      ...(mode === 'android'
        ? { '@elevenlabs/react': path.join(rootDir, 'frontend/src/shims/elevenlabsStub.ts') }
        : {}),
    },
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
