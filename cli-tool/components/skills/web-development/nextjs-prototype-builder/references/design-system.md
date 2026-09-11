# Design System Reference

This skill supports two theme variants: **Dark** (default) and **Light**. Both use the same glassmorphism architecture, animations, and component structure — only the color tokens and surface treatments differ.

## Theme Selection

Choose based on context:
- **Dark** — Data-dense dashboards, command centers, monitoring tools, developer-facing UIs
- **Light** — Healthcare, consumer-facing, collaborative tools, forms-heavy workflows

The scaffold script accepts `--theme dark` or `--theme light`.

---

## Dark Theme

### CSS Custom Properties

```css
:root {
  --sidebar-bg: #07090f;
  --bg: #0c1017;
  --card: #141a25;
  --card-hover: #1a2235;
  --hover: rgba(255, 255, 255, 0.04);
  --input-bg: rgba(255, 255, 255, 0.03);
  --border: rgba(255, 255, 255, 0.06);
  --radius: 10px;
  --glow-cyan: rgba(34, 211, 238, 0.08);
  --glow-violet: rgba(167, 139, 250, 0.08);
}
```

### Surface Color Palette (Tailwind)

| Token | Hex | Usage |
|-------|-----|-------|
| `surface-0` | `#04060c` | Deepest background |
| `surface-1` | `#07090f` | Sidebar, header |
| `surface-2` | `#0c1017` | Main content bg |
| `surface-3` | `#141a25` | Card backgrounds |
| `surface-4` | `#1a2235` | Card hover states |

### Glassmorphism

```css
.glass {
  background: linear-gradient(135deg, rgba(20, 26, 37, 0.8), rgba(20, 26, 37, 0.6));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.glass-hover:hover {
  background: linear-gradient(135deg, rgba(26, 34, 53, 0.9), rgba(26, 34, 53, 0.7));
  border-color: rgba(255, 255, 255, 0.1);
}
```

### Glow Accents

```css
.glow-cyan    { box-shadow: 0 0 24px -4px rgba(34, 211, 238, 0.15), inset 0 1px 0 rgba(34, 211, 238, 0.06); }
.glow-emerald { box-shadow: 0 0 24px -4px rgba(52, 211, 153, 0.15), inset 0 1px 0 rgba(52, 211, 153, 0.06); }
.glow-violet  { box-shadow: 0 0 24px -4px rgba(167, 139, 250, 0.15), inset 0 1px 0 rgba(167, 139, 250, 0.06); }
.glow-amber   { box-shadow: 0 0 24px -4px rgba(251, 191, 36, 0.12), inset 0 1px 0 rgba(251, 191, 36, 0.05); }
```

### Background Mesh

```css
.bg-mesh {
  background:
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(34, 211, 238, 0.04) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 60%, rgba(167, 139, 250, 0.03) 0%, transparent 70%);
}
```

### Badge Styles

```ts
export const badgeStyles: Record<string, string> = {
  info: 'bg-blue-400/10 text-blue-400',
  success: 'bg-emerald-400/10 text-emerald-400',
  warning: 'bg-amber-400/10 text-amber-400',
  error: 'bg-red-400/10 text-red-400',
  primary: 'bg-cyan-400/10 text-cyan-400',
  purple: 'bg-violet-400/10 text-violet-400',
  orange: 'bg-orange-400/10 text-orange-400',
  muted: 'bg-white/[0.04] text-slate-500',
}
```

### Text Hierarchy

| Role | Class | Example |
|------|-------|---------|
| Primary | `text-slate-200` | Headings, names, values |
| Secondary | `text-slate-400` | Descriptions, labels |
| Muted | `text-slate-600` | Timestamps, meta info |
| Accent | `text-cyan-400` | Links, active states |

### Borders & Dividers

- Section borders: `border-white/[0.06]`
- Table row borders: `border-white/[0.03]` or `border-white/[0.04]`
- Dividers: `divide-white/[0.04]`
- Hover borders: `border-white/[0.1]`

### Scrollbar

```css
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.06); }
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.12); }
```

### Body Class

```tsx
<body className="font-sans bg-surface-2 text-slate-200 h-screen overflow-hidden">
```

---

## Light Theme

### CSS Custom Properties

