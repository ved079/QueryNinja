import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  // sql.js ships a CJS/UMD bundle, so it must stay in Vite's pre-bundling
  // (excluding it breaks the default import).
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
