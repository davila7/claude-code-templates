# Building a Blog: Technical & SEO Requirements

Universal technical specification for adding a blog to a Next.js + Sanity website. Opinionated, concise, decision-ready. Suitable for a corporate blog with organic-search-first traffic and optional AI authoring with human review.

**How to use this document.** Walk §0 with the user first. The answers populate §1 (Project Profile). §2–§20 are the universal spec — they read from §1 and never need editing per project. §21 is the pass/fail checklist. Appendices A and B record deferred decisions and deliberate non-features.

**Treat library specifics as guidance, not gospel.** This spec was audited against a fixed point in time. Next.js, Sanity, next-intl, `@sanity/image-url`, `@portabletext/react`, and the Gemini image API all ship breaking changes faster than this file is updated. Before implementing each section that touches one of those libraries, pull the latest docs (via `context7` if available, otherwise `WebFetch` on the official docs site) and let upstream win on conflicts. Specifically re-verify:

- §3, §6 — Sanity schema syntax, `defineType`/`defineField`/`defineQuery`, `next-sanity` client options, draft mode + `stega` rules
- §7 — `generateMetadata`, dynamic `params` shape in current Next.js major (sync vs `Promise`), `alternates.languages` format
- §7, §9 — Google's [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article) and [FAQPage](https://developers.google.com/search/docs/appearance/structured-data/faqpage) required fields
- §9 — `@portabletext/react` component override API and plugin packages
- §14 — `web.dev` CWV thresholds for current LCP/INP/CLS "good" cutoffs
- §17 — current GA4 / Plausible / Fathom snippet and consent integration
- §20 — Gemini image model name, endpoint, supported sizes/aspect ratios, response schema

If something in §2–§20 contradicts the docs you just read, the docs win. Record the contradiction in §1 under "Approved overrides".

---

## §0. Intake Questionnaire

Run this section interactively before any implementation work. The companion `SKILL.md` describes how to present the questions (`AskUserQuestion` in Claude Code, numbered plain text in Codex / CLIs without an interactive picker, assumed-defaults-with-disclosure when fully headless).

**Order of operations:**

1. Scan the host project first (see SKILL.md Step 1). Note what's already in place and pre-fill any answer you can.
2. Ask the questions below in the grouped order. **Skip questions answered by the scan**; surface the detected value and ask the user only to confirm.
3. Write the resolved answers into §1.
4. Produce the high-level plan (template at the end of §0). Wait for explicit approval before coding.

### Questionnaire — 40 questions in 12 groups

#### A. Project identity (5)

A1. **Project / brand name** — used in JSON-LD `publisher`, OG `site_name`, and copy.
A2. **Primary domain** — canonical host, no protocol (e.g. `example.com`). Used for absolute canonical URLs, sitemap entries, and OG tags.
A3. **Site purpose in one sentence** — drives editorial voice and hero image direction.
A4. **Publisher logo asset** — file path or "deferred to designer". JSON-LD `publisher.logo` requires a URL; missing logos block the BlogPosting schema.
A5. **Site type confirmation** — corporate / promo blog (this spec), news publisher (use a different spec), docs site (use a different spec).

#### B. Internationalization (4)

B1. **Locale set** — single locale or multiple? If multiple, list them as BCP-47 codes (`en`, `fr`, `de`, `es`, etc.).
B2. **Primary locale** — used as `x-default` in hreflang, used as fallback when the root path needs a redirect target.
B3. **Locale prefix rule** — always present (`/en/...`, `/fr/...`) recommended, or root-default (English at `/...`, others at `/fr/...`)? *Strong default: always present.* Root-default creates duplicate-content risk between `/` and `/en/`.
B4. **Translation linkage** — should the same article in different locales be cross-linked (translation graph with `translationOf` references) or treated as fully independent documents? *Strong default: independent.* Cross-linking pulls in `@sanity/document-internationalization` and post-level hreflang complexity.

#### C. Content model & taxonomy (6)

C1. **Author model** — single fixed string per post (lowest effort) / author entity with `name` only (recommended baseline) / full author entity with bio + photo + social links (heavier; only if you actually publish per-author pages).
C2. **Number of categories** — 5 to 10 is the sweet spot. Below 5 makes filtering pointless; above 10 fragments thin archives.
C3. **Category list** — provide names now, or defer to implementation? If deferred, hold a placeholder in §1.
C4. **Category editability** — locked at launch, or editable later via Studio? *Recommended: editable.*
C5. **Tags** — include or exclude? *Strong default: exclude.* Tags create thin archive pages and governance overhead at this scale.
C6. **Body block types** — confirm the allowed list. Defaults: H2/H3/H4, lists, blockquote, inline marks, links, images with alt, FAQ block, tables. Off by default: code blocks, video embeds, pull quotes, downloadable files, custom HTML.

#### D. Routing & URLs (3)

D1. **URL shape** — flat `/[locale]/blog/[slug]` (recommended) vs. dated `/blog/YYYY/MM/[slug]` vs. categorized `/blog/[category]/[slug]`. Flat avoids future recategorization redirect debt.
D2. **Slug strategy** — locale-specific slugs (recommended for multilingual) or shared slug across locales (simpler but worse for FR/DE/ES SEO).
D3. **Trailing slash and case rule** — default: no trailing slashes, lowercase only. Confirm or override.

#### E. Listing & article page (5)

E1. **Posts per listing page** — default 12. Mobile-first layouts often look better at 9.
E2. **Featured post** — automatic newest-first hero card on page 1 only (recommended) or editorial "featured" flag in CMS?
E3. **Pagination style** — numbered pages (recommended) vs. "Load more" with URL update vs. infinite scroll. Infinite scroll harms SEO.
E4. **ToC threshold** — show table of contents only when post has ≥N H2 headings AND ≥M words. Defaults: ≥4 H2 and ≥1000 words.
E5. **Related-posts logic** — same-category newest-first with latest-from-anywhere fallback (recommended) or manual curation in CMS?

#### F. SEO surface (4)

F1. **Structured-data scope** — emit `BlogPosting` + `BreadcrumbList` on every post + `FAQPage` when an FAQ block exists. Confirm. Any other schemas needed (`HowTo`, `Recipe`, `VideoObject`)?
F2. **OG image strategy** — reuse hero image cropped to 1200×630 via Sanity image URL (recommended) or a separate `ogImage` field per post.
F3. **RSS / Atom feed format** — Atom 1.0 per locale (recommended, stricter spec, better i18n) or RSS 2.0.
F4. **Sitemap structure** — single `sitemap.ts` route until ~50k URLs (recommended), or sitemap index from day one.

#### G. Performance & assets (4)

G1. **Core Web Vitals targets** — accept defaults (LCP <2.0s, INP <150ms, CLS <0.05, TTFB <600ms) or relax to the Google "good" baseline?
G2. **Hero image source** — AI-generated via Gemini 3 Pro Image / Nano Banana Pro (use `blog-image-style-guide.md`) / stock photography / designer-supplied / mixed.
G3. **Image format opt-in** — confirm an approved override to set `images.formats = ['image/avif', 'image/webp']` in `next.config.ts`. AVIF saves 20–30% on hero LCP. If CLAUDE.md forbids `next.config.ts` edits, this needs explicit approval.
G4. **Body font and display font** — reuse the site's existing `next/font` configuration (recommended) or add new fonts? Confirm subsets — `latin` is required, `latin-ext` is required for FR/DE/ES.

#### H. Analytics & consent (2)

