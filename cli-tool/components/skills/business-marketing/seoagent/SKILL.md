---
name: SEOAgent
description: Persistent SEO workflow for Claude Code — run a technical SEO audit, build a hub-and-spoke keyword strategy, write page-type-aware content briefs, and draft SEO-optimized articles, persisting every artifact to a .seoagent/ workspace so the work compounds across sessions. Use when auditing a site's technical SEO, planning a keyword/content strategy, writing content briefs, drafting SEO articles with structured data, or resuming SEO work started in a previous session.
---

# SEOAgent

A persistent, repo-local SEO workflow. Unlike one-off SEO prompts that lose their context the moment the conversation ends, every artifact here is written to a `.seoagent/` directory in the repo — so audits, strategy, briefs, and drafts accumulate across sessions instead of resetting each time.

## When to Use This Skill

Use this skill when the user wants to:
- Run a **technical SEO audit** of a site (meta tags, headings, internal links, schema, Core Web Vitals readiness, AI-search optimization)
- Build a **keyword strategy** with topic clusters and an internal-linking structure
- Write a **content brief** for a specific page or article
- **Draft an SEO-optimized article** with full metadata and JSON-LD
- **Resume** SEO work — read back prior audit findings, strategy, or the roadmap

## Workspace Model

All work persists to `.seoagent/` so it survives across sessions:

```
.seoagent/
  project.md           # domain, site type
  context.md           # business context, tone, banned topics
  audit/latest.md      # findings as [ ] / [x] checkboxes, tagged by severity
  strategy/clusters/   # hub-and-spoke topic clusters
  briefs/{slug}.md     # page-type-aware briefs
  content/{slug}.md    # drafts with SEO frontmatter + JSON-LD
  roadmap.md           # prioritized next steps
  changelog.md         # history of SEO work
```

Always read existing `.seoagent/` files before acting, and write results back so the next session can build on them.

## Workflow (5 phases)

### 1. Technical audit
Fetch the site's key pages and check each against the list below. Save findings to `.seoagent/audit/latest.md` as `[ ]` checkboxes the user can flip to `[x]` when fixed, each tagged `critical | high | medium | low`.

**Critical / high**
- [ ] Indexability: no accidental `noindex`, no blocked paths in robots.txt, canonical present and self-referential
- [ ] Title tag: present, unique, 50–60 chars, primary keyword near the front
- [ ] Meta description: present, unique, 140–160 chars, compelling
- [ ] One `<h1>` per page, descriptive; logical `h2`/`h3` hierarchy
- [ ] Internal links: no orphan pages; descriptive anchor text
- [ ] Structured data: appropriate JSON-LD (Organization/Article/Product/FAQ) present and valid

**Medium / low**
- [ ] Image `alt` text on content images
- [ ] OpenGraph + Twitter card tags for social sharing
- [ ] Core Web Vitals readiness (LCP image preloaded, no layout shift, reasonable JS)
- [ ] Clean, keyword-relevant URL slugs
- [ ] XML sitemap present and submitted; HTTPS enforced

### 2. Keyword strategy (hub-and-spoke)
Research the niche, then build topic clusters where each cluster has roles:
- **PILLAR** — broad, high-value hub page
- **SUB_PILLAR** — focused subtopics linking up to the pillar
- **LONG_TAIL** — specific questions/niche queries linking up to sub-pillars

Internal links funnel authority *up* toward pillars. Save clusters to `.seoagent/strategy/clusters/{slug}.md` with the article table + link graph.

### 3. Content briefs (page-type-aware)
Different page types need different structures. Pick the protocol by type:
- **landing** — conversion-focused, Product/Service JSON-LD
- **pillar** — comprehensive overview, links to all sub-pillars
- **sub_pillar** — focused subtopic depth
- **long_tail** — direct answer to a specific query, FAQPage JSON-LD
- **programmatic** — templated pages from a data set

Each brief gets a URL pattern, section outline (H2/H3), internal-link plan, JSON-LD plan, and a word-count target. Save to `.seoagent/briefs/{slug}.md`.

### 4. Draft articles
Write from the brief with complete SEO frontmatter:
- `meta_title`, `meta_description`, `canonical`
- OpenGraph + Twitter fields
- JSON-LD: `Article`, plus `FAQPage` / `HowTo` where the content warrants it
- An image plan (hero + inline) with alt text

Save to `.seoagent/content/{slug}.md`.

### 5. Monitor
Re-audit periodically, update `.seoagent/roadmap.md` with the next highest-leverage actions, and append what changed to `.seoagent/changelog.md`.

## Answer-engine optimization (AEO/GEO)
Beyond classic SEO, structure content so AI assistants (ChatGPT, Claude, Perplexity, Google AI Overviews) can cite it: lead with a direct answer, use clear headings as questions, include comparison tables and concrete stats, and add FAQ/HowTo structured data. This makes pages citable in AI-generated answers, not just rankable.

## Running the full agent
This skill captures the SEOAgent methodology. The full agent ships as a CLI that scaffolds the `.seoagent/` workspace, installs an expanded reference library (per-page-type protocols, a JSON-LD library, an audit-check catalog), and adds an optional cloud loop:

```bash
# npm
npm install -g @seoagent-official/seoagent && seoagent init

# or the plugin marketplace (Claude Code or Codex)
/plugin marketplace add Baxter-Inc/seoagent-npm
```

Free and local by default (uses your agent's own tools; data stays in your repo). Optional cloud adds real keyword data, Google Search Console, and CMS publishing. MIT licensed — https://github.com/Baxter-Inc/seoagent-npm
