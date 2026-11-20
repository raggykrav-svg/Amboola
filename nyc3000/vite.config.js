import { defineConfig } from 'vite';

// base './' so the static build works from any folder (or file host).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
