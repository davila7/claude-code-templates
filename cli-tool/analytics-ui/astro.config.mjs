import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  outDir: '../src/analytics-web',
  build: {
    assets: '_astro',
    format: 'file',
    inlineStylesheets: 'auto',
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
