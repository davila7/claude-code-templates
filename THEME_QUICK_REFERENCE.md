# Violet Theme - Quick Reference Card

## 🎨 Copy-Paste Ready Classes

### Card Component
```tsx
className="bg-[var(--color-surface-1)] border border-[var(--color-border)] 
  rounded-xl p-4
  hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-hover)]
  hover:shadow-[0_0_20px_rgba(124,92,255,0.15)] hover:-translate-y-0.5
  transition-all duration-200"
```

### Modal/Dropdown
```tsx
className="bg-[var(--color-surface-2)] border border-[var(--color-border-hover)]
  rounded-lg shadow-[0_0_30px_rgba(124,92,255,0.3)]"
```

### Primary Button
```tsx
className="px-4 py-2 rounded-lg
  bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF]
  hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(124,92,255,0.5)]
  transition-all text-white font-medium"
```

### Secondary Button
```tsx
className="px-4 py-2 rounded-lg
  bg-[var(--color-surface-2)] border border-[var(--color-border-hover)]
  hover:bg-[var(--color-surface-3)] hover:shadow-[0_0_15px_rgba(124,92,255,0.2)]
  transition-all text-[var(--color-text-primary)]"
```

### Input Field
```tsx
className="w-full px-3 py-2 rounded-lg
  bg-[var(--color-surface-0)] border border-[var(--color-border-hover)]
  text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
  focus:border-[var(--color-primary-500)]
  focus:shadow-[0_0_0_3px_rgba(124,92,255,0.1)]
  transition-all outline-none"
```

### List Item
```tsx
className="flex items-center gap-3 p-3 rounded-lg
  bg-[var(--color-surface-1)] border border-[var(--color-border)]
  hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-hover)]
  transition-all"
```

### Active/Selected State
```tsx
className="bg-[var(--color-surface-2)] border-[var(--color-primary-500)]
  shadow-[0_0_30px_rgba(124,92,255,0.4)]"
```

## 🎯 Color Variables

```css
/* Backgrounds */
var(--color-surface-0)  /* #0B0B12 - Deepest */
var(--color-surface-1)  /* #11111A - Cards */
var(--color-surface-2)  /* #1A1A26 - Hover */
var(--color-surface-3)  /* #202033 - Elevated */
var(--color-surface-4)  /* #2A2A40 - Highest */

/* Borders */
var(--color-border)       /* #1F1F2E - Subtle */
var(--color-border-hover) /* #2A2A3D - Interactive */

/* Text */
var(--color-text-primary)   /* #E5E7EB - Main */
var(--color-text-secondary) /* #9CA3AF - Secondary */
var(--color-text-tertiary)  /* #6B7280 - Muted */

/* Accents */
var(--color-primary-500) /* #7C5CFF - Violet */
var(--color-primary-400) /* #9277FF - Hover */
var(--color-accent-500)  /* #00E5FF - Cyan */

/* Status */
var(--color-success) /* #22C55E - Green */
var(--color-warning) /* #F59E0B - Amber */
var(--color-error)   /* #EF4444 - Red */
```

## ✨ Glow Shadows

```css
/* Subtle hover */
shadow-[0_0_20px_rgba(124,92,255,0.15)]

/* Medium interaction */
shadow-[0_0_20px_rgba(124,92,255,0.25)]

/* Strong (modals) */
shadow-[0_0_30px_rgba(124,92,255,0.3)]

/* Very strong (active) */
shadow-[0_0_40px_rgba(124,92,255,0.4)]

/* Button hover */
shadow-[0_0_20px_rgba(124,92,255,0.5)]
```

## 🎬 Animations

```css
/* Card hover */
hover:-translate-y-0.5

/* Button hover */
hover:-translate-y-1

/* Standard transition */
transition-all duration-200

/* Smooth transition */
transition-all
```

## 📐 Border Radius

```css
rounded-lg   /* 8px - Buttons, inputs */
rounded-xl   /* 12px - Cards, panels */
```

## 🚫 Never Use

```css
❌ #000, #000000, black
❌ #FFF, #FFFFFF, white
❌ shadow-xl, shadow-2xl (use colored glows)
❌ border-white, border-black
❌ High contrast borders (#333, #444)
```

## ✅ Always Use

```css
✅ CSS variables for colors
✅ Violet glows for shadows
✅ Soft whites for text (#E5E7EB)
✅ Layered backgrounds for depth
✅ Low-contrast borders
✅ Transform on hover
✅ Smooth transitions
```

## 🎨 Gradient Patterns

```css
/* Main gradient (buttons, headers) */
bg-gradient-to-br from-[#7C5CFF] to-[#00E5FF]

/* Alternative */
bg-gradient-to-r from-[#7C5CFF] to-[#00E5FF]

/* Subtle background */
bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-2)]
```

## 🔍 Focus States

```css
focus:border-[var(--color-primary-500)]
focus:shadow-[0_0_0_3px_rgba(124,92,255,0.1)]
focus:outline-none
```

## 💡 Pro Tips

1. **Layering**: Always use surface-0 → surface-1 → surface-2 for depth
2. **Glows**: Add violet glow to ANY interactive element
3. **Transforms**: Combine with glows for premium feel
4. **Borders**: Keep them subtle - let glows do the work
5. **Text**: Never pure white - always use text-primary variable
6. **Accents**: Use violet sparingly - only for active/important states

---

**Quick Test**: Does your component have:
- [ ] Violet-tinted background?
- [ ] Low-contrast border?
- [ ] Violet glow on hover?
- [ ] Transform on hover?
- [ ] Soft text colors?
- [ ] Smooth transition?

If yes to all → You're following the theme! 🎉
