# CSS Extraction Playbook

After scraping the raw HTML, extract the design tokens systematically. Work through these layers in order.

## Layer 1: CSS Custom Properties (The Jackpot)

Search the HTML for `:root` blocks — these are design systems that have done your work for you:

```html
<style>
  :root {
    --color-bg: #0a0a0f;
    --color-primary: #7c3aed;
    --font-sans: 'Inter', sans-serif;
    --radius: 12px;
  }
</style>
```

Grab every `--variable` and classify it: color, font, spacing, shadow, radius, animation.

## Layer 2: Font Imports

Look for `@import` at the top of `<style>` blocks and in `<link>` tags:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
```

Or within CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&display=swap');
```

Record the font families and the weights loaded — the weights tell you what's used (e.g., 300 = light body, 700 = bold headings).

## Layer 3: Tailwind Config (if site uses Tailwind)

Signs it's Tailwind: classes like `bg-purple-600`, `text-gray-200`, `rounded-xl`, `shadow-lg`, `backdrop-blur-md`.

If there's a custom Tailwind theme, it may appear as an inline script:
```html
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: { brand: '#7c3aed' }
      }
    }
  }
</script>
```

For standard Tailwind sites without custom config, use the visual screenshot to identify which Tailwind colors they're using, then replicate with the same class names.

## Layer 4: Repeated Class Patterns

Scan the HTML for repeated class combinations on similar elements. The pattern reveals the design system:

```html
<!-- Repeated card pattern -->
<div class="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm">

<!-- Repeated button pattern -->
<button class="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-full transition-all">
```

These patterns tell you the component-level design decisions even without explicit custom properties.

## Layer 5: Inline Styles & Gradients

Look for inline `style=""` attributes on hero sections, headers, and highlighted elements — these often contain the most intentional design choices:

```html
<section style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
<div style="background: radial-gradient(ellipse at top, rgba(124,58,237,0.15) 0%, transparent 60%);">
```

## Layer 6: Animation & Transition Patterns

Note CSS transitions and animations — they define the "feel" of the site:

```css
transition: all 0.2s ease;        /* snappy */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);  /* Material-style */
animation: fadeIn 0.6s ease forwards;  /* page load feel */
```

## When the HTML Comes Back Sparse (JS-Rendered Sites)

Signs: `<div id="root"></div>` with minimal content, or `<div id="__next">` with a loading spinner.

In this case:
1. Screenshot is still fully usable for visual analysis
2. Look for `<link>` tags pointing to external CSS files — note their paths even if you can't fetch them
3. Look for any `<script>` tags with inline config (Next.js/Nuxt often embed theme data)
4. Check for `<meta>` theme-color tags: `<meta name="theme-color" content="#7c3aed">`
5. Fall back to full visual extraction from the screenshot

## Output Format

Always output your extraction as a structured token map before writing any code:

```
EXTRACTED DESIGN TOKENS
========================
Source: https://example.com
Method: CSS custom properties + visual analysis

COLORS
  Background:
    page:    #0a0a0f
    surface: #13131a  (cards, panels)
    elevated:#1a1a2e  (modals, dropdowns)
  Text:
    primary: #ffffff
    secondary:#a0a0b8
    muted:   #606080
  Brand:
    primary: #7c3aed
    hover:   #6d28d9
    glow:    rgba(124,58,237,0.3)
  Border:   rgba(255,255,255,0.08)

TYPOGRAPHY
  Heading font: 'Inter', sans-serif (weights: 600, 700)
  Body font:    'Inter', sans-serif (weight: 400)
  Size scale:   12 / 14 / 16 / 20 / 24 / 32 / 48 / 64px
  Line height:  1.5 body / 1.2 headings

SPACING
  Base unit: 8px
  Scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 / 96px

BORDERS & EFFECTS
  Radius sm:  6px   (badges, inputs)
  Radius md:  12px  (cards)
  Radius lg:  20px  (modals, large containers)
  Radius pill: 9999px (buttons, tags)
  Shadow:     0 4px 24px rgba(0,0,0,0.4)
  Glass blur: backdrop-filter: blur(16px)

GRADIENTS
  Hero:    linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)
  Subtle:  radial-gradient(ellipse at top, rgba(124,58,237,0.15), transparent)

ANIMATIONS
  Transition: all 0.2s ease
  Hover scale: transform: scale(1.02)
```