H1. **Analytics tool** — Matomo / Plausible / Fathom / GA4 / Posthog / Umami / none. Self-hosted vs. SaaS.
H2. **Consent model** — cookieless tool (no banner required) / consent-gated (load only after the visitor accepts cookies via the existing site-wide gate) / no consent gate (only legal in jurisdictions where the tool is genuinely cookieless and exempt). The blog inherits the site-wide consent gate — do not re-implement it in blog routes.

#### I. Content authoring & workflow (3)

I1. **Studio hosting** — Sanity Studio deployed to `*.sanity.studio` (recommended; clean separation) vs. embedded under `/studio` in the Next.js app.
I2. **Draft preview** — `@sanity/presentation` with Sanity-login auth (recommended for human review workflows; required if editors want to preview unpublished drafts) vs. none (drafts only visible inside Studio).
I3. **Scheduled publishing** — required at launch, deferred to later, or never? Sanity has community plugins for it.

#### J. AI-generated hero images (3)

J1. **In scope at launch?** — yes / no / phase 2. If "no", skip §20.
J2. **Model preference** — `gemini-3-pro-image-preview` (best instruction following, ~$0.24/image) / `gemini-2.5-flash-image` (~$0.04, lower adherence) / `imagen-4.0-ultra-generate-001` (best photoreal, weaker instruction following). Default: Pro.
J3. **Repo asset copy** — also commit a copy under `public/images/blog/<slug>.jpg` for git history (recommended) or rely solely on Sanity CDN.

#### K. Explicit non-features (1, multi-select)

K1. **Confirm exclusions.** Default exclusions, override only if specifically needed:
- Comments
- Site-wide search / blog search
- Social sharing buttons
- Author bio pages (separate from author entity)
- Newsletter signup *inside* article body (footer-wide is fine)
- Reading progress bar
- Dark mode toggle specific to blog (inherits site-wide if any)
- Embedded video, code blocks, pull quotes, downloadable files
- Tag pages
- Category landing pages (`/blog/category/[slug]`)

Anything ticked on this list moves into scope and needs its own spec section.

#### L. Entry points & launch order (2)

L1. **Entry points to the blog** — header nav link / footer link / homepage "latest posts" feed / dedicated landing page. Pick any combination.
L2. **Launch order** — does the homepage feed ship at launch, or after the core blog pages are finalized? *Recommended: blog pages first, homepage feed last, to avoid empty-state rework.*

---

### High-level plan template

After §0 is answered, produce the plan from this skeleton. One page maximum. Wait for explicit approval before any code change.

```
# Blog Implementation Plan — <Project Name>

## Scope (locked from §1)
- Locales: ...
- Author model: ...
- Categories: <N> fixed / editable / TBD
- AI hero images: yes / no
- Entry points: ...

## Phases
1. Sanity Studio — schema files (post, category, author?), seed data
2. Routes & rendering — listing, pagination, article page, smart 404
3. SEO surface — canonicals, hreflang, sitemap, JSON-LD, OG, Atom feeds, robots
4. Performance & a11y — CWV budget, font loading, ToC, reading time, focus order
5. Hero images (if J1=yes) — style guide tailoring, generator script, smoke test, batch
6. Homepage feed (if L2=last) — latest-3 cards on home
7. Verification — pnpm build, tsc, Lighthouse, axe-core, manual smoke

## Out of scope (deferred)
- <list from §K>

## Open decisions
- <items from Appendix A>

## Estimated effort
- Sanity Studio + schema: <X hours>
- Routes + listing + article: <Y hours>
- SEO surface: <Z hours>
- Performance + a11y polish: <W hours>
- AI hero images (if in scope): <V hours>
- Verification + fixes: <U hours>
```

---

## §1. Project Profile

Project-specific values, populated from §0 answers. Anywhere below that says "per §1" or "from the Project Profile" refers here.

| Field | Value |
|---|---|
| Project name | `[FILL from A1]` |
| Primary domain | `[FILL from A2]` |
| Site purpose | `[FILL from A3]` |
| Publisher logo path | `[FILL from A4 — or "deferred"]` |
| Locales | `[FILL from B1 — e.g. en / en, fr / en, fr, de]` |
| Primary locale (x-default) | `[FILL from B2]` |
| Locale prefix rule | `[FILL from B3 — "always present" recommended]` |
| Translation linkage | `[FILL from B4 — "independent" recommended]` |
| Framework | Next.js (App Router) — confirm major version from `package.json` |
| i18n library | `[FILL — typically next-intl]` |
| Styling | `[FILL — e.g. Tailwind + shadcn/ui]` |
| Motion | `[FILL — typically Framer Motion]` |
| CMS | Sanity v3 — Studio at `[FILL from I1 — hosted *.sanity.studio / embedded /studio]` |
| Draft preview | `[FILL from I2 — Sanity Presentation auth / none]` |
| Author model | `[FILL from C1]` |
| Category count target | `[FILL from C2 — N fixed]` |
| Category list (at launch) | `[FILL from C3 — list or "deferred"]` |
| Category editability | `[FILL from C4 — editable / locked]` |
| Tags | `[FILL from C5 — recommended: excluded]` |
| URL shape | `[FILL from D1 — recommended: flat /[locale]/blog/[slug]]` |
| Slug strategy | `[FILL from D2 — locale-specific recommended]` |
| Posts per listing page | `[FILL from E1 — default 12]` |
| Featured post strategy | `[FILL from E2 — auto-newest recommended]` |
| Pagination style | `[FILL from E3 — numbered recommended]` |
| ToC threshold | `[FILL from E4 — default ≥4 H2 AND ≥1000 words]` |
| Related-posts logic | `[FILL from E5 — auto same-category recommended]` |
| OG image strategy | `[FILL from F2 — reuse hero crop recommended]` |
| Feed format | `[FILL from F3 — Atom 1.0 recommended]` |
| Analytics | `[FILL from H1+H2]` |
| Hero image source | `[FILL from G2]` |
| `next.config.ts` AVIF override approved | `[FILL from G3 — yes/no]` |
| Excluded non-features | `[FILL from K1 — defaults excluded unless overridden]` |
| Entry points | `[FILL from L1]` |
| Launch order | `[FILL from L2]` |
| Approved CLAUDE.md overrides | `[FILL — list explicitly]` |
| Deferred to implementation | `[FILL — anything answered "later"]` |

---

## §2. Scope

In scope: article authoring, publishing, rendering, SEO, i18n (if §1 has >1 locale), performance, accessibility, analytics for a corporate blog at the scale captured in §1.

Out of scope (defaults; override via §0.K only when justified): newsletter signup inside articles, cookie consent banner (handled site-wide), site-wide search, comments, social sharing buttons, user accounts, paid subscriptions, tags, category landing pages.

---

## §3. Content Model

### 3.1 Post schema (Sanity)

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | One per post |
| `slug` | slug | yes | Auto from title, editable. Uniqueness enforced per `(slug, locale)` pair via query when §1 is multilingual; otherwise globally unique. |
| `locale` | string enum | yes only if §1 multilingual | Values match the locale set in §1. Plain radio field, not `@sanity/document-internationalization` unless §1.B4 = cross-linked. |
| `category` | reference → category | yes | Exactly one category per post |
| `author` | depends on §1.C1 | yes | String (C1=string) / reference → author with `name` only (C1=entity-light) / reference → author with full bio (C1=full-entity) |
| `heroImage` | image with hotspot | yes | 16:9, ~1600×900 source, required `alt` field |
| `excerpt` | text (3 lines) | no | Manual; falls back to first ~160 chars of body |
| `publishedAt` | datetime | yes | Auto-set on first publish |
| `body` | portable text array | yes | See §3.2 |

