import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: 'apps/web',
  plugins: [react()],
  resolve: {alias: {'@domain': fileURLToPath(new URL('./packages/meal-domain/src', import.meta.url))}},
  server: {host:'0.0.0.0', port:3000, strictPort:true, allowedHosts:true},
  build: {outDir:'../../dist', emptyOutDir:true},
});
