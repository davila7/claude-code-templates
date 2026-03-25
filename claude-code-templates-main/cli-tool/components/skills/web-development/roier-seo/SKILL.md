---
name: roier-seo
description: Technical SEO auditor and fixer. Runs Lighthouse/PageSpeed audits on websites or local dev servers, analyzes SEO/performance/accessibility scores, and automatically implements fixes for meta tags, structured data, Core Web Vitals, and accessibility issues.
version: 1.0.0
author: Kemeny Studio
license: MIT
tags: [SEO, Lighthouse, PageSpeed, Accessibility, Performance, Meta Tags, Structured Data, Core Web Vitals, WCAG, Next.js, React, Vue]
dependencies: [lighthouse, chrome-launcher]
---

# Roier SEO - Technical SEO Auditor & Fixer

AI-powered SEO optimization skill that audits websites and automatically implements fixes.

## When to use this skill

**Use Roier SEO when:**
- User asks to "audit my site" or "check SEO"
- User wants to "improve performance" or "fix SEO issues"
- User mentions "lighthouse", "pagespeed", or "core web vitals"
- User wants to add/fix meta tags, structured data, or accessibility
- User has a local dev server and wants SEO analysis

**Key features:**
- **Full Audits**: Lighthouse audits on any URL (localhost or live)
- **Auto-Fix**: Implements fixes directly in the codebase
- **Framework Aware**: Detects Next.js, React, Vue, Nuxt, plain HTML
- **Core Web Vitals**: Track FCP, LCP, TBT, CLS metrics
- **Structured Data**: JSON-LD schemas for rich snippets
- **Accessibility**: WCAG compliance fixes

**Use alternatives instead:**
- **React Best Practices**: For general React performance optimization
- **Manual Lighthouse**: For one-off audits without auto-fixing

## Quick start

### Installation

After installing the skill, install the audit dependencies:

```bash
cd ~/.claude/skills/roier-seo/scripts
npm install
```

### Running an Audit

For a **live website**:
```bash
node ~/.claude/skills/roier-seo/scripts/audit.js https://example.com
```

For a **local dev server** (must be running):
```bash
node ~/.claude/skills/roier-seo/scripts/audit.js http://localhost:3000
```

Output formats:
```bash
# JSON output (default, for programmatic use)
node ~/.claude/skills/roier-seo/scripts/audit.js https://example.com

# Human-readable summary
node ~/.claude/skills/roier-seo/scripts/audit.js https://example.com --output=summary

# Save to file
node ~/.claude/skills/roier-seo/scripts/audit.js https://example.com --save=results.json
```

## Audit categories

The audit returns scores (0-100) for five categories:

| Category | Description | Weight |
|----------|-------------|--------|
| **Performance** | Page load speed, Core Web Vitals | High |
| **Accessibility** | WCAG compliance, screen reader support | High |
| **Best Practices** | Security, modern web standards | Medium |
| **SEO** | Search engine optimization, crawlability | High |
| **PWA** | Progressive Web App compliance | Low |

## Technical SEO fix patterns

### Meta tags (HTML Head)

#### Title tag
```html
<!-- Bad -->
<title>Home</title>

<!-- Good -->
<title>Primary Keyword - Secondary Keyword | Brand Name</title>
```

**Rules:**
- 50-60 characters max
- Include primary keyword near the beginning
- Unique per page
- Include brand name at end

#### Meta description
```html
<meta name="description" content="Compelling description with keywords. 150-160 characters that encourages clicks from search results.">
```

**Rules:**
- 150-160 characters
- Include primary and secondary keywords naturally
- Compelling call-to-action
- Unique per page

#### Essential meta tags
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<html lang="en">
```

### Open Graph tags (social sharing)

```html
<meta property="og:title" content="Page Title">
<meta property="og:description" content="Page description">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Brand Name">
```

### Twitter Card tags

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page Title">
<meta name="twitter:description" content="Page description">
<meta name="twitter:image" content="https://example.com/image.jpg">
```

### Canonical URL

```html
<link rel="canonical" href="https://example.com/canonical-page">
```

### Robots meta

```html
<!-- Allow indexing (default) -->
<meta name="robots" content="index, follow">

<!-- Prevent indexing (for staging, admin pages) -->
<meta name="robots" content="noindex, nofollow">
```

## Structured data (JSON-LD)

### Website schema
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Site Name",
  "url": "https://example.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://example.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

### Organization schema
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Company Name",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/company",
    "https://linkedin.com/company/company"
  ]
}
</script>
```

### BreadcrumbList schema
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com"},
    {"@type": "ListItem", "position": 2, "name": "Category", "item": "https://example.com/category"},
    {"@type": "ListItem", "position": 3, "name": "Page"}
  ]
}
</script>
```

