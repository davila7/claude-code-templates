import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#04060c',
          1: '#07090f',
          2: '#0c1017',
          3: '#141a25',
          4: '#1a2235',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