**Do not store:**

- Reading time — computed server-side at render, cached with the page (see §13.2). Stale-data trap if stored.
- `dateModified` — use Sanity's built-in `_updatedAt`.

### 3.2 Portable text body

Allowed block types (override the list only if §0.C6 captured a specific need):

- Headings: H2, H3, H4. **No H1** — reserved for the post title.
- Styles: normal, blockquote
- Lists: bullet, numbered
- Marks: strong, emphasis, inline code, link. The link `href` validator must allow both absolute URLs and internal relative paths (e.g. `/contact`). A strict `http/https/mailto/tel`-only validator blocks editors from saving posts with internal links — common in AI-authored content.
- Custom objects: `image` (with alt), `faqBlock` (see §13), `table` (via `@sanity/table`)

Excluded by default: code blocks, video embeds, pull quotes, downloadable file blocks, custom HTML. Add only when there is a concrete editorial need.

### 3.3 Category schema

Separate `category` document type:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | localized string (if §1 multilingual) | yes | Displayed label per locale |
| `slug` | slug | yes | Used in query params, not URL paths |
| `order` | number | no | Optional manual sort for filter pills |

Category count and editability come from §1.

### 3.4 Author schema (only when §1.C1 ≠ string)

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Displayed byline. Shared across locales — not localized. |
| `bio` | text | no | Only when §1.C1 = full-entity |
| `photo` | image | no | Only when §1.C1 = full-entity |
| `links` | array of `{label, url}` | no | Only when §1.C1 = full-entity |

Seed at least one author at Studio setup. Posts reference authors by id so a name change flows everywhere.

---

## §4. Taxonomy

**Categories only** (per §1.C5 default). No tags.

- Exactly **one category per post** (enforced in schema).
- **No dedicated category landing pages.** Do not build `/blog/category/[slug]` routes.
- Category filtering on `/blog` happens via query param (`/blog?category=<slug>`) — client-side filter, no new SEO surface.
- Categories are used for: filter pills on listing, breadcrumb label, card label, related-posts logic, internal organization.

Rationale: at corporate-blog scale, tags create thin archives and governance overhead. AI authors invent arbitrary tags if given the option. Topic clusters happen via in-body links and the related-posts block. If tags become essential later, add the field, but plan for category-landing-page-style governance up front.

---

## §5. URL Structure

### 5.1 Routes

Assuming §1.D1 = flat (recommended):

- Post: `/[locale]/blog/[slug]` — e.g. `/en/blog/sample-post-title`
- Blog index: `/[locale]/blog`
- Paginated index: `/[locale]/blog/page/[n]` starting at page 2
- Filtered index (client-side): `/[locale]/blog?category=[slug]`
- Atom feed: `/[locale]/blog/feed.xml`
- Studio: at `*.sanity.studio` or `/studio` per §1.I1

For monolingual projects (§1 single-locale), drop the `[locale]` segment everywhere. Hreflang section (§7.3) then does not apply.

### 5.2 Rules

- **Locale prefix is always present** when §1.B3 = always present. Every URL is `/[locale]/...` — there is no unprefixed `/blog/[slug]`. This keeps hreflang symmetric, eliminates duplicate-content risk between `/` and `/<primary-locale>/`, matches `next-intl`'s recommended routing mode, and simplifies canonicals and sitemap generation. The site root `/` either redirects to `/<primary-locale>` or renders a locale-selection shell — never serves the primary locale's content directly at `/blog/[slug]`.
- **Flat URLs** — no year, category, or other segment in path. Prevents recategorization redirect debt.
- No trailing slashes. Lowercase slugs only. No query params in canonical URLs.
- Slugs are locale-specific (per §1.D2). A FR post can have a French slug, a DE post a German slug; same slug across locales is fine because queries filter by `(slug, locale)`.

---

## §6. i18n Handling

**Skip this section entirely when §1 is monolingual.**

Posts can exist in any subset of the locales in §1 independently — no forced translation pairs.

### 6.1 Missing-locale fallback (smart 404)

If a post slug does not exist in the requested locale, return a real **HTTP 404** with a helpful empty state instead of rendering foreign-language content. The route-specific 404 must:

- Return status code `404` (not a soft 404).
- Show a clear message in the requested locale, e.g. "This article isn't available in [locale name]."
- Offer **one** path forward: a prominent "Browse the blog" link to `/[requested-locale]/blog`.
- Do **not** offer a deep link to "the same post in another language" when §1.B4 = independent — posts are not linked across locales, so there is no deterministic way to resolve which other-locale post is the equivalent.
- Do **not** emit `hreflang` tags for the missing locale.
- Do **not** emit JSON-LD for a nonexistent post.
- Localized UI (header, footer, nav) stays in the requested locale.

This is the honest SEO answer, avoids duplicate-content / `lang` hacks, and still gives users a useful next step.

### 6.2 Locale switcher on blog routes

When §1.B4 = independent (recommended):

- Target route from a blog post: **`/[target-locale]/blog`** (the blog listing in the target language), not the same post in another language.
- Rationale: posts are not linked across locales (see §3.1 — no `translationOf` reference). Without shared slugs (harmful for non-primary-locale SEO) or a translation graph, "the same post in another language" is not resolvable.
- Non-blog routes keep their normal per-page locale switching via `next-intl`.

When §1.B4 = cross-linked (only if explicitly chosen): the switcher resolves to the equivalent post via the `translationOf` graph; emit post-level hreflang and sitemap alternates accordingly.

### 6.3 Localized UI strings

All UI labels (read time, "More from", ToC heading, published date, 404 empty state, etc.) live in the message files per §1's i18n library (typically `src/messages/<locale>.json` for `next-intl`). Never hardcode strings in components. Date formatting delegates to the i18n library.

---

## §7. SEO Metadata

### 7.1 Structured data (JSON-LD)

Emit the following on every article page:

**BlogPosting** (subtype of Article — semantically accurate for a corporate blog):

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "<title, ≤110 chars>",
  "image": ["<hero image absolute URL>"],
  "datePublished": "<publishedAt ISO>",
  "dateModified": "<_updatedAt ISO>",
  "author": { "@type": "Person", "name": "<author name>" },
  "publisher": {
    "@type": "Organization",
    "name": "<project name from §1>",
    "logo": { "@type": "ImageObject", "url": "<publisher logo absolute URL from §1>" }
  },
  "mainEntityOfPage": "<absolute canonical URL>",
  "inLanguage": "<locale>"
}
```

When §1.C1 = full-entity and an author has a public profile page, set `author.url` to the absolute profile URL. Otherwise omit `url` (a bare `Person` with `name` only is correct — Google does not require a URL).

**BreadcrumbList** (separate JSON-LD block on every post): `Home → Blog → Post Title`. The category is a visible breadcrumb *label* but not a link — do not include a category entry in the `BreadcrumbList`.

**FAQPage** — emit **only** when a post contains at least one `faqBlock` in its body. Mirrors the questions/answers exactly.

Any additional schemas captured in §0.F1 (e.g. `HowTo`, `Recipe`) go here, scoped per post type as needed.

### 7.2 Canonical URLs

- Self-referencing, absolute, locale-prefixed, lowercase, no trailing slash, no query params.
- Never cross-canonicalize between locales — that is what hreflang is for.
- Paginated pages canonical to themselves (`/blog/page/2` → `/blog/page/2`), never to `/blog`.
- Posts that exist in only one locale do not produce a page in the other locale — the other locale returns a 404 (see §6.1). No canonical juggling required.

### 7.3 Hreflang

**Skip when §1 is monolingual.**

- **Blog post pages** when §1.B4 = independent: emit **no post-level hreflang tags**. There is no cross-locale translation graph, so each post is an independent single-locale document even if same-topic content exists in other languages.
- **`/blog` listing pages**: emit the full hreflang set across all locales in §1 (each locale + `x-default` pointing to the primary locale's index) on every locale index.
- **Paginated listing pages (`/blog/page/N`)**: emit hreflang to each locale where page `N` exists. Per Google, hreflang is page-based — page 2 links to page 2, not to page 1 of another locale.
- Implement via Next.js `generateMetadata` `alternates.languages`.

```html
<link rel="alternate" hreflang="en" href="https://example.com/en/blog" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/blog" />
<link rel="alternate" hreflang="de" href="https://example.com/de/blog" />
<link rel="alternate" hreflang="x-default" href="https://example.com/en/blog" />
```

When §1.B4 = cross-linked: emit post-level hreflang to the resolved translation siblings, plus matching sitemap alternates.

### 7.4 Meta description

- Source: the manual `excerpt` field. Fallback: first ~160 chars of body text.
- Length: 140–160 characters, one sentence, primary keyword in first 100 chars, no stuffing.

### 7.5 Open Graph / Twitter Cards

Required OG tags on every post: `og:title`, `og:description`, `og:url`, `og:type=article`, `og:image`, `og:image:width=1200`, `og:image:height=630`, `og:image:alt`, `og:locale`, `article:published_time`, `article:modified_time`, `article:section` (category name).

**Do not emit:**

- `article:author` — the Open Graph spec expects an array of profile URLs. Omit unless §1.C1 = full-entity *and* the author actually has a public profile URL.
- `article:tag` — no tags in this spec.
- `og:locale:alternate` — only emit when §1.B4 = cross-linked.

Twitter: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`.

**OG image:** per §1.F2. Default: reuse the hero image, cropped to 1200×630 via Sanity's image URL builder. Max file size 200 KB. Populate `og:image:alt` / `twitter:image:alt` from the Sanity `alt` field.

### 7.6 Sitemap

Single `app/sitemap.ts` route returning `MetadataRoute.Sitemap`. Include every URL (every post in its locale, every listing page, every paginated listing page) as its own `<url>` entry. `lastmod` must reflect real `_updatedAt` — Google penalizes sitemaps that lie about `lastmod`.

**Alternates rule** (multilingual projects):

- **Listing and paginated listing pages**: emit `alternates.languages` pointing to the equivalent page in each other locale. These pages exist in all locales by construction, so the mapping is deterministic.
- **Post URLs** when §1.B4 = independent: do **not** emit `alternates.languages`. Posts are independent single-locale documents; incorrect alternates are worse than none.

No sitemap index required until the site approaches ~50k URLs.

### 7.7 Robots.txt

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /studio
Sitemap: https://<domain from §1>/sitemap.xml
```

- The `/studio` disallow is only relevant if Studio is embedded (§1.I1 = embedded). For hosted Studio at `*.sanity.studio`, the line is harmless and future-proof.
- Do not block AI crawlers — organic visibility (including AI search) is the goal.
- Draft previews must be noindexed per-route, not via robots.txt.

### 7.8 RSS / Atom feeds

- Format: per §1.F3. Default Atom 1.0 (better i18n, stricter spec than RSS 2.0).
- One feed per locale: `/[locale]/blog/feed.xml`. Each feed contains only posts in its locale.
- Fields per entry: `id`, `title`, `updated`, `author`, `link`, `summary` (from excerpt), `content` (from body), `category`.
- Linked from `<head>` of `/blog` indexes via `<link rel="alternate" type="application/atom+xml">`.

### 7.9 "Updated on" date display

- Show visibly **only when** `_updatedAt` differs from `publishedAt` by more than 24 hours. (A typo-fix save within a day should not trigger it.)
- When shown: format as `Published <date> · Updated <date>`.
- The JSON-LD `dateModified` must match the visibly displayed date or Google may ignore both.

### 7.10 Unpublish / deletion handling

- When a post is unpublished or deleted in Sanity, the URL must return **HTTP 404** via Next.js's `notFound()`.
- Do **not** redirect old post URLs to `/blog`, and do **not** serve stale copies. Use a Sanity deletion webhook plus `revalidateTag` so the next request falls through to `notFound()`.
- Reserve `301` redirects for genuine slug changes on still-published posts (old slug → new slug, same locale).
- `410 Gone` would deindex slightly faster but `notFound()` returns `404` and emitting `410` cleanly requires extra route-handler plumbing. For a small corporate blog, `404` is the pragmatic answer.

---

## §8. Blog Listing Page (`/blog`)

### 8.1 Content per page

- **Posts per page from §1.E1** (default 12).
- Category filter pills above the grid (client-side, via `?category=` query param).
- No search box, no author filter.

### 8.2 Card contents

Each card shows:

- Hero image (16:9)
- Category label (visible, not a link)
- Post title
- Excerpt (1–2 lines, truncated)
- Published date
- Reading time

Show author on cards only when §1.C1 = full-entity AND it adds editorial signal (multi-author blog). Otherwise omit — single-string and single-entity authors are low signal on a listing grid. Author still appears on the article page itself.

### 8.3 Featured post

Per §1.E2. Default: **automatic** — the newest post appears as a larger "hero card" at the top of page 1 only. Subsequent pages use the uniform grid. No editorial "featured" flag in the CMS.

### 8.4 Pagination

- Numbered pages: `/blog` (page 1), `/blog/page/2`, `/blog/page/3`, etc.
- **Every paginated page is indexable and self-canonical.** Do not `noindex` pagination: Google wants paginated archives discoverable, and `noindex` drops them from Search. At corporate-blog scale, crawl budget is irrelevant.
- `rel=prev/next` is deprecated — each paginated page stands on its own.
- Avoid infinite scroll (Googlebot does not trigger scroll). "Load more" is acceptable only if it also updates the URL.

### 8.5 Listing performance

- Use `prefetch={false}` on **all** article card links on listing pages. With 12 cards per page, default prefetch wastes bandwidth on hover-free devices and crowds the cache.
- Lazy-load all card images except those above the fold.

---

## §9. Article Page

### 9.1 Layout

Top to bottom:

1. Breadcrumb: `Home → Blog → [Category label] → Post Title` (category is a label, not a link)
2. Title (H1)
3. Metadata row: author · published date (+ updated date if applicable) · reading time
4. Hero image (16:9, above content)
5. Body (portable text)
6. Related posts ("More from [Category]") — see §11
7. Site footer

Desktop (≥1024px): sticky ToC in left rail. Mobile: collapsible ToC at top of article (below metadata, above body).

### 9.2 Semantic HTML skeleton

```html
<article>
  <header>
    <nav aria-label="Breadcrumb">...</nav>
    <h1>...</h1>
    <p>
      <time dateTime="2026-04-13">April 13, 2026</time>
      · <span class="byline">By Author Name</span>
      · <span>5 min read</span>
    </p>
  </header>
  <nav aria-label="Table of contents"><ol>...</ol></nav>
  <section>... body with h2/h3 ...</section>
  <footer>category label</footer>
</article>
<aside aria-labelledby="more-from-heading">
  <h2 id="more-from-heading">More from [Category]</h2>
  ...
