import { defineConfig } from 'vitest/config';

// wrangler bundles skills/*.md as text ([[rules]] type = "Text"); do the same under vitest.
export default defineConfig({
  plugins: [{
    name: 'md-as-text',
    transform(code, id) {
      if (id.endsWith('.md')) return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  }],
});
