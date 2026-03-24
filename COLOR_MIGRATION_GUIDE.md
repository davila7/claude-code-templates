# Color Migration Guide - Violet Theme

## Quick Reference: Old → New

### Background Colors
```
#000, #0a0a0a, #0B0B0C → var(--color-surface-0)
#111, #11111a, #111111 → var(--color-surface-1)
#151515, #1a1a1a, #1A1A26 → var(--color-surface-2)
#1f1f1f, #202033 → var(--color-surface-3)
#222, #2a2a2a, #2A2A40 → var(--color-surface-4)
```

### Border Colors
```
#1f1f1f, #1a1a1a → var(--color-border)
#222, #2a2a2a, #333 → var(--color-border-hover)
```

### Text Colors
```
#ededed, #fff, white → var(--color-text-primary) or #E5E7EB
#a1a1a1, #999, #aaa → var(--color-text-secondary) or #9CA3AF
#666, #555, #444 → var(--color-text-tertiary) or #6B7280
```

### Accent Colors
```
Purple/Blue accents → var(--color-primary-500) or #7C5CFF
Hover states → var(--color-primary-400) or #9277FF
Cyan highlights → var(--color-accent-500) or #00E5FF
```

### Status Colors
```
Green/Success → var(--color-success) or #22C55E
Warning/Amber → var(--color-warning) or #F59E0B
Error/Red → var(--color-error) or #EF4444
```

## Shadow Replacements

### Old Black Shadows
```css
shadow-xl, shadow-2xl
```

### New Violet Glows
```css
/* Subtle glow */
shadow-[0_0_20px_rgba(124,92,255,0.15)]

/* Medium glow */
shadow-[0_0_20px_rgba(124,92,255,0.25)]

/* Strong glow (modals, active states) */
shadow-[0_0_30px_rgba(124,92,255,0.3)]

/* Very strong (focus, selected) */
shadow-[0_0_40px_rgba(124,92,255,0.4)]
```

## Hover Effects

### Add These to Interactive Elements
```css
/* Cards, buttons */
hover:-translate-y-0.5
hover:shadow-[0_0_20px_rgba(124,92,255,0.15)]

/* Buttons */
hover:-translate-y-1
hover:shadow-[0_0_20px_rgba(124,92,255,0.5)]
```

## Component-Specific Patterns

### Cards
```tsx
className="bg-[var(--color-surface-1)] border border-[var(--color-border)] 
  hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-hover)]
  hover:shadow-[0_0_20px_rgba(124,92,255,0.15)] hover:-translate-y-0.5
  transition-all duration-200 rounded-xl"
```

### Modals/Dropdowns
```tsx
className="bg-[var(--color-surface-2)] border border-[var(--color-border-hover)]
  shadow-[0_0_30px_rgba(124,92,255,0.3)] rounded-lg"
```

### Inputs
```tsx
className="bg-[var(--color-surface-0)] border border-[var(--color-border-hover)]
  focus:border-[var(--color-primary-500)]
  focus:shadow-[0_0_0_3px_rgba(124,92,255,0.1)]
  transition-all"
```

### Buttons (Primary)
```tsx
className="bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF]
  hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(124,92,255,0.5)]
  transition-all"
```

## Files Updated ✅

- [x] dashboard/src/styles/global.css (Core theme)
- [x] dashboard/src/components/ComponentGrid.tsx
- [x] dashboard/src/components/TrendingView.tsx (partial)
- [x] dashboard/src/components/SaveToCollectionButton.tsx
- [x] dashboard/src/components/SendToRepoModal.tsx
- [x] dashboard/src/components/MyComponentsView.tsx
- [x] dashboard/src/components/JobsPreview.tsx
- [x] dashboard/src/components/JobsView.tsx (partial)
- [x] dashboard/src/components/AuthButton.tsx
- [x] dashboard/src/components/CartSidebar.tsx

## Files Needing Text Color Updates 🔄

These files have hardcoded text colors (#666, #555, #ededed, etc.) that should use CSS variables:

- [ ] dashboard/src/components/TrendingView.tsx (text colors)
- [ ] dashboard/src/components/JobsView.tsx (text colors)
- [ ] dashboard/src/components/JobsPreview.tsx (text colors)
- [ ] dashboard/src/components/JsonViewer.tsx
- [ ] dashboard/src/pages/**/*.astro

## Batch Replace Patterns

Use these find/replace patterns (carefully, one at a time):

```
Find: text-\[#ededed\]
Replace: text-[var(--color-text-primary)]

Find: text-\[#a1a1a1\]
Replace: text-[var(--color-text-secondary)]

Find: text-\[#999\]
Replace: text-[var(--color-text-secondary)]

Find: text-\[#666\]
Replace: text-[var(--color-text-tertiary)]

Find: text-\[#555\]
Replace: text-[var(--color-text-tertiary)]

Find: text-\[#444\]
Replace: text-[var(--color-text-tertiary)]
```

## Testing Checklist

After migration, test:
- [ ] All cards have violet glow on hover
- [ ] Modals have proper violet shadows
- [ ] Text is readable (not too bright)
- [ ] Borders are subtle but visible
- [ ] Focus states show violet ring
- [ ] Buttons have gradient and glow
- [ ] No pure black (#000) or pure white (#FFF)
- [ ] Layered backgrounds create depth