```css
:root {
  --sidebar-bg: #f9fafb;
  --bg: #f3f4f6;
  --card: #ffffff;
  --card-hover: #fafbfc;
  --hover: rgba(0, 0, 0, 0.015);
  --input-bg: rgba(0, 0, 0, 0.02);
  --border: rgba(0, 0, 0, 0.07);
  --radius: 10px;
  --glow-cyan: rgba(59, 130, 246, 0.08);
  --glow-violet: rgba(139, 92, 246, 0.08);
}
```

### Surface Color Palette (Tailwind)

| Token | Hex | Usage |
|-------|-----|-------|
| `surface-0` | `#ffffff` | Card backgrounds |
| `surface-1` | `#f9fafb` | Sidebar, header |
| `surface-2` | `#f3f4f6` | Main content bg |
| `surface-3` | `#e5e7eb` | Muted backgrounds |
| `surface-4` | `#d1d5db` | Borders, track fills |

### Glassmorphism

```css
.glass {
  background: linear-gradient(168deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(248, 250, 252, 0.8) 100%);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.03),
    0 4px 16px -2px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.glass-hover:hover {
  background: linear-gradient(168deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 255, 255, 0.92) 50%,
    rgba(250, 251, 252, 0.88) 100%);
  border-color: rgba(0, 0, 0, 0.09);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px -4px rgba(0, 0, 0, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
```

**Key difference:** Light glass uses `inset 0 1px 0 rgba(255,255,255,0.8)` for a subtle top-edge highlight that creates depth on white-on-gray backgrounds. The gradient is asymmetric (168deg) for a more natural feel.

### Glow Accents