</aside>
```

Author is plain byline text, not `rel="author"` — that microformat is for links to author profile URLs, which only exist when §1.C1 = full-entity with bio pages. In JSON-LD, use a bare `Person` with `name` only (add `url` only when a real profile page exists).

Rules:

- Exactly **one `<h1>`** per page.
- Heading hierarchy: h1 → h2 → h3. No skipping levels.
- All `<h2>` and `<h3>` get stable `id` attributes (slugified text) for ToC anchors.
- `<time datetime>` on every date.

### 9.3 Typography

- Body font size: **18px** desktop, **17px** mobile (in rem: 1.125 / 1.0625).
- Line height: **1.65** body, 1.1–1.3 headings.
- Line length: **~65 characters** (Tailwind `max-w-[65ch]` on the prose container).
- Paragraph spacing: ~0.75–1× line height (never rely on `<br>`).
- Sans-serif is the default for screens; a screen-optimized serif is equally valid. Pick one and commit.

---

## §10. Homepage Feed

Per §1.L1. When the homepage feed is in scope:

- Show the **latest 3 posts** as cards (same design language as `/blog` listing cards).
- Adds fresh internal links, editorial pulse, and a crawler signal.
- No duplicate-content risk — excerpt-level widgets are explicitly fine per Google, as long as the full body lives on one canonical URL.

Build this **last** (per §1.L2 default) to avoid empty-state rework before posts exist.

---

## §11. Related Posts

Block label: **"More from [Category]"** (localized via §6.3).

Logic when §1.E5 = automatic (recommended):

1. Query: all posts in the same category as the current post, matching the current post's locale, sorted by `publishedAt` DESC, excluding the current post. Take 3.
2. Fallback: if the category has fewer than 3 siblings in the same locale, fill remaining slots with the latest posts from any category (same locale).
3. Render as 3 cards in an `<aside>` below the article.
4. Never random. Never manually curated.

When §1.E5 = manual: add a `relatedPosts` reference array to the post schema, fall back to automatic if empty.

---

## §12. Table of Contents & Reading Time

### 12.1 ToC

- **Conditional rendering:** show only when the post has ≥`N` H2 headings AND ≥`M` words per §1.E4. Defaults: ≥4 H2 AND ≥1000 words. Below that, ToC is noise.
- H2-only (no H3 nesting by default — prevents visual clutter from AI over-nesting).
- Desktop ≥1024px: sticky left rail. Mobile: collapsible `<details>` at the top of the article.
- Active-section highlighting via `IntersectionObserver`.
- Click moves focus to the target heading (`tabindex="-1"` + `.focus()`), and headings must have `scroll-margin-top` so they are not hidden under a sticky header.
- Markup: `<nav aria-label="Table of contents"><ol>...</ol></nav>`.

### 12.2 Reading time

- Computed **server-side at render** from portable text word count, then cached with the page — the walker runs once per publish/edit (via tag-based revalidation), never per user and never in the browser. Not stored in Sanity.
- **238 words per minute**, rounded up, minimum "1 min read".
- Display next to published date in the metadata row. Label via translation keys.

---

## §13. FAQ Block

Inline portable text block, not a separate document type. Skip if §0.C6 explicitly excluded FAQ.

- Schema: `faqBlock` object with optional `heading` and an array of `{question, answer (portable text)}` items.
- Rendered as `<details>`/`<summary>` (native collapsible). Not `<dl>` — we want interactivity.
- When a post contains one or more FAQ blocks, emit a `FAQPage` JSON-LD block mirroring the questions/answers.
- Accessibility: ensure `summary` is focusable and has a visible focus ring.

---

## §14. Performance Budget

### 14.1 Core Web Vitals targets

Tighter than the "good" baseline by default — the "good" baseline is a pass threshold, not a quality target. Relax only if §1.G1 says so.

| Metric | Target | Baseline ("good") |
|---|---|---|
| LCP | **< 2.0s** | < 2.5s |
| INP | **< 150ms** | < 200ms |
| CLS | **< 0.05** | < 0.1 |
| TTFB | **< 600ms** | < 800ms |

Lighthouse (mobile): Performance, Accessibility, Best Practices, SEO all **≥ 90**.

### 14.2 JavaScript budget

| Item | Budget |
|---|---|
| First-load JS on article page (gzipped) | < 170 KB |
| Third-party JS total (gzipped) | < 50 KB |
| Render-blocking third-party scripts | 0 |

Biggest INP offenders to avoid or lazy-load: chat widgets, analytics gtag.js, embedded newsletter iframes, scroll-linked Framer Motion effects.

### 14.3 Image pipeline

- Build image URLs with **`@sanity/image-url`** and render them with **Next.js `<Image>`** from `next/image`. This is the current official Sanity pattern; do not import an `Image` component from `next-sanity/image`.
- The URL builder handles responsive URLs, hotspot/crop, and on-the-fly transforms; `next/image` handles caching, AVIF/WebP negotiation, and layout reservation.
- Hero image: responsive via `sizes="(max-width: 768px) 100vw, 1200px"`, `loading="eager"`, `fetchPriority="high"`, preloaded only once per page (the LCP image).
- Hero dimensions: 1600×900 source.
- **Formats: AVIF + WebP.** Recent Next.js majors default to `WebP` only — opt into AVIF in `next.config.ts`:

  ```ts
  // next.config.ts
  images: { formats: ['image/avif', 'image/webp'] }
  ```

  AVIF is typically 20–30% smaller than WebP on photographic hero images, directly helping LCP. This requires §1.G3 = approved.
- Hero weight budget: **< 150 KB over the wire on mobile.**
- LQIP: query `heroImage.asset->metadata{lqip}` and pass as `placeholder="blur" blurDataURL={lqip}`. Sanity generates LQIP automatically on upload.
- Body images: default lazy, explicit width/height, never without dimensions.
- OG image: 1200×630, < 200 KB, generated via `@sanity/image-url` in `generateMetadata`.
- Every `<Image>` must have explicit dimensions (or `fill` with a sized parent) to reserve layout and prevent CLS.

**Alt text rules:**

- Every image requires an `alt` field in Sanity; publish is blocked without it.
- Hero image alt **must describe the image content** (what is depicted), not restate the headline — screen reader users already heard the `<h1>`.
- Body images: informative images get descriptive alt; purely ornamental inline images (rare on a blog) get `alt=""`.

### 14.4 Font loading

- `next/font` with `display: "swap"` (self-hosts, subsets, generates a size-adjusted fallback).
- Max **2 font families** (one body, optionally one display).
- Max **3 weights** total; prefer a single variable font file.
- Subsets: `latin` plus `latin-ext` if any locale in §1 is FR/DE/ES/IT/PT/PL etc.
- Preload the body font; do not preload decorative display fonts.

### 14.5 Motion

- Framer Motion allowed but restricted: transform/opacity only (no layout animation on body content).
- `<MotionConfig reducedMotion="user">` at the root.
- Article-body animations use `whileInView` with `once: true`.
- **Article hero parallax permitted** — a subtle scroll-linked vertical transform (±8–10% range) on the article hero image is allowed and recommended for an editorial feel. It must: disable via `useReducedMotion` from Framer Motion; keep the Next/Image `priority` and eager load so LCP is untouched; clip the inner transform inside a parent with the aspect-locked container so CLS stays zero. No Ken Burns, no scroll-parallax on body images, no zoom.

### 14.6 Prefetch

- Next.js `<Link prefetch={false}>` on all article card links on the blog listing page (see §8.5).
- Keep default prefetch on primary nav, hero CTAs, and next/prev links within an article.

---

## §15. Accessibility (WCAG 2.2 AA)

| Rule | Target |
|---|---|
| Body text contrast | ≥ 4.5:1 |
| Large text contrast | ≥ 3:1 |
| Non-text / UI contrast | ≥ 3:1 |
| Focus indicator | ≥ 2 CSS px thick, ≥ 3:1 vs adjacent colors, never `outline: none` without replacement |
| Target size | ≥ 24×24 CSS px |
| Motion | Honors `prefers-reduced-motion: reduce` globally |

Required features:

- **Skip-to-content link** — first focusable element, visible on focus.
- **Alt text** on every informative image (Sanity-enforced on hero images). Hero alt must describe the image content, not restate the headline. Reserve `alt=""` for purely ornamental inline images only — never for hero images.
- **Tables** with `<caption>` and `<th scope="col|row">`; no layout tables.
- **FAQ block** with native `<details>`/`<summary>`, focusable summary.
- **ToC navigation** with keyboard support and focus management on jump.
- **Heading hierarchy** never skipped.
- Font sizes in `rem`; never lock `html { font-size }` below 100%.

Testing:

- Keyboard-only traversal: all interactive elements reachable, focus always visible.
- Screen reader: `<article>` and `<aside>` landmarks announced; ToC nav landmark labeled.
- Automated: pass `axe-core` or Lighthouse a11y audit with zero critical violations.

---

## §16. Content Authoring Workflow

- Posts are drafted in Sanity Studio. AI agents create drafts via API; human reviews and publishes via Studio UI.
- Sanity's built-in draft status is used. No custom workflow states.
- Scheduled publishing per §1.I3. If enabled, install the community plugin; otherwise omit.
- Visual Editing / Presentation tool per §1.I2. When enabled, `@sanity/presentation` gates draft access behind Sanity login (no shared preview URL secret). Editors click "Preview" in Studio and land on the draft-mode page authenticated as themselves. Click-to-edit overlays are a side benefit; the primary purpose is auth'd preview of unpublished drafts. When disabled, keep the wiring installable so it can be toggled on later without a rewrite.
- Publishing sets `publishedAt` automatically (first publish only). Subsequent saves update `_updatedAt` automatically via Sanity.
- Author, hero image, alt text, and category are required at publish time (schema-enforced).

---

## §17. Analytics

- **Tool:** whatever §1 specifies.
- **Consent model:**
  - Cookieless tool → load directly, no consent gate required.
  - Consent-gated tool → load only after the visitor has granted consent via the existing site-wide gate. Before consent, no analytics script is injected and no beacons fire.
- Load via `next/script strategy="afterInteractive"`; never `beforeInteractive`.
- No other analytics scripts (no GA4, no Facebook Pixel, no Hotjar) unless explicitly added to §1.H1.
- Script weight: ideally ≤ 5 KB gzipped; anything heavier counts against the third-party JS budget in §14.2.
- Blog pages inherit the site-wide consent gate automatically — do not reimplement analytics loading inside the blog routes.

---

## §18. Stack & Dependencies

Required packages — install the latest stable major at implementation time. Verify versions on npm before locking.

```
next-sanity             (latest stable)
@sanity/image-url       (latest stable)
@portabletext/react     (latest stable)
sanity                  (latest stable — inside the Studio folder per §1.I1)
@sanity/table           (latest stable)
@sanity/presentation    (only if §1.I2 = enabled)
@sanity/document-internationalization  (only if §1.B4 = cross-linked)
```

Pin the current major, then let Renovate / Dependabot track minors. Do not copy version pins from this document — they go stale. Re-verify any Next.js minor or `next-sanity` API mentioned here against live docs.

Not required (deliberately excluded by default): `reading-time` package (custom walker is ~15 lines), `rss` package (Atom feed is simple enough to write directly).

### Next.js gotchas (App Router, recent majors)

- `params` and `searchParams` are `Promise` — always `await` them in page/layout handlers.
- `fetch` is uncached by default since Next 15 — use `sanityFetch` from `next-sanity/live` which applies tag-based cache semantics.
- Turbopack is the default bundler in recent majors — pin `next-sanity` and `sanity` to the latest minors for compatibility.
- Disable `stega` (Sanity's source-map annotations) outside draft mode — stray invisible characters leak into JSON-LD and OG descriptions.
- Prefer `revalidateTag` over `revalidatePath` with localized routes (paths get messy with the `[locale]` segment).
- `cacheComponents` / `"use cache"`: stable in Next.js 16, but **do not adopt it for blog pages** without specific reason — it interacts poorly with Sanity live draft mode and adds complexity without meaningful benefit for content that already caches well via tag-based revalidation.

---

## §19. Pass/Fail Checklist

A blog is "done" only when every applicable item below is true. Items keyed to §1 conditionals (`only if multilingual`, etc.) are skipped when those conditions do not apply.

### Content model

- [ ] Post schema matches §3.1, including `locale` (if multilingual), single `category`, required hero + alt
- [ ] Category schema separate; count matches §1.C2; editability matches §1.C4
- [ ] Author schema matches §1.C1 (string / entity-light / full entity)
- [ ] Portable text supports H2/H3/H4, lists, tables, images, FAQ block — nothing else (unless §0.C6 added items)
- [ ] No tags field anywhere (unless §1.C5 explicitly added)

### Routing

- [ ] Posts at `/[locale]/blog/[slug]` (or unprefixed `/blog/[slug]` if monolingual); no category in URL
- [ ] Pagination at `/[locale]/blog/page/[n]` (page 1 at `/blog`)
- [ ] Category filter via `?category=` query param only
- [ ] (Multilingual) Missing-locale requests return HTTP 404 with a smart empty state per §6.1
- [ ] (Multilingual) Locale switcher on blog post routes targets `/[target-locale]/blog`, not the same post in another language (when §1.B4 = independent)
- [ ] Unpublished / deleted post URLs return HTTP 404 via `notFound()`; deletion webhook from Sanity invalidates the cache tag

### SEO

- [ ] `BlogPosting` JSON-LD on every post with all required fields
- [ ] `BreadcrumbList` JSON-LD on every post
- [ ] `FAQPage` JSON-LD emitted when post contains an FAQ block
- [ ] (Multilingual) Hreflang and sitemap alternates emitted per §7.3 and §7.6
- [ ] Self-referencing absolute canonical, locale-prefixed (if multilingual), on every page
- [ ] `app/sitemap.ts` with real `lastmod` reflecting `_updatedAt`
- [ ] Full OG metadata including `og:image:alt`; Twitter Card including `twitter:image:alt`; 1200×630 OG image via Sanity image URL
- [ ] No `article:author` in OG (unless §1.C1 = full-entity with public profile URL)
- [ ] Atom 1.0 feeds at one URL per locale, linked from `/blog` `<head>` in each locale
- [ ] Numbered pagination, every page indexable and self-canonical (no noindex on page 3+)
- [ ] Manual excerpt field used as meta description (140–160 chars)
- [ ] Visible "Updated on" shown only when `_updatedAt` differs from `publishedAt` by > 24 hours
- [ ] `robots.txt` allows all, disallows `/api/`, references sitemap

### Article page

- [ ] Exactly one `<h1>`; no skipped heading levels; all H2/H3 have stable `id`s
- [ ] `<article>` with `<time datetime>`, author, `<nav aria-label="Table of contents">`, `<aside>` for related posts
- [ ] ToC renders conditionally per §1.E4 thresholds, sticky desktop, collapsible mobile
- [ ] Reading time auto-calculated at 238 wpm, min 1 min
- [ ] Related posts: 3 same-category siblings newest first, with latest-fallback when < 3 siblings (or manual override if §1.E5 = manual)
- [ ] Breadcrumb: Home → Blog → [Category label] → Post (category as label, not link)

### Listing page

- [ ] Posts per page matches §1.E1; featured card behavior matches §1.E2
- [ ] Cards show hero, category label, title, excerpt, date, reading time (and author only when §1.C1 = full-entity)
- [ ] Category filter pills via query param
- [ ] `prefetch={false}` on all article card links on the blog listing page

### Performance

- [ ] LCP < 2.0s, INP < 150ms, CLS < 0.05 (mobile 4G) — or §1.G1 baseline
- [ ] Lighthouse mobile ≥ 90 on all four categories
- [ ] First-load JS < 170 KB gzipped; third-party JS < 50 KB gzipped
- [ ] (If §1.G3 approved) `next.config.ts` sets `images.formats = ['image/avif', 'image/webp']`
- [ ] Hero image < 150 KB, `fetchPriority="high"`, LQIP blur placeholder, descriptive alt
- [ ] Every `<Image>` has explicit dimensions or `fill` + sized parent
- [ ] OG image 1200×630, < 200 KB, generated via Sanity image URL, with `og:image:alt` populated
- [ ] Single variable font, ≤ 3 weights, latin + latin-ext subset where needed, `display: swap`

### Accessibility

- [ ] All text contrast ≥ 4.5:1; focus ring ≥ 2 px and ≥ 3:1
- [ ] All interactive targets ≥ 24×24 px
- [ ] Skip-to-content link present and visible on focus
- [ ] Body prose max-width 65ch, 18px base, line-height 1.65, 17px on mobile
- [ ] All animations honor `prefers-reduced-motion`; hero is static under reduced motion
- [ ] FAQ uses `<details>`/`<summary>`
- [ ] Tables have `<caption>` and `<th scope>`
- [ ] Keyboard-only traversal verified; focus always visible
- [ ] Screen reader verified: `<article>` and `<aside>` landmarks announced, ToC nav landmark labeled
- [ ] `axe-core` / Lighthouse a11y audit: zero critical violations

### i18n (skip if monolingual)

- [ ] All UI labels via the i18n library's translation keys, in message files for every locale in §1
- [ ] Date/time formatting via the i18n library, not hardcoded
- [ ] Missing-locale 404 empty state translated in all locales (offers only "Browse the blog"; no cross-locale deep link when §1.B4 = independent)

### Build & quality

- [ ] `pnpm build` passes with zero errors or warnings (or the project's package manager equivalent)
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] No hardcoded strings in components (all via translation keys)
- [ ] No image files imported in components (all via `/public/images/` or Sanity)

---

## §20. AI-Generated Hero Images

Skip entirely when §1.G2 ≠ AI. Otherwise this section is self-contained: the style-guide template in `blog-image-style-guide.md` and the generator script below.

### 20.1 Model & tooling

- **Model:** per §1.J2. Default `gemini-3-pro-image-preview` (Nano Banana Pro) via the Google Generative Language API. ~$0.24 per image, ~15–20 s per generation, 16:9 at 1376×768 typical. Chosen over cheaper Flash variants because it follows strict brand rules ("no text", precise colors, specific element placement) reliably on the first try.
- **Alternatives on the same API key:** `gemini-2.5-flash-image` (~$0.04, faster, lower adherence), `gemini-3.1-flash-image-preview` (newer flash), `imagen-4.0-ultra-generate-001` (~$0.08, best pure photoreal but weaker instruction following). Default to Pro; drop to a Flash variant only if prompt adherence is not load-bearing.
- **Aspect ratio:** 16:9 landscape. Passed via `generationConfig.imageConfig.aspectRatio` in the API body.
- **Auth:** single env var `GEMINI_API_KEY` from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Must be in `.env.local` (or the deploy env); never committed.
- **Verification before first real run:** hit `GET https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY` and confirm both `models/gemini-3-pro-image-preview` and billing-enabled status before generating the full batch.

### 20.2 Style guide

The style guide lives in `blog-image-style-guide.md`. Walk its intake questions first to tailor the brand voice, palette, references, topic table, and worked examples to this project. The structure is universal; the content is per-project.

### 20.3 Generator script

Place this at `scripts/generate-hero-images.ts`. Before running: populate the `TOPICS` array with one entry per article (one slug per locale + crafted prompt + localized alt). Assumes the post document `_id` pattern `post.<locale>.<slug>` (adjust if §1 uses a different document ID scheme). Idempotent: re-runs skip posts already carrying `heroImage.asset` unless `--force` is passed. Set the `ASSET_MODE` constant at the top of the file to `repo-copy` (default) to also save a local copy under `public/images/blog/<primary-locale-slug>.<ext>` for git asset history, or `sanity-only` to skip the local copy and upload only to Sanity (§1.J3). The patch loop checks each locale's post document exists before patching, so topics that only have posts in a subset of locales (§1.B4 = independent) are handled safely.

```typescript
/**
 * Blog hero image generator + uploader.
 *
 * For each TOPIC:
 *   1. Calls Gemini 3 Pro Image (Nano Banana Pro) with a crafted prompt
 *   2. Optionally saves a local copy under public/images/blog/<slug>.<ext>
 *   3. Uploads to Sanity as an image asset
 *   4. Patches every locale's post doc with heroImage + localized alt
 *
 * Usage:
 *   pnpm tsx scripts/generate-hero-images.ts                       # all topics
 *   pnpm tsx scripts/generate-hero-images.ts slug-1 slug-2         # subset by primary-locale slug
 *   pnpm tsx scripts/generate-hero-images.ts --force               # regenerate
 *
 * Env required: GEMINI_API_KEY, NEXT_PUBLIC_SANITY_PROJECT_ID,
 * SANITY_API_WRITE_TOKEN. Idempotent: posts with an existing
 * heroImage.asset are skipped unless --force is passed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "next-sanity";

const GEMINI_MODEL = "gemini-3-pro-image-preview";
const ASPECT_RATIO = "16:9";

// §1.J3 — `repo-copy` also writes the image under public/images/blog/<primary-slug>.<ext>
// for git asset history; `sanity-only` skips the local copy and relies on Sanity CDN.
const ASSET_MODE: "repo-copy" | "sanity-only" = "repo-copy";

// Locales list — match the order in §1.B1. The first entry is the primary locale.
const LOCALES = ["en"] as const; // e.g. ["en", "fr", "de"]

type Topic = {
  /** Per-locale slugs, keyed by locale code. Primary locale's slug is used for the local file copy. */
  slugs: Record<(typeof LOCALES)[number], string>;
  prompt: string;
  /** Per-locale alt text, keyed by locale code. */
  alt: Record<(typeof LOCALES)[number], string>;
};

