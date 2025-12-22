import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        component: 'component.html',
        plugin: 'plugin.html',
        trending: 'trending.html',
        'download-stats': 'download-stats.html',
      }
    }
  },
  server: {
    port: 3000
  }
})
