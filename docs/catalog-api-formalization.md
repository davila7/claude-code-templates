# Catalog JSON as a public API: audit and formalization proposal

Status: proposal for review. Nothing in this document has been implemented.
Audit date: 2026-10-21, against `main` at `08a04c6`.

Scope of this pass: read-only audit plus a proposal. The existing JSON URLs,
their schema and `scripts/generate_components_json.py` are unchanged.

---

## TL;DR

- There is not one catalog JSON but **seven public JSON surfaces**, served from
  two hosts (aitmpl.com and raw.githubusercontent.com). The two known external
  consumers read **different files on different hosts**: niche-db reads
  `docs/components.json` straight from GitHub, the `/aitmpl` mod reads the
  dashboard's per-type slices from www.aitmpl.com.
- The `/aitmpl` mod is not really third-party. It is **our own mod**
  (`cli-tool/components/mods/productivity/aitmpl`, added in #915 on
  2026-09-17); the abdullahdev38 repo is a plain fork carrying an older copy
  (v0.1.1, upstream is v0.4.0). Every user who ran `--mod productivity/aitmpl`
  has a frozen copy in `.claude/skills/aitmpl/` that we cannot update. That
  makes it the consumer most exposed to a format change, and one we own.
- Serving is already better than "informal" suggests: every catalog file on
  aitmpl.com has `Access-Control-Allow-Origin: *`, a 5 minute
  `Cache-Control`, and (inferred) a Cloudflare Pages ETag. `/openapi.json`
  (#1200) already describes five of the files. What is missing is a
  **version, a schema that is enforced, a stability policy, and a changelog**.
- The current shape has warts a contract should not freeze: a `type` of
  `"sandbo"`, a `security` object that is `validated: false` on all 1,922
  components, empty strings instead of nulls, a `componentsMarketplace` block
  with 8 stale agents, `templates`/`plugins` groups that are retired or empty,
  and a malformed timestamp in `trending-data.json`.
- **Recommendation: formalize**, with a new versioned surface
  (`/api/v1/catalog.json` + per-type slices + `schema.json` + a tiny
  `version.json` for cheap polling), generated alongside the legacy files,
  validated in CI. Legacy URLs keep working unchanged; they are declared
  internal to the site, not frozen. MVP is about 2 to 2.5 days of work.

---

# Phase 1: Audit

## 1. Where the catalog comes from

### Generation

| Step | What runs | Writes |
|---|---|---|
| Content refresh | `.github/workflows/update-component-content.yml` on every push to `main` touching `cli-tool/components/**` (or the generator). Runs `generate_components_json.py --skip-downloads`, commits, then dispatches `deploy.yml`. | all catalog files below |
| Daily refresh | `.github/workflows/update-json-data.yml`, cron `0 3 * * *` UTC. Runs `generate_components_json.py` (pulls download counts from Supabase `component_downloads`) and `generate_trending_data.py`, copies `docs/trending-data.json` to `dashboard/public/`, rebuilds its commit on fresh `main` if needed (#1141), dispatches `deploy.yml`. | all catalog files + trending |
| Deploy | `.github/workflows/deploy.yml`: `astro build` + `wrangler pages deploy dist --project-name=aitmpl-dashboard`. Runs no Python; the committed files are the only source. | www.aitmpl.com |

`scripts/generate_components_json.py` (1,084 lines) scans
`cli-tool/components/{type}/{category}/*`, parses frontmatter (YAML with a
line-parser fallback since #1070), merges download counts (full-table keyset
pagination since #1005), attaches SkillSpector results (#1204), then writes:

1. `dashboard/public/component-content/{type}/{category}/{name}.json` (per component, `content` + `files` for mods)
2. `docs/components.json` (full index minus `content`/`files`, keeps `security` and `skillspector.hash`, pretty-printed)
3. `dashboard/public/components.json` (same minus `security`, minus `skillspector.hash`, minified)
4. `dashboard/public/counts.json`
5. `dashboard/public/components/{type}.json` (one per top-level key of #3)
6. `dashboard/public/search-index.json`

`trending-data.json` comes from `scripts/generate_trending_data.py` (Supabase,
daily only).

**Update cadence in practice:** content changes several times a day (every
component merge), download counts and trending once a day after 03:00 UTC.
There is no fixed publication time and no "generated at" field in any
catalog file except `trending-data.json`.

### Public URLs, size, headers

Sizes are from the committed files at `08a04c6`; gzip sizes measured locally
with Python's `gzip` (Cloudflare may serve Brotli, which is smaller).

| URL | Source file | Raw | gzip | Who reads it |
|---|---|---|---|---|
| `https://www.aitmpl.com/components.json` | `dashboard/public/components.json` | 2.32 MB | 418 KB | dashboard SSR (`lib/data.ts`), `PUBLIC_COMPONENTS_JSON_URL` |
| `https://www.aitmpl.com/components/{type}.json` (11 files) | `dashboard/public/components/*.json` | agents 766 KB, skills 1.08 MB | agents 176 KB | `ComponentGrid.tsx`, WebMCP, **`/aitmpl` mod** |
| `https://www.aitmpl.com/counts.json` | `dashboard/public/counts.json` | 160 B | | `Sidebar.astro`, `llms.txt`, WebMCP, **`/aitmpl` mod** |
| `https://www.aitmpl.com/search-index.json` | `dashboard/public/search-index.json` | 1.17 MB | 308 KB | `SearchModal.tsx` |
| `https://www.aitmpl.com/component-content/{type}/{category}/{name}.json` | `dashboard/public/component-content/**` | per file | | detail pages, Send-to-repo |
| `https://www.aitmpl.com/trending-data.json` | `dashboard/public/trending-data.json` | 30 KB | 4 KB | `TrendingView.tsx`, home counters, WebMCP, **`/aitmpl` mod** |
| `https://raw.githubusercontent.com/davila7/claude-code-templates/main/docs/components.json` | `docs/components.json` | 3.32 MB | 476 KB | **niche-db**, `daily-component-discord.yml` (jq), legacy `docs/` site |
| `https://davila7.github.io/claude-code-templates/components.json` | `docs/components.json` via GitHub Pages | same | | legacy site only (as far as found) |
| `https://aitmpl.com/api/agents.json` | none on Cloudflare Pages | | | first-party CLI fallback, see §4 |

**Headers on aitmpl.com**, from `dashboard/public/_headers` (configured, not
observed: the container proxy blocks aitmpl.com, so no live request was made):

| Path | Cache-Control | CORS | Content-Type | ETag / Last-Modified |
|---|---|---|---|---|
| `/components.json`, `/counts.json`, `/components/*`, `/search-index.json`, `/component-content/*` | `public, max-age=300, stale-while-revalidate=3600` (since #1228) | `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET` | not set in `_headers`; inferred `application/json` from the extension (Pages default) | not set in `_headers`; **inferred**: Pages sends an `ETag` on static assets and answers `If-None-Match` with 304 (the `_headers` comment relies on this). No `Last-Modified` is expected. |
| `/trending-data.json` | `public, max-age=3600, stale-while-revalidate=300` | same | inferred | inferred |
| `/openapi.json` | `public, max-age=86400, ...` | same | `application/json; charset=utf-8` (explicit) | inferred |
| all paths (`/*`) | | | | plus `X-Content-Type-Options: nosniff`, HSTS, `X-Frame-Options: DENY` |

No `Access-Control-Expose-Headers`, so a browser consumer cannot read the
`ETag` from JS (the browser's own cache still revalidates with it).

**Headers on raw.githubusercontent.com** are GitHub's, not ours, and not
observed here: from general knowledge it serves `text/plain; charset=utf-8`,
`Cache-Control: max-age=300`, an `ETag`, and `Access-Control-Allow-Origin: *`.
We cannot add headers, versioning or deprecation notices to that URL.

### Existing machine-readable docs

- `/openapi.json` (#1200, `info.version: 1.0.0`) documents `/search-index.json`,
  `/components/{type}.json`, `/component-content/...`, `/counts.json`,
  `/trending-data.json`. It does **not** document `/components.json` or the
  GitHub `docs/components.json`. Its description says responses are "cached at
  the edge for up to 24 hours", which is stale since #1228 (5 minutes).
  Its `Component` schema lists 6 of the 12 fields actually served and marks
  none as required beyond `type`, `name`, `path`; `ComponentType` lists
  `sandbox` but not that its `type` value is `sandbo`.
- `/llms.txt` points agents at `/openapi.json`.
- `/api/*` is caught by `dashboard/src/pages/api/[...path].ts`, which returns a
  JSON 404 pointing at `/openapi.json`. This matters for the proposed
  `/api/v1/` path (§7).

## 2. Current schema

### `docs/components.json` and `dashboard/public/components.json`

Top-level object. Counts at `08a04c6`:

| Key | Type | Count | Notes |
|---|---|---|---|
| `agents` | `Component[]` | 422 | |
| `commands` | `Component[]` | 288 | |
| `mcps` | `Component[]` | 107 | |
| `settings` | `Component[]` | 77 | |
| `hooks` | `Component[]` | 63 | |
| `sandbox` | `Component[]` | 11 | entries are docs and config files (`README.md`, `package.json`, `tsconfig.json`), not components; `type` is `"sandbo"` |
| `skills` | `Component[]` | 891 | |
| `loops` | `Component[]` | 18 | |
| `mods` | `Component[]` | 45 | was `function-hooks` until #910 (2026-09-16) |
| `templates` | `Template[]` | 14 | different shape, no `path`; retired on the site |
| `plugins` | `Plugin[]` | 0 | always empty: the generator reads `.claude-plugin/marketplace.json`, which does not exist |
| `componentsMarketplace` | object | `{agents: [8]}` | copy of `cli-tool/components/.claude-plugin/marketplace.json`; 8 agents, unrelated to the 422 above |
| `marketplace` | object | absent | written only if `.claude-plugin/marketplace.json` exists |

Every group is sorted by `path` (templates and plugins by `name`). Order is
alphabetical, never by downloads or anything else.

**`Component`** (all 9 component groups):

| Field | Type | Present | Notes |
|---|---|---|---|
| `name` | string | always | equals the last path segment without extension (holds for all 1,922 today). **Not unique within a type**: 12 agent names, 16 skill names, 2 command names repeat across categories. |
| `path` | string | always | `{category}/{name}.md` (agents, commands, loops, sandbox), `{category}/{name}.json` (mcps, settings, hooks), `{category}/{name}` (skills, mods: directories). Unique within a type. **This is the only real key.** |
| `category` | string | always | equals the first path segment (holds for all today). Free-form directory name, no fixed list. |
| `type` | string | always | singular of the group key via `component_type[:-1]`, hence `sandbo`. |
| `description` | string | always | Verbatim frontmatter / JSON description. 129 agents and 53 commands keep surrounding quotes or literal `\n`; many agent descriptions embed `<example>` blocks of several KB; 73 are empty strings. |
| `author`, `repo`, `version`, `license` | string | always | `""` when unknown, which is the norm (author empty on 1,668 of 1,922, repo on 1,871). |
| `keywords` | string[] | always | usually `[]` |
| `downloads` | integer | always | total installs from Supabase, full-table since #1005 (2026-09-26); before that partial. Changes daily. |
| `security` | object | `docs/` only | `{validated, valid, score, errorCount, warningCount, lastValidated}`. **`validated: false, valid: null, score: null` on all 1,922 components**: the field is dead. |
| `skillspector` | object | always (since #1204, 2026-10-18) | `{score, severity: LOW\|MEDIUM\|HIGH\|CRITICAL, recommendation, issueCount, analysis: complete\|partial, findings[≤5], version, scannedAt, hash}`; `hash` only in `docs/`. Display-only by project rule. New and likely to change. |
| `references` | string[] | skills, mods | relative file list of the directory |
| `modules` | string[] | mods | hooks-module filenames |
| `userConfig` | object | mods | copy of `plugin.json` `userConfig` |

**`Template`**: `name, id, type: "template", subtype, category, language?
(8 of 14), description, files[] (docs only), installCommand, downloads`.

### `dashboard/public/components/{type}.json`

A bare JSON array, identical to the matching group of
`dashboard/public/components.json`. Files exist for all 11 list groups
(`plugins.json` is `[]`). No envelope, no version, no timestamp.

### `counts.json`

`{ "agents": 422, ..., "templates": 14, "plugins": 0 }`: one key per list
group of `components.json`. Includes `sandbox`, `templates` and `plugins`, so
its sum (1,936) is not the number of browsable components.

### `search-index.json`

Flat array of `{type, name, path, description, category}` across all groups,
templates included (with `path: null`).

### `component-content/{type}/{category}/{name}.json`

`{ content: string, files?: {relPath: string} }`. Slug is `path` with `.md`
/ `.json` stripped.

### `trending-data.json`

`{ lastUpdated, globalStats: {totalComponents, totalDownloads,
monthlyDownloads, weeklyDownloads, todayDownloads, totalCountries},
topCountries[], trending: {commands, mcps, agents, settings, hooks, templates,
skills, mods, loops, all: [...]}, chartData }`. Trending rows are
`{id: "{singular}-{name}", name, category, downloadsToday, downloadsWeek,
downloadsMonth, downloadsTotal}`. `lastUpdated` is malformed:
`2026-10-21T03:13:53.368524+00:00Z` (offset **and** `Z`), which strict
ISO 8601 parsers reject.

### Inconsistencies and things likely to change

1. Type naming has three spellings: plural group keys (`agents`), singular
   `type` values (`agent`, `sandbo`), and CLI flags (`--agent`, `--mcp`).
   Consumers rebuild the mapping themselves (both known consumers hard-code it).
2. `name` is not unique; consumers that key on `{type, name}` collide.
3. `security` is dead but still published in `docs/`; niche-db republishes
   it as `securityValidated: false` for every component.
4. `skillspector` is two days old, display-only, and its findings list and
   severity bands will evolve.
5. `sandbox`, `templates`, `plugins`, `componentsMarketplace` are leftovers.
6. Empty string vs missing vs null is not defined.
7. `docs/` is described in CLAUDE.md as the "legacy static site". Any cleanup
   that removes `docs/components.json` breaks niche-db with no warning.
8. Install commands and page URLs are not in the data; every consumer builds
   them from `type`, `category` and `name`.
9. Sponsored placements: **not in any catalog file.** They come only from
   `GET /api/ads/active` (`{ads: [{component_type, component_path,
   component_name, ends_at}]}`, empty while `PUBLIC_ADS_ENABLED` is unset)
   and are merged client-side by `dashboard/src/lib/ads.ts`. Good, and the
   formal contract should keep it that way explicitly (§6).

## 3. Known consumers

### 3a. `/aitmpl` mod (ours; forked copy at abdullahdev38/claude-code-templates)

Source: `cli-tool/components/mods/productivity/aitmpl/hooks/{register.tsx,catalog.ts}`
upstream (v0.4.0); the fork holds v0.1.1 from #915. Both versions read the
same URLs and fields. Installed copies on users' machines are frozen at
whatever version they installed (46 recorded downloads).

| Reads | Host | Fields / structure relied on |
|---|---|---|
| `{siteUrl}/counts.json` | www.aitmpl.com (option `siteUrl`) | top-level object of numbers keyed by plural type |
| `{siteUrl}/components/{type}.json` for `agents, commands, mcps, settings, hooks, skills, loops, mods` | www.aitmpl.com | **body must be an array** (throws otherwise); per row `name` (required, string), `path` (optional string), `category`, `description`, `downloads` (number). Sorts by `downloads` client-side. |
| `{siteUrl}/trending-data.json` | www.aitmpl.com | `globalStats.{totalComponents,totalDownloads,weeklyDownloads,totalCountries}`; `trending.all[]` rows with `id` = `{singular}-{name}`, `name`, `category`, `downloadsWeek`. Derives the type by stripping `-{name}` from `id` and matching `--{prefix}` to its CLI flag table. |
| `{siteUrl}/component/{type}/{category}/{name}` | www.aitmpl.com | the detail page route, opened in the browser |
| `npx claude-code-templates@latest --{flag} {category}/{name}` | npm | built from `path` minus extension, validated against `[A-Za-z0-9._-]` segments |

### 3b. niche-db (profullstack/niche-db)

Source: `packages/adapters/src/aitmpl.js`, added in 41d1592 (2026-09-25),
refactored in 3d6f803 (2026-10-04) into six adapters.

| Reads | Host | Fields / structure relied on |
|---|---|---|
| `https://raw.githubusercontent.com/davila7/claude-code-templates/main/docs/components.json`, fetched once per adapter (6 times per cycle, cadence 8 h for skills/agents, 12 h for the rest) | GitHub | top-level groups `skills, agents, commands, hooks, settings, loops, mods, mcps` (`index[group] ?? []`); per row `name` and `path` (row dropped if either is empty), `category`, `description` (strips quotes and whitespace), `keywords` (array, first 10), `author`, `repo`, `version`, `license` (empty string → null), `downloads` (`Number.isFinite`), `security.validated`, `security.score` |
| derived | | `externalId = aitmpl:{group}:{path}` (their dedupe key), source URL `github.com/.../blob/main/cli-tool/components/{group}/{path}`, install command `--{kind} {category}/{name}` with `mcp-config` mapped to `--mcp` |

They explicitly skip `sandbox` (citing the `sandbo` type) and `templates`
(no `path`), so they already work around two of our warts.

### 3c. Other consumers found

GitHub code search could not be used: this session's GitHub access is scoped
to our two repos, and grep.app is blocked by both the cloud proxy and the
proxy on Daniel's machine. Web search for the URLs found only our own docs.
**The external map is therefore incomplete**: it covers the two known
consumers plus first-party code. Cloudflare analytics on the catalog paths
(by User-Agent and Referer) is the practical way to find the rest (§9, step L4).

First-party consumers found in this repo, which a format change also breaks:

| Consumer | Reads |
|---|---|
| Dashboard islands (`ComponentGrid`, `SearchModal`, `Sidebar`, `TrendingView`, `SendToRepoModal`, `MyComponentsView`), SSR `lib/data.ts`, `llms.txt.ts`, `sitemap.xml.ts`, `home-stats.ts` | `/components.json`, `/components/{type}.json`, `/counts.json`, `/search-index.json`, `/component-content/**`, `/trending-data.json` |
| WebMCP tools (`dashboard/src/lib/webmcp.ts`), exposed to browser agents | `/components/{type}.json`, `/counts.json`, `/trending-data.json` |
| `.github/workflows/daily-component-discord.yml` | `jq` over `docs/components.json` groups `agents, commands, mcps, settings, hooks` |
| CLI `getAvailableAgentsFromGitHub()` (`cli-tool/src/index.js:1439`) | `../../docs/components.json`, which the npm package does not ship, then **`https://aitmpl.com/api/agents.json`, which does not exist on Cloudflare Pages** (it was `docs/api/agents.json` on the old Vercel/GitHub Pages site; today it hits the `/api/*` JSON 404), then the GitHub contents API (60 req/h unauthenticated). A dead URL in a released CLI, unrelated to this proposal but found by it. |
| `cli-tool/src/sandbox-server.js` | `../../docs/components.json` (same packaging gap) |

## 4. Risks: what breaks, for whom, and how loudly

"Silent" means the consumer keeps running and publishes wrong or empty data.

| Change | niche-db | `/aitmpl` mod (all installed copies) | Dashboard / WebMCP |
|---|---|---|---|
| Rename a group key (e.g. `mcps` → `mcp-servers`) | **silent**: `index[group] ?? []` gives 0 rows for that collection | URL `components/mcps.json` 404s: loud error in the pane | breaks until updated (same PR) |
| Rename `name` or `path` | **silent**: every row dropped (`toItem` returns null) | `name`: every row skipped, empty list (silent); `path`: falls back to `name`, wrong install arg | breaks |
| Change `path` format (drop extension, add type prefix) | **silent**: `externalId` changes, every row re-ingested as new and old rows orphaned; blob URLs may 404 | install arg and page URL wrong (silent until clicked) | breaks |
| `downloads` to string / object | **silent**: `null` | **silent**: 0, sort order lost | breaks |
| `keywords` not an array | silent: tags dropped | not read | |
| Remove `security` | none (already always false) | not read | none (dashboard strips it) |
| Change or remove `skillspector` | not read | not read | badge breaks |
| Wrap per-type arrays in an envelope | n/a (reads `docs/`) | **throws**: "catalog body is not an array", pane unusable | breaks |
| Change trending `id` format | n/a | **silent**: trending column empty | |
| Rename a CLI flag / type (as `--function-hook` → `--mod`) | install commands they publish stop working (silent) | install button fails (loud, in the terminal) | |
| Move or delete `docs/components.json` (e.g. retiring the legacy `docs/` site) | **loud on their side, invisible to us**: every pull fails | n/a | Discord daily workflow breaks |
| Move dashboard files (e.g. `/components/*` → `/data/*`) | n/a | loud error in pane | breaks until updated |
| Change `/component/{type}/...` route | n/a | open-in-browser 404s | internal links |
| File grows (1,922 components today, 3.3 MB) | 6 × 3.3 MB per cycle from GitHub | per-type file per pane open | |

In every case **we never find out**: neither consumer reports back, and
the mod copies on users' disks cannot be updated by us.

---

# Phase 2: Formalization proposal

## 5. Principles

1. **New surface, old surface untouched.** The site keeps reading its own
   files and they stay free to evolve with the site. External consumers get a
   separate, versioned, documented surface generated from the same data in
   the same run.
2. **The schema is enforced, not described.** The generator validates its v1
   output against the published JSON Schema in CI; an invalid catalog never
   ships.
3. **One envelope, one key, data instead of conventions.** v1 carries a stable
   `id`, the install arguments and the URLs, so consumers stop rebuilding them.
4. **No sponsorship in the catalog.** v1 never contains placement data, and
   its order is fixed and documented as alphabetical by `id`.

## 6. The v1 contract

### URLs

| URL | Content | Approx size |
|---|---|---|
| `https://www.aitmpl.com/api/v1/catalog.json` | every component, all types | ~2.9 MB raw, ~440 KB gzip (prototyped on today's data: 1,911 components) |
| `https://www.aitmpl.com/api/v1/catalog/{type}.json` | one type (`agents`, `commands`, `skills`, `hooks`, `mcps`, `settings`, `loops`, `mods`) | agents ~950 KB raw |
| `https://www.aitmpl.com/api/v1/version.json` | `{schemaVersion, generatedAt, sha256, counts}` for cheap polling | < 1 KB |
| `https://www.aitmpl.com/api/v1/schema.json` | JSON Schema (draft 2020-12), `$id` = its URL | |
| `https://www.aitmpl.com/developers/catalog-api` | docs page | |

`/api/v1/` is what you suggested. Caveat to verify in the first preview
deploy: `/api/*` is also matched by the `[...path].ts` catch-all function.
Static files under `dashboard/public/api/v1/` should win because the Astro
Cloudflare adapter excludes public assets in `_routes.json`, but that is
inferred, not tested. If the function shadows them, use `/v1/` or `/data/v1/`
instead; nothing else in the proposal changes.

### Envelope (both `catalog.json` and `catalog/{type}.json`)

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-10-21T03:13:53Z",
  "source": "https://github.com/davila7/claude-code-templates",
  "license": "MIT",
  "count": 1,
  "components": [
    {
      "id": "agents/development-team/frontend-developer",
      "type": "agents",
      "name": "frontend-developer",
      "category": "development-team",
      "path": "development-team/frontend-developer.md",
      "description": "Frontend development specialist for React applications...",
      "author": null,
      "repo": null,
      "version": null,
      "license": null,
      "keywords": ["frontend", "react"],
      "downloads": 52310,
      "install": {
        "command": "npx claude-code-templates@latest --agent development-team/frontend-developer",
        "args": ["--agent", "development-team/frontend-developer"]
      },
      "urls": {
        "page": "https://www.aitmpl.com/component/agents/development-team/frontend-developer",
        "source": "https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/agents/development-team/frontend-developer.md",
        "content": "https://www.aitmpl.com/component-content/agents/development-team/frontend-developer.json"
      },
      "files": null,
      "scan": {
        "tool": "skillspector",
        "toolVersion": "2.12.0",
        "severity": "LOW",
        "score": 0,
        "scannedAt": "2026-10-17T20:36:45Z"
      }
    }
  ]
}
```

(Values illustrative; `downloads` and the description are not the real ones.)

### Field rules

| Field | v1 rule | Differs from legacy |
|---|---|---|
| `id` | `{type}/{category}/{name}`, unique across the catalog, stable for the component's life. The key consumers should dedupe on. | new |
| `type` | plural group key, one of 8 values. Adding a type is a minor change. | was singular, `sandbo` |
| `name`, `category`, `path` | as today; v1 guarantees `name` = last path segment and `category` = first (true for all rows today) | guarantees are new |
| `description` | string, verbatim from the component; may be empty `""` | unchanged (cleaning it is a later, additive `summary` field) |
| `author`, `repo`, `version`, `license` | string or `null` | `""` → `null` |
| `keywords` | string[] (may be empty) | unchanged |
| `downloads` | integer ≥ 0, total recorded installs, refreshed daily | unchanged |
| `install` | `{command, args}`; `args` is safe to pass as argv | new |
| `urls` | `page`, `source`, `content` | new |
| `files` | string[] for skills and mods, else `null` | was `references`, present only on some types |
| `scan` | latest SkillSpector summary or `null`; display-only, documented as a risk hint, not a verdict | replaces `skillspector` (findings left out of v1.0) |
| — | `security`, `modules`, `userConfig`, `hash` not in v1.0 | dropped (dead, or type-specific internals; `userConfig` can return additively under a `mod` object) |

**Not in v1:** `sandbox` (docs files, not components), `templates`
(retired), `plugins` (empty), `componentsMarketplace` (stale), and any
sponsored or placement data. **Order:** `components` sorted by `id`
ascending, guaranteed. Consumers that want popularity sort by `downloads`
themselves.

### Serving (new `_headers` rules, static files only)

```
/api/v1/*
  Content-Type: application/json; charset=utf-8
  Cache-Control: public, max-age=300, stale-while-revalidate=3600
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Expose-Headers: ETag
  X-Catalog-Schema-Version: 1
```

Conditional requests: rely on Pages' automatic `ETag` + `If-None-Match` →
304 (verify on the preview deploy with `curl -sI` and a second request with
`If-None-Match`). Pages does not set `Last-Modified` on static assets, and a
static `_headers` value cannot track deploys, so `generatedAt` in the body and
`version.json` replace it: a poller fetches `version.json` (< 1 KB) and only
downloads `catalog.json` when `sha256` changes. This also makes polling the
GitHub copy unnecessary.

### Stability policy (goes on the docs page)

- `schemaVersion` is semver. **Within major 1, changes are additive only**:
  new optional fields, new `type` values, new enum values in `scan.severity`,
  new files. Consumers must ignore unknown fields and unknown types.
- **Breaking changes** (remove or rename a field, change a type, change `id`
  format, remove a URL) only in a new major at a new path (`/api/v1/` →
  `/api/v2/`). The old major keeps being generated for at least **6 months**
  after the new one ships, with a `Deprecation` header and a
  `Link: </api/v2/...>; rel="successor-version"` header, and a CHANGELOG
  entry on day one.
- `id` is permanent for a component. If a component is renamed or moved, the
  old `id` disappears and a new one appears; v1 does not track moves (could be
  added later as an optional `aliases` field).
- `downloads` and `scan` values change daily; their meaning does not.
- Removal of a component is not a breaking change.

### CHANGELOG for the data format

`docs/catalog-api/CHANGELOG.md` (repo), rendered on the docs page and linked
from `schema.json` (`$comment`) and `/llms.txt`. Keep-a-Changelog style keyed
by `schemaVersion`, separate from the product `CHANGELOG.md`. Seed entry:
`1.0.0`, plus a short "pre-v1 history" section recording the changes consumers
may have hit: `function-hooks` → `mods` (#910, 2026-09-16), full-table
`downloads` (#1005, 2026-09-26), YAML frontmatter parsing (#1070,
2026-10-04), `skillspector` added (#1204, 2026-10-18).

### Legacy URLs

Not frozen and not redirected. A redirect would change their shape and break
the site; freezing would stop the site from evolving. Instead:

- They keep working with the shape they have today.
- `/openapi.json` marks them `deprecated: true` with "internal to the site, no
  stability guarantee, use /api/v1/", and fixes the stale "24 hours" text.
- Later (L1), `_headers` adds `Link: </api/v1/catalog.json>; rel="successor-version"`
  to them. That is a header only; bodies stay the same.
- `docs/components.json` on GitHub: keep generating it for at least the same
  6 months, and add a line to the top of `docs/README.md` and CLAUDE.md saying
  external code reads it, so a legacy-site cleanup does not delete it by
  accident.

## 7. Migration notes for known consumers

**niche-db.** Point `INDEX` at `https://www.aitmpl.com/api/v1/catalog.json`
(one fetch for all six adapters, or `/api/v1/catalog/{type}.json` per
adapter; poll `version.json` first to skip unchanged pulls). Map
`index[group]` to `components.filter(c => c.type === group)`; use `c.id` as
`externalId` (note: changing `externalId` re-ingests every row once, so they
may prefer to keep `aitmpl:{group}:{path}`, which is still derivable); use
`c.install.command` and `c.urls.source` instead of building them; drop
`security.*` (dead) and optionally read `c.scan`. `sandbox` and `templates`
are already absent, so their skip logic can go. Guarantee they get:
additive-only changes for major 1, at least 6 months' notice before v1 goes
away, a changelog to watch. Reaching them (issue or PR on their repo) is an
outbound message and needs your go-ahead.

**`/aitmpl` mod.** Ship a new mod version that reads
`{siteUrl}/api/v1/catalog/{type}.json` and `version.json`, uses `id`,
`install.args` (still validated) and `urls.page`. Copies already installed
keep reading the legacy files, so those files' current shape (bare array,
`name`/`path`/`category`/`description`/`downloads`, trending `id` format,
`counts.json` keys) should be treated as frozen-in-practice for the 6 month
window even though they are not part of the contract. The fork picks up the
change whenever its owner syncs with upstream.

**First-party.** Dashboard and WebMCP keep the legacy files (they deploy
together with the data, so they cannot drift). The CLI's dead
`aitmpl.com/api/agents.json` fallback can move to `/api/v1/catalog/agents.json`.

## 8. Plan

Estimates are agent working time including tests and a preview deploy, not
counting your review. Paths are relative to the repo root.

### MVP (one PR, ~2 to 2.5 days)

| # | Step | Touches | Effort |
|---|---|---|---|
| M1 | JSON Schema for v1 (envelope, component, `version.json`) | new `scripts/catalog_api/schema.v1.json` | 2–3 h |
| M2 | v1 writer: `write_catalog_api_v1(components_data)` called at the end of `generate_components_json()`, after every legacy file is written; builds `catalog.json`, `catalog/{type}.json`, `version.json`, copies `schema.json`. Legacy outputs must stay byte-identical (test asserts it). | `scripts/generate_components_json.py`, new `scripts/catalog_api/v1.py`, `scripts/test_generate_components_json.py` (or a new test file); outputs under `dashboard/public/api/v1/` | 4–6 h |
| M3 | CI validation: generator validates v1 output with `jsonschema` and exits non-zero on failure; add `jsonschema` to the pip install step of both workflows; add `dashboard/public/api/v1` to `DATA_PATHS` | `.github/workflows/update-component-content.yml`, `.github/workflows/update-json-data.yml`, `.github/workflows/generated-files-guard.yml` (new path in the guarded list), `.github/workflows/component-pr-welcome.yml` text | 2–3 h |
| M4 | Serving: `_headers` block for `/api/v1/*`; preview deploy to confirm the `[...path].ts` catch-all does not shadow the static files, `Content-Type`, CORS, `ETag`/304 | `dashboard/public/_headers` (fallback: path change in M2 if shadowed) | 1–2 h |
| M5 | Docs page: fields reference (generated from the schema at build time so the two cannot drift), minimal example, cadence, stability policy, migration note, changelog | new `dashboard/src/pages/developers/catalog-api.astro`, link from `about.astro`/footer | 3–4 h |
| M6 | CHANGELOG seed | new `docs/catalog-api/CHANGELOG.md` | 1 h |
| M7 | Machine-readable pointers: add v1 paths to `/openapi.json`, mark legacy paths `deprecated`, fix the "24 hours" text; add v1 to `/llms.txt`; CLAUDE.md section "Catalog API v1" with the rule that a v1-breaking change needs a v2 | `dashboard/public/openapi.json`, `dashboard/src/pages/llms.txt.ts` (or `lib/agent-readiness.ts`), `CLAUDE.md` | 1–2 h |

### Later steps

| # | Step | Touches | Effort |
|---|---|---|---|
| L1 | `Link: rel="successor-version"` on legacy catalog paths | `dashboard/public/_headers` | 30 min |
| L2 | Breaking-change guard: CI compares `schema.v1.json` with `main`'s and fails if a required field, type or enum value is removed while the major stays 1 | new `.github/workflows/catalog-api-compat.yml` + small script | 3–4 h |
| L3 | Migrate the `/aitmpl` mod to v1 (new version, tests) | `cli-tool/components/mods/productivity/aitmpl/**` | 3–4 h |
| L4 | Find unknown consumers: Cloudflare Web Analytics / Logpush on `/api/v1/*`, legacy catalog paths, grouped by User-Agent and Referer; ask consumers to send a `User-Agent` with a contact URL (docs page) | Cloudflare dashboard, docs page | 1–2 h setup |
| L5 | Outreach to niche-db with the migration note (needs your go-ahead) | external | 30 min |
| L6 | Additive fields: `summary` (cleaned one-line description), `scan.findings`, `mod.userConfig`, `addedAt`/`updatedAt` from git | v1 writer, schema, changelog | 2–4 h each |
| L7 | `/api/v1/content/{id}.json` as the contract for component bodies (today `component-content/**` is undocumented in v1) | v1 writer, schema | 3–4 h |
| L8 | Fix the CLI's dead `aitmpl.com/api/agents.json` fallback (independent bug; also `sandbox-server.js` reading an unshipped `docs/components.json`) | `cli-tool/src/index.js`, `cli-tool/src/sandbox-server.js` | 1–2 h, separate thread |
| L9 | Retire `docs/components.json` on GitHub after the 6 month window, only after L4 shows no traffic and niche-db has moved | generator, workflows | 1 h |

## 9. Open questions for your review

1. Path: `/api/v1/` (your suggestion, needs the catch-all check) or `/v1/`?
2. Include `scan` (SkillSpector summary) in v1.0, or keep it out until the
   scanner output settles? Proposal: include the summary, not the findings.
3. Deprecation window: 6 months proposed.
4. `id` format: `{type}/{category}/{name}` proposed (readable, matches page
   URLs). Alternative is an opaque hash, which survives nothing better and is
   harder to debug.

## 10. Recommendation

**Formalize as proposed, MVP first.**

Reasoning:

- The cost of staying informal is already being paid, just not by us: both
  known consumers carry workarounds for our data (`sandbo`, empty strings,
  quoted descriptions, rebuilding install commands and URLs), and the
  rename from `function-hooks` to `mods` one month ago was exactly the kind
  of change that breaks them silently. More renames are likely (CLAUDE.md
  already lists legacy-site cleanup and new component types).
- One of the two "external" consumers is our own mod, installed on users'
  machines where we cannot fix it. That alone justifies a stable surface:
  without one, every change to the site's internal JSON is a potential
  silent break for our own users.
- The MVP is small (about 2 to 2.5 days), additive, and leaves every
  existing URL and byte untouched. The serving side (CORS, cache, ETag) is
  already mostly in place; what is added is a version, an enforced schema,
  a policy and a changelog.
- The ongoing cost is one rule: a v1-breaking change needs a v2. CI (M3,
  later L2) enforces it, so it does not depend on remembering.
- It also gives the project's neutrality invariant a technical anchor: the
  public contract documents that the catalog contains no placement data and
  has a fixed, non-commercial order.

Keeping it informal knowingly would be reasonable only if we were willing to
treat today's legacy shapes as frozen forever, which constrains the site more
than a separate v1 does.
