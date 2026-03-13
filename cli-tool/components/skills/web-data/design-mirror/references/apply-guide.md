# Design Application Guide

How to apply extracted design tokens to different frontend stacks.

## Tailwind CSS Projects

### 1. Update tailwind.config.js / tailwind.config.ts

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: {
          page:    '#0a0a0f',
          surface: '#13131a',
          elevated:'#1a1a2e',
        },
        brand: {
          DEFAULT: '#7c3aed',
          hover:   '#6d28d9',
        },
        border: 'rgba(255,255,255,0.08)',
        text: {
          primary:   '#ffffff',
          secondary: '#a0a0b8',
          muted:     '#606080',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '12px',
        'lg': '20px',
        'xl': '28px',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'glow': '0 0 24px rgba(124,58,237,0.3)',
      },
    }
  }
}
```

### 2. Update globals.css for non-Tailwind properties

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --gradient-hero: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
  --gradient-subtle: radial-gradient(ellipse at top, rgba(124,58,237,0.15), transparent);
  --blur-glass: blur(16px);
  --transition: all 0.2s ease;
}

body {
  background-color: #0a0a0f;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
}
```

### 3. Update component classes

Go through the user's main components and replace hardcoded color/spacing classes with the new ones. Focus on:
- `bg-*` → new background tokens
- `text-*` → new text tokens
- `border-*` → new border tokens
- `rounded-*` → new radius tokens

---

## Plain CSS / CSS Modules Projects

### 1. Create/update design tokens file

```css
/* styles/tokens.css or styles/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  /* Colors */
  --color-bg-page:     #0a0a0f;
  --color-bg-surface:  #13131a;
  --color-bg-elevated: #1a1a2e;
  --color-text:        #ffffff;
  --color-text-muted:  #a0a0b8;
  --color-brand:       #7c3aed;
  --color-brand-hover: #6d28d9;
  --color-border:      rgba(255, 255, 255, 0.08);

  /* Typography */
  --font-sans: 'Inter', sans-serif;
  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   20px;
  --text-xl:   24px;
  --text-2xl:  32px;
  --text-3xl:  48px;

  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Borders */
  --radius-sm:   6px;
  --radius-md:   12px;
  --radius-lg:   20px;
  --radius-pill: 9999px;

  /* Shadows & Effects */
  --shadow-card:  0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-glow:  0 0 24px rgba(124, 58, 237, 0.3);
  --blur-glass:   blur(16px);

  /* Gradients */
  --gradient-hero: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);

  /* Animation */
  --transition: all 0.2s ease;
}

body {
  background: var(--color-bg-page);
  color: var(--color-text);
  font-family: var(--font-sans);
  line-height: 1.5;
}
```

### 2. Update component styles

Replace hardcoded values with variables throughout component CSS files. Use find+replace for common patterns.

---

## styled-components / Emotion Projects

### 1. Update the theme object

```ts
// theme.ts
export const theme = {
  colors: {
    bg: {
      page:    '#0a0a0f',
      surface: '#13131a',
      elevated:'#1a1a2e',
    },
    text: {
      primary:  '#ffffff',
      muted:    '#a0a0b8',
    },
    brand: '#7c3aed',
    border:'rgba(255,255,255,0.08)',
  },
  fonts: {
    sans: "'Inter', sans-serif",
  },
  radii: {
    sm:   '6px',
    md:   '12px',
    lg:   '20px',
    pill: '9999px',
  },
  shadows: {
    card: '0 4px 24px rgba(0,0,0,0.4)',
    glow: '0 0 24px rgba(124,58,237,0.3)',
  },
  gradients: {
    hero: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
  },
  transitions: {
    default: 'all 0.2s ease',
  },
}
```

---

## Next.js / Nuxt Projects

These are usually Tailwind or CSS Modules under the hood — apply the appropriate guide above.

For Next.js specifically:
- Global styles: `app/globals.css` (App Router) or `styles/globals.css` (Pages Router)
- Tailwind config: `tailwind.config.ts` at root

---

## Component Priority Order

Apply the design in this order for maximum impact with minimum risk:

1. **Global background + text colors** — immediate transformation, zero breakage risk
2. **Font import + font-family** — single line change, huge visual impact
3. **Navigation/header** — most visible, sets the tone
4. **Cards & containers** — background, border, radius, shadow
5. **Buttons** — color, shape, hover state
6. **Form inputs** — background, border, focus ring
7. **Typography scale** — heading sizes and weights
8. **Special effects** — glass blur, gradients, glows (do these last, they're icing)

---

## Glassmorphism Effect (Common in Modern SaaS/AI Sites)

If the target site uses glass cards (common in dark AI/SaaS sites):

```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
```

In Tailwind:
```html
<div class="bg-white/5 backdrop-blur-md border border-white/8 rounded-xl">
```

Note: `backdrop-filter` requires the parent to NOT have `overflow: hidden` set on ancestors in some browsers. Flag this to the user if they see glass effects not working.

---

## Gradient Text (Popular in AI/Tech Sites)

```css
.gradient-text {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

In Tailwind (requires custom config or inline style):
```html
<span class="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">
```

---

## Checking Your Work

After applying, mentally walk through:
- [ ] Page background matches
- [ ] Primary text color matches
- [ ] Card/panel background and border match
- [ ] Primary button color + shape match
- [ ] Font family matches (check Chrome DevTools → Computed → font-family)
- [ ] Heading weight and size feel similar
- [ ] Any special effects (blur, gradient, glow) are present
- [ ] Hover transitions feel similar in speed/style
- [ ] Mobile layout feels similar (padding, stacking)
