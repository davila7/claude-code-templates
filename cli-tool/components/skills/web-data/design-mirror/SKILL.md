---
name: design-mirror
description: "Replicate the visual style of any website and apply it to your existing codebase. Use this skill whenever the user wants to match a site's design, mirror a UI aesthetic, make their app look like another site, or replicate a specific visual style from a URL. Trigger on phrases like 'make it look like', 'match the design of', 'copy the style from', 'I want my app to look like X', 'mirror this design', 'inspired by [url]', or any time the user points at a website and says they want their frontend to match it."
---

# Design Mirror

Capture the visual design language of any website and apply it to your existing codebase — colors, typography, spacing, layout rhythm, component shapes, and overall aesthetic — all extracted live via Bright Data's Web Unlocker.

## What This Skill Does

1. **Capture** — Screenshot + HTML scrape the inspiration site via Bright Data
2. **Extract** — Identify the full design system: colors, fonts, spacing scale, border radii, shadows, component patterns
3. **Analyze** — Study the screenshot visually and the CSS structurally to understand the design language
4. **Apply** — Translate that design system into the user's existing codebase (their framework, their components)

You are not copying content or functionality. You're understanding the *design language* — the palette, the type scale, the card shapes, the hover states, the overall aesthetic feel.

> **Important:** This skill is for design inspiration and learning — extracting publicly visible design tokens (colors, fonts, spacing) to inform your own UI work. Always use it respectfully and in accordance with the terms of service of the sites you reference.

## Setup

Requires:
- `BRIGHTDATA_API_KEY` — from [brightdata.com/cp](https://brightdata.com/cp) → Account Settings
- `BRIGHTDATA_UNLOCKER_ZONE` — create an Unlocker zone at brightdata.com/cp

```bash
export BRIGHTDATA_API_KEY="your-api-key"
export BRIGHTDATA_UNLOCKER_ZONE="your-zone-name"
```

## Step-by-Step Process

### Step 1: Capture the Inspiration Site

Run both captures in parallel — screenshot (for visual analysis) and HTML scrape (for CSS extraction):

```bash
# Screenshot (save as PNG)
bash scripts/screenshot.sh "https://inspiration-site.com" "/tmp/target_screenshot.png"

# HTML + CSS scrape
bash scripts/scrape_html.sh "https://inspiration-site.com" "/tmp/target_page.html"
```

Read `references/capture-guide.md` for how to extract CSS from the raw HTML and handle common issues.

### Step 2: Analyze the Design System

After capturing, analyze both in parallel:

**Visual analysis (screenshot):** Read the PNG image and identify:
- Primary, secondary, accent colors
- Background colors (page bg, card bg, surface hierarchy)
- Typography: font families visible, size hierarchy (h1 → body → caption)
- Layout: is it centered/constrained-width? Grid? Sidebar?
- Card/container shapes: border radius size, shadow style (hard, soft, none, colored)
- Button styles: pill, rectangle, ghost, gradient?
- Navigation: sticky? Glass/blur effect? Dark or light?
- Overall mood: dark, light, minimal, brutalist, glassmorphism, corporate, startup?

**CSS analysis (HTML):** Extract from `<style>` tags and inline styles:
- CSS custom properties (`:root { --color-... }`) — publicly declared design tokens
- Font imports (`@import` from Google Fonts, etc.)
- Tailwind config if present
- Repeated class patterns that reveal the spacing scale

Read `references/css-extraction.md` for the extraction playbook.

### Step 3: Build the Design Token Map

Produce a structured design token map before touching any code:

```
DESIGN TOKENS FROM [site]
==========================
Colors:
  --bg-primary: #0a0a0f      (page background)
  --bg-surface: #13131a      (card/panel background)
  --text-primary: #ffffff
  --text-muted: #8888aa
  --accent: #7c3aed          (primary CTA color)
  --accent-hover: #6d28d9
  --border: rgba(255,255,255,0.08)

Typography:
  --font-heading: 'Inter', sans-serif
  --font-body: 'Inter', sans-serif
  font-scale: 12/14/16/20/24/32/48px
  heading-weight: 700
  body-weight: 400

Spacing:
  base-unit: 8px
  scale: 4/8/12/16/24/32/48/64px

Borders & Shadows:
  --radius-sm: 6px
  --radius-md: 12px
  --radius-lg: 20px
  --shadow: 0 4px 24px rgba(0,0,0,0.4)

Special effects:
  glass-blur: backdrop-filter: blur(16px)
  gradient: linear-gradient(135deg, #7c3aed, #2563eb)
```

Show this token map to the user before proceeding. It's the foundation — if it's wrong, the output will be wrong.

### Step 4: Understand the User's Codebase

Before writing any code, read the relevant parts of their codebase:

- What framework? (React, Vue, Next.js, plain HTML?)
- What styling approach? (Tailwind, CSS modules, styled-components, plain CSS?)
- Where are global styles defined? (globals.css, theme.ts, tailwind.config.js?)
- What components need restyling? (ask the user if unclear)

Do not rewrite everything — surgical precision. Apply the design tokens to the existing structure.

### Step 5: Apply the Design

The application strategy depends on their stack:

**If Tailwind:** Update `tailwind.config.js` with the new color palette, font family, border radius scale. Add custom CSS variables for anything Tailwind can't handle natively.

**If CSS/CSS Modules:** Create or update a `:root` variables block in globals.css. Update component stylesheets to use the new variables.

**If styled-components/Emotion:** Update the theme object. Replace hardcoded color/spacing values with theme tokens.

**In all cases:**
- Apply colors, typography, and spacing globally first
- Then tackle component-level details (buttons, cards, nav) one at a time
- Preserve all existing functionality and layout structure — only visual properties change
- Add any special effects (glass blur, gradients, animations) that define the inspiration site's character

Read `references/apply-guide.md` for framework-specific implementation patterns.

### Step 6: Show the Before/After

After applying changes, clearly present:
- Which files were modified
- The design token mapping (source → what you set it to)
- Any special effects added
- What the user should check visually (hover states, dark/light mode, mobile)

If the user has a dev server running, remind them to check it. Offer to iterate on specific components.

## Key Principles

**Design language, not markup.** The inspiration site's HTML structure and content are theirs. You're extracting the *design language* — how colors relate, how spacing flows, what gives the site its character — to apply as your own creative foundation.

**Design tokens first, code second.** Rushing to apply colors before understanding the full system leads to inconsistent results. Always build the token map first.

**Ask about scope.** "Apply the design everywhere" vs "just make the homepage feel like it" vs "only restyle the navbar" are very different jobs. Clarify before proceeding.

**Don't break what works.** The user's components work. Only change visual properties. If you're uncertain whether a change might break layout, err on the side of caution and flag it.

**Iterative is fine.** It's often better to get the foundation right (colors, type, spacing) and let the user review before tackling component-level details.

## What to Do When...

**The site uses a design system (Material, shadcn, etc.):** Identify it, tell the user, and ask if they want to adopt the same system or just extract the visual tokens.

**The CSS is minified/obfuscated:** Fall back to the screenshot + visual analysis. You can still extract colors, spacing, and shapes from visual inspection.

**The inspiration site is JS-rendered and the HTML scrape comes back mostly empty:** Note this to the user — the screenshot will still work for visual analysis, but CSS extraction will be limited. You can still infer most tokens visually.

**The user's codebase uses a component library (shadcn, Chakra, MUI):** Apply the design by customizing the library's theme/config rather than overriding individual components.

**Multiple pages need to match:** Use the homepage for overall design tokens, but offer to check inner pages (e.g., `/pricing`, `/docs`) if the user wants to match a specific page's look.
