---
title: "Generated Artifact Inventory"
summary: "Lookup table for generated catalog, search, API, component-content, trending, jobs, and plugin artifacts."
topics: [reference, catalog]
sources:
  - id: component-generator
    type: file
    path: scripts/generate_components_json.py
  - id: trending-generator
    type: file
    path: scripts/generate_trending_data.py
  - id: agents-api-generator
    type: file
    path: scripts/generate_agents_api.py
  - id: jobs-generator
    type: file
    path: scripts/generate_claude_jobs.py
  - id: plugins-generator
    type: file
    path: scripts/generate_plugins_json.py
  - id: docs-dir
    type: file
    path: docs/
  - id: dashboard-public-dir
    type: file
    path: dashboard/public/
---

# Generated Artifact Inventory

The generated artifact inventory is the set of JSON files and static assets produced from component sources, download data, job sources, and plugin marketplace sources. The central catalog generator scans components and templates, then writes a docs index, dashboard index, counts, per-type slices, search data, and per-component content files [@component-generator]. Other generators produce trending data, a lightweight agents API, Claude jobs data, and plugin marketplace data [@trending-generator] [@agents-api-generator] [@jobs-generator] [@plugins-generator]. Use this page with [Catalog Generation Pipeline](../../architecture/catalog/catalog-generation-pipeline), [Astro Dashboard Data Loading](../../architecture/dashboard/astro-dashboard-data-loading), and [Regenerate Catalog Safely](../../guides/catalog/regenerate-catalog-safely).

## Catalog Artifacts

| Artifact | Producer | Consumer and purpose |
| --- | --- | --- |
| `docs/components.json` | `scripts/generate_components_json.py` | Legacy/docs catalog index; strips raw `content` but keeps security metadata for docs badges [@component-generator] [@docs-dir] |
| `dashboard/public/components.json` | `scripts/generate_components_json.py` | Cloudflare Pages dashboard index; strips both `content` and `security` to reduce browser payload [@component-generator] [@dashboard-public-dir] |
| `dashboard/public/counts.json` | `scripts/generate_components_json.py` | Tiny per-type counts for sidebars and plugin pages [@component-generator] [@dashboard-public-dir] |
| `dashboard/public/components/{type}.json` | `scripts/generate_components_json.py` | Per-type slices so grids can load only the active component type [@component-generator] [@dashboard-public-dir] |
| `dashboard/public/search-index.json` | `scripts/generate_components_json.py` | Flat search records with `type`, `name`, `path`, `description`, and `category` [@component-generator] [@dashboard-public-dir] |
| `dashboard/public/component-content/{type}/{slug}.json` | `scripts/generate_components_json.py` | Raw component content loaded on demand by detail pages [@component-generator] [@dashboard-public-dir] |

The content slug is the generated component path with `.md` or `.json` removed, so a source path like `database/supabase-migration-assistant.md` maps to a matching dashboard content JSON path below the component type [@component-generator].

## Secondary Data Artifacts

| Artifact | Producer | Notes |
| --- | --- | --- |
| `docs/trending-data.json` | `scripts/generate_trending_data.py` | Builds trend groups from Supabase download records, with fallback data when the fetch path fails [@trending-generator] [@docs-dir] |
| `dashboard/public/trending-data.json` | Repository public artifact | Dashboard-served copy of trending data [@dashboard-public-dir] |
| `docs/api/agents.json` | `scripts/generate_agents_api.py` | Lightweight agents API generated from `docs/components.json` for CLI consumers [@agents-api-generator] [@docs-dir] |
| `docs/claude-jobs.json` | `scripts/generate_claude_jobs.py` | Job feed generated from Hacker News, RemoteOK, WeWorkRemotely, and Anthropic careers sources [@jobs-generator] [@docs-dir] |
| `dashboard/public/claude-jobs.json` | `scripts/generate_claude_jobs.py` | Dashboard copy of the jobs feed when `dashboard/public/` exists [@jobs-generator] [@dashboard-public-dir] |
| `dashboard/public/plugins.json` | `scripts/generate_plugins_json.py` | Plugin and marketplace records aggregated from configured GitHub `.claude-plugin/` sources [@plugins-generator] [@dashboard-public-dir] |

## Source Boundaries

Component artifacts come from local component and template files, plus optional download statistics and marketplace metadata [@component-generator]. Trending artifacts come from Supabase download data and normalize component types such as `agent`, `command`, `mcp`, `skill`, `template`, and `plugin` into plural catalog buckets [@trending-generator]. Plugin artifacts are different again: the plugin generator fetches `.claude-plugin/` data from configured GitHub repositories and writes the aggregate to `dashboard/public/plugins.json` [@plugins-generator].

The safe regeneration rule is to check both `docs/` and `dashboard/public/` after running generators. The docs side serves legacy static pages and API files, while the dashboard side serves Cloudflare Pages runtime payloads [@docs-dir] [@dashboard-public-dir].
