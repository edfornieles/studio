import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `assets/` is git-ignored at the repo root, so build output uses `static/`.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { assetsDir: 'static', target: 'es2020' },
});