```css
.glow-cyan {
  box-shadow:
    0 2px 16px -4px rgba(59, 130, 246, 0.14),
    0 0 0 1px rgba(59, 130, 246, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.glow-emerald {
  box-shadow:
    0 2px 16px -4px rgba(16, 185, 129, 0.14),
    0 0 0 1px rgba(16, 185, 129, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.glow-violet {
  box-shadow:
    0 2px 16px -4px rgba(139, 92, 246, 0.14),
    0 0 0 1px rgba(139, 92, 246, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.glow-amber {
  box-shadow:
    0 2px 16px -4px rgba(245, 158, 11, 0.12),
    0 0 0 1px rgba(245, 158, 11, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

**Key difference:** Light glows use subtle colored ring (`0 0 0 1px`) for definition, plus the white inner highlight. Opacity values are moderate (0.14) — strong enough to see on white/gray but not garish.

### Background Mesh

```css
.bg-mesh {
  background-color: #f3f4f6;
  background-image:
    radial-gradient(ellipse 80% 60% at 15% 30%, rgba(59, 130, 246, 0.04) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 85% 70%, rgba(139, 92, 246, 0.03) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16, 185, 129, 0.02) 0%, transparent 50%);
}
```

**Key difference:** Light mesh uses 3 color radials (blue + violet + a hint of emerald) for warmer atmosphere. Must set `background-color` explicitly since light theme can't rely on body color bleeding through.

### Badge Styles

```ts
export const badgeStyles: Record<string, string> = {
  info: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/40',
  success: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/40',
  warning: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/40',
  error: 'bg-red-50 text-red-600 ring-1 ring-red-200/40',
  primary: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/40',
  purple: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200/40',
  orange: 'bg-orange-50 text-orange-600 ring-1 ring-orange-200/40',
  muted: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/50',
}
```

**Key difference:** Light badges use `bg-{color}-50 text-{color}-600` with a subtle `ring-1 ring-{color}-200/40` border for crisp edges against white backgrounds.

### Text Hierarchy

| Role | Class | Example |
|------|-------|---------|
| Primary | `text-slate-800` | Headings, names, values |
| Secondary | `text-slate-500` | Descriptions, labels |
| Muted | `text-slate-400` | Timestamps, meta info |
| Accent | `text-blue-600` | Links, active states |

### Borders & Dividers

- Section borders: `border-slate-200` or `border-slate-200/80`
- Table row borders: `border-slate-200/80`
- Dividers: `divide-slate-200`
- Hover borders: `border-slate-300`

### Scrollbar

```css
::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.14); }
::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.22); }
```

### Body Class

```tsx
<body className="font-sans bg-surface-2 text-slate-800 h-screen overflow-hidden">
```

### Card Shine

```css
/* Light theme uses slightly more opaque sweep */
.card-shine::before {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### KPI Glow Text

```css
/* Dark theme uses text-shadow for glow */
.kpi-glow { text-shadow: 0 0 40px rgba(34, 211, 238, 0.2); }

/* Light theme disables text-shadow (values are already dark on light) */
.kpi-glow { text-shadow: none; }
```

---

## Dark-to-Light Conversion Cheat Sheet

When converting an existing dark prototype to light, apply these systematic replacements:

| Dark Pattern | Light Replacement |
|---|---|
| `text-slate-200` | `text-slate-800` |
| `text-slate-300` | `text-slate-700` |
| `text-slate-400` | `text-slate-600` |
| `text-slate-600` | `text-slate-400` |
| `text-slate-700` | `text-slate-300` |
| `bg-white/[0.02]` | `bg-slate-100/50` |
| `bg-white/[0.03]` | `bg-slate-100` |
| `bg-white/[0.04]` | `bg-slate-200/60` |
| `border-white/[0.04]` | `border-slate-200/80` |
| `border-white/[0.05]` | `border-slate-200` |
| `border-white/[0.06]` | `border-slate-200` |
| `border-white/[0.08]` | `border-slate-300` |
| `divide-white/[0.04]` | `divide-slate-200` |
| `shadow-black/60` | `shadow-slate-300/40` |
| `bg-black/60` | `bg-black/30` |
| `bg-{color}-400/10` | `bg-{color}-50` |
| `text-{color}-400` | `text-{color}-600` |
| `border-{color}-400/20` | `border-{color}-200` |
| `hover:bg-white/[0.02]` | `hover:bg-slate-50` |
| `hover:bg-white/[0.03]` | `hover:bg-slate-100` |

**Leave unchanged:** Gradient classes, solid dot/bar colors (`bg-emerald-400`, etc.), and `text-slate-500`.

---

## Shared (Both Themes)

### Font Stack

```ts
fontFamily: {
  sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-jetbrains)', 'monospace'],
  display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
}
```

### Typography Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-[0.5rem]` | 8px | Tiny badges |
| `text-[0.55rem]` | 8.8px | Keyboard shortcuts |
| `text-[0.58rem]` | 9.3px | Section headers, micro labels |
| `text-[0.62rem]` | 9.9px | Table headers, timestamps |
| `text-[0.65rem]` | 10.4px | Helper text |
| `text-[0.68rem]` | 10.9px | Badges, KPI labels, trend pills |
| `text-[0.72rem]` | 11.5px | Buttons, links |
| `text-[0.78rem]` | 12.5px | Search results, notification titles |
| `text-[0.82rem]` | 13.1px | Nav items, table cells |
| `text-[0.88rem]` | 14.1px | Search input, tour titles |
| `text-[0.95rem]` | 15.2px | Page titles |
| `text-[1.85rem]` | 29.6px | KPI hero values |

### Animations (12 keyframes)

All defined in `globals.css` and shared across both themes:

| Keyframe | Duration | Utility Class | Usage |
|----------|----------|---------------|-------|
| `pulse-dot` | 1.5s ∞ | `.animate-pulse-dot` | Status dots, live indicators |
| `typing` | 1.4s ∞ | `.typing-dot` | Chat typing indicator (3 dots) |
| `fadeIn` | 0.4s | `.animate-fade-in` | General element entrance |
| `slideInRight` | 0.3s | `.animate-slide-in` | Side panel entrances |
| `scaleIn` | 0.3s | `.animate-scale-in` | Modals, palettes |
| `shimmer` | — | — | Loading skeleton |
| `glow-pulse` | 3s ∞ | `.animate-glow` | Subtle card glow breathing |
| `flow-dot` | 2s ∞ | — | Pipeline connector dot animation |
| `countUp` | 0.5s | `.animate-count` | KPI value entrance |
| `tourIn` | 0.25s | `.animate-tour-in` | Tour tooltip entrance |
| `pulseRing` | 2s ∞ | `.animate-pulse-ring` | Tour spotlight ring |

### Stagger Pattern

```html
<div class="stagger">
  <!-- Child 1: 0.02s delay -->
  <!-- Child 2: 0.06s delay -->
  <!-- ... up to child 8: 0.30s delay -->
</div>
```

### Card Effects

Both themes use `.card-shine` for the hover sweep, `.bar-animate` for chart transitions, and `.status-ring-*` for active indicators.

### Selection Color

```css
/* Dark */
::selection { background: rgba(34, 211, 238, 0.25); }

/* Light */
::selection { background: rgba(59, 130, 246, 0.15); color: #1e3a5f; }
```