### Article schema (for blog posts)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": {"@type": "Person", "name": "Author Name"},
  "datePublished": "2024-01-15",
  "dateModified": "2024-01-20",
  "image": "https://example.com/article-image.jpg",
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name",
    "logo": {"@type": "ImageObject", "url": "https://example.com/logo.png"}
  }
}
</script>
```

## Performance optimizations

### Image optimization

```html
<!-- Add width/height to prevent CLS -->
<img src="image.jpg" alt="Description" width="800" height="600">

<!-- Add lazy loading -->
<img src="image.jpg" alt="Description" loading="lazy">

<!-- Use modern formats -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

### Font optimization

```html
<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
```

```css
@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
}
```

### Resource hints

```html
<!-- Preconnect to critical third-party origins -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://cdn.example.com">

<!-- DNS prefetch for non-critical origins -->
<link rel="dns-prefetch" href="https://analytics.example.com">

<!-- Preload critical resources -->
<link rel="preload" href="/critical.css" as="style">
```

## Accessibility fixes

### Alt text
```html
<!-- Good (descriptive) -->
<img src="photo.jpg" alt="Team members collaborating in the office">

<!-- Good (decorative) -->
<img src="decoration.jpg" alt="" role="presentation">
```

### Color contrast
- **4.5:1** contrast ratio for normal text
- **3:1** contrast ratio for large text (18px+ or 14px+ bold)

### Form labels
```html
<label for="email">Email Address</label>
<input type="email" id="email" name="email">
```

### Skip link
```html
<a href="#main-content" class="skip-link">Skip to main content</a>

<style>
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 0;
  top: 0;
  z-index: 9999;
  background: #000;
  color: #fff;
  padding: 8px 16px;
}
</style>
```

### Button accessibility
```html
<!-- Icon button needs aria-label -->
<button aria-label="Close menu">
  <svg>...</svg>
</button>
```

## Framework-specific patterns

### Next.js (App Router)

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Site Name',
    template: '%s | Site Name'
  },
  description: 'Site description',
  openGraph: {
    title: 'Site Name',
    description: 'Site description',
    url: 'https://example.com',
    siteName: 'Site Name',
    type: 'website',
  },
}
```

### Next.js (Pages Router)

```jsx
import Head from 'next/head';

export default function Page() {
  return (
    <>
      <Head>
        <title>Page Title | Brand</title>
        <meta name="description" content="Page description" />
        <link rel="canonical" href="https://example.com/page" />
      </Head>
      <main>...</main>
    </>
  );
}
```

### React (with react-helmet)

```jsx
import { Helmet } from 'react-helmet';

function Page() {
  return (
    <>
      <Helmet>
        <title>Page Title | Brand</title>
        <meta name="description" content="Page description" />
      </Helmet>
      <main>...</main>
    </>
  );
}
```

### Vue.js (with useHead)

```vue
<script setup>
useHead({
  title: 'Page Title | Brand',
  meta: [
    { name: 'description', content: 'Page description' }
  ],
  link: [
    { rel: 'canonical', href: 'https://example.com/page' }
  ]
})
</script>
```

### Nuxt.js

```vue
<script setup>
useSeoMeta({
  title: 'Page Title | Brand',
  description: 'Page description',
  ogTitle: 'Page Title',
  ogDescription: 'Page description',
  ogImage: 'https://example.com/og-image.jpg'
})
</script>
```

## Workflow

### Step 1: Audit
Run the audit script on the target URL:
```bash
node ~/.claude/skills/roier-seo/scripts/audit.js <URL>
```

### Step 2: Identify framework
Check `package.json` dependencies and framework-specific files.

### Step 3: Prioritize fixes
1. **Critical** (red): Fix immediately
2. **Serious** (orange): Fix soon
3. **Moderate** (yellow): Fix when possible
4. **Minor** (gray): Nice to have

### Step 4: Implement
Use the fix patterns above, adapted to the user's framework.

### Step 5: Re-audit
Run the audit again to verify improvements.

## Requirements

- **Node.js 18+**
- **Chrome/Chromium** browser (for Lighthouse)
- Audit script dependencies (installed via npm)

## Resources

- [Google Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Schema.org](https://schema.org/)
- [WCAG Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [Core Web Vitals](https://web.dev/vitals/)

## Version history

**v1.0.0** (January 2026)
- Initial release
- Lighthouse audit integration
- 50+ SEO fix patterns
- Framework support for Next.js, React, Vue, Nuxt
