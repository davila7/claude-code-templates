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
    plugins: [
      tailwindcss(),
      {
        name: 'cloudflare-react-dom-server',
        config(_config, { command }) {
          if (command === 'build') {
            return {
              resolve: {
                alias: [
                  { find: /^react-dom\/server$/, replacement: 'react-dom/server.node' },
                ],
              },
              ssr: { noExternal: ['react-dom'] },
            };
          }
        },
      },
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    ssr: {
      external: ['node:fs', 'node:path', 'node:url', 'node:stream'],
    },
  },
});