// Replace per project. One entry per article. Craft prompts using the
// style guide; keep alt descriptive (what's in frame), not a headline restatement.
const TOPICS: Topic[] = [
  // Example shape:
  // {
  //   slugs: { en: "example-slug", fr: "exemple-slug" },
  //   prompt: "Editorial documentary photograph, 50mm lens, magazine-quality. 16:9 landscape. ...",
  //   alt: { en: "...", fr: "..." },
  // },
];

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const sanityToken = process.env.SANITY_API_WRITE_TOKEN;
const geminiKey = process.env.GEMINI_API_KEY;

if (!projectId) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID");
if (!sanityToken) throw new Error("Missing SANITY_API_WRITE_TOKEN");
if (!geminiKey) throw new Error("Missing GEMINI_API_KEY");

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2025-03-04",
  token: sanityToken,
  useCdn: false,
});

const BLOG_IMAGES_DIR = resolve(process.cwd(), "public/images/blog");

async function generateImage(prompt: string): Promise<{ buffer: Buffer; mime: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { imageConfig: { aspectRatio: ASPECT_RATIO } },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((part) => part.inlineData);
  if (!img?.inlineData) {
    throw new Error(`No image in Gemini response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return { buffer: Buffer.from(img.inlineData.data, "base64"), mime: img.inlineData.mimeType };
}

async function postHasHeroImage(id: string): Promise<boolean> {
  const doc = await client.fetch<{ heroImage?: { asset?: unknown } } | null>(
    `*[_id == $id][0]{ heroImage }`,
    { id },
  );
  return Boolean(doc?.heroImage?.asset);
}

async function postExists(id: string): Promise<boolean> {
  const doc = await client.fetch<{ _id: string } | null>(
    `*[_id == $id][0]{ _id }`,
    { id },
  );
  return Boolean(doc);
}

async function processTopic(topic: Topic, force: boolean): Promise<"skipped" | "done"> {
  const ids = LOCALES.map((loc) => ({ loc, id: `post.${loc}.${topic.slugs[loc]}` }));

  if (!force) {
    const checks = await Promise.all(ids.map(({ id }) => postHasHeroImage(id)));
    if (checks.every(Boolean)) {
      console.log(`  ↷ already has hero image on every locale — skipping (pass --force to override)`);
      return "skipped";
    }
  }

  console.log(`  • generating via ${GEMINI_MODEL}…`);
  const { buffer, mime } = await generateImage(topic.prompt);
  const ext = mime === "image/png" ? "png" : "jpg";
  const primarySlug = topic.slugs[LOCALES[0]];

  if (ASSET_MODE === "repo-copy") {
    const localPath = resolve(BLOG_IMAGES_DIR, `${primarySlug}.${ext}`);
    await writeFile(localPath, buffer);
    console.log(`  • wrote ${localPath} (${(buffer.length / 1024).toFixed(0)} KB, ${mime})`);
  } else {
    console.log(`  • skipping local copy (ASSET_MODE = sanity-only)`);
  }

  console.log(`  • uploading to Sanity…`);
  const asset = await client.assets.upload("image", buffer, {
    filename: `blog-hero-${primarySlug}.${ext}`,
    contentType: mime,
  });
  console.log(`  • asset ${asset._id}`);

  // §B4 default = independent: posts can exist in any subset of locales.
  // Check each locale doc and skip the ones that don't have a post for this topic.
  const existence = await Promise.all(ids.map(({ id }) => postExists(id)));
  const present = ids.filter((_, i) => existence[i]);
  const missing = ids.filter((_, i) => !existence[i]);
  for (const { loc, id } of missing) {
    console.log(`  ↷ no post for ${loc} (${id}) — skipping that locale`);
  }

  for (const { loc, id } of present) {
    await client
      .patch(id)
      .set({
        heroImage: {
          _type: "image",
          asset: { _type: "reference", _ref: asset._id },
          alt: topic.alt[loc],
        },
      })
      .commit();
    console.log(`  ✓ patched ${id}`);
  }

  return "done";
}

async function main() {
  if (!existsSync(BLOG_IMAGES_DIR)) await mkdir(BLOG_IMAGES_DIR, { recursive: true });

  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes("--force");
  const slugArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
  const selected = slugArgs.length
    ? TOPICS.filter((t) => slugArgs.includes(t.slugs[LOCALES[0]]))
    : TOPICS;

  if (slugArgs.length && selected.length !== slugArgs.length) {
    const known = new Set(TOPICS.map((t) => t.slugs[LOCALES[0]]));
    const unknown = slugArgs.filter((a) => !known.has(a));
    throw new Error(`Unknown slug(s): ${unknown.join(", ")}`);
  }

  console.log(`Processing ${selected.length} topic(s) with ${GEMINI_MODEL}…`);
  for (const topic of selected) {
    console.log(`\n[${topic.slugs[LOCALES[0]]}]`);
    await processTopic(topic, force);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 20.4 Frontend integration

- Hero image rendered via Next/Image with `priority`, `fill`, `sizes` (see §14.3), and `placeholder="blur"` + `blurDataURL={post.heroImage.lqip}` from the Sanity metadata.
- Per §1.J3 keep (or skip) the repo copy under `public/images/blog/<primary-slug>.<ext>` alongside the Sanity upload. The frontend always reads from Sanity CDN; the repo copy exists only for git history, design review, and disaster recovery.
- Subtle scroll parallax allowed on the article hero per §14.5 — must preserve `priority` and wrap the parallax transform inside the aspect-locked container so CLS stays zero.
- Re-run the generator with `--force <slug>` to regenerate a single article's hero without affecting the others.
- Single image per topic is shared across all locales by default (one asset, per-locale alt text). If a project needs locale-specific imagery (e.g. text-bearing imagery that differs per language), split each topic into one `TOPICS` entry per locale.

### 20.5 Checklist

- [ ] `GEMINI_API_KEY`, `SANITY_API_WRITE_TOKEN`, `NEXT_PUBLIC_SANITY_PROJECT_ID` set in `.env.local`
- [ ] Key has access to the model selected in §1.J2 (verify via `models.list`)
- [ ] `blog-image-style-guide.md` intake completed and tailored to this project
- [ ] `TOPICS` array in the generator populated with one entry per article
- [ ] One smoke-test image generated and reviewed for on-brand adherence before batching the full set
- [ ] Generated images render correctly in the article hero layout (parallax + LQIP blur)
- [ ] Hero images referenced in `BlogPosting` JSON-LD (see §7.1) resolve to the expected Sanity CDN URL
- [ ] Alt text descriptive (what is in frame) rather than a headline restatement (accessibility + SEO)

---

## Appendix A — Open decisions deferred to implementation

Most project-specific deferrals live in §1. Items below are implementation-time decisions that do not belong in the profile:

- Whether the ToC active-section highlight tracks H2 only or also H3, if/when H3 support is added later.
- Exact sticky-ToC desktop breakpoint if the site-wide layout disagrees with the default ≥1024px.
- Whether deletion webhooks from Sanity trigger revalidation via `revalidateTag` or a full rebuild (depends on hosting).
- Whether body images use `<figure>`/`<figcaption>` for captions (yes if captions are common; no if rare).

## Appendix B — Deliberate non-features

The following are considered and explicitly excluded by default. Move an item into scope only by explicit decision in §0.K.

- Tags and tag pages
- Category landing pages
- Comments
- Site-wide search / blog search
- Social sharing buttons
- Author bio pages (separate from the author entity itself)
- Newsletter signup inside articles (site-wide footer only)
- Visual Editing / Sanity Presentation (can be enabled later if §1.I2 = none)
- Scheduled publishing (acceptable but not required by default)
- Reading progress bar
- Dark mode toggle specific to blog (inherits site-wide if any)
- Embedded video, code blocks, pull quotes, downloadable files
- Cross-locale translation linkage (only enabled when §1.B4 = cross-linked)
- Post-level hreflang (only emitted when §1.B4 = cross-linked)
- Multiple image crops in `BlogPosting` JSON-LD — a single hero image URL is emitted. Google accepts this; multiple aspect ratios (16:9, 4:3, 1:1) are a "best results" suggestion that adds complexity without proportional return at this scale.
