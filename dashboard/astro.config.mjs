import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.aitmpl.com',
  output: 'server',
  adapter: cloudflare({ mode: 'directory' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      // Use the Node.js server build of react-dom to avoid MessageChannel
      // dependency at module init time in Cloudflare Workers runtime.
      alias: [
        { find: /^react-dom\/server$/, replacement: 'react-dom/server.node' },
      ],
    },
    ssr: {
      // Bundle react-dom so the alias above applies at build time.
      noExternal: ['react-dom'],
      // Keep Node built-ins external; provided by nodejs_compat_v2.
      external: ['node:fs', 'node:path', 'node:url', 'node:stream'],
    },
  },
});
