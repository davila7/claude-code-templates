---
title: "Catalog Generation Pipeline"
summary: "How local component, template, plugin, security, and download data become the JSON artifacts consumed by docs, CLI fallback APIs, and the Astro dashboard."
topics: [architecture, catalog]
sources:
  - id: catalog-generator
    type: file
    path: scripts/generate_components_json.py
  - id: trending-generator
    type: file
    path: scripts/generate_trending_data.py
  - id: agents-api-generator
    type: file
    path: scripts/generate_agents_api.py
  - id: catalog-agent
    type: file
    path: .claude/agents/catalog-generator.md
  - id: docs-components
    type: file
    path: docs/components.json
  - id: dashboard-components
    type: file
    path: dashboard/public/components.json
  - id: dashboard-slices
    type: file
    path: dashboard/public/components/
  - id: dashboard-content
    type: file
    path: dashboard/public/component-content/
  - id: search-index
    type: file
    path: dashboard/public/search-index.json
---

The catalog generation pipeline turns repository-local components, templates, marketplace metadata, security validation, and download telemetry into the JSON files used by the static docs, the CLI's lightweight agent lookup, and the Astro dashboard. The main script is `scripts/generate_components_json.py`: it scans `cli-tool/components` and `cli-tool/templates`, enriches entries with metadata and download counts, strips heavy content from indexes, and emits separate dashboard artifacts for index, per-type slices, search, counts, and per-component content [@catalog-generator]. The dashboard loading side is covered in [Astro Dashboard Data Loading](../dashboard/astro-dashboard-data-loading).

## Inputs

The pipeline starts from two local source trees: `cli-tool/components` for agents, commands, MCPs, settings, hooks, sandbox assets, skills, and loops, and `cli-tool/templates` for language and framework templates [@catalog-generator]. It also reads plugin marketplace data from `.claude-plugin/marketplace.json` and component marketplace metadata from `cli-tool/components/.claude-plugin/marketplace.json` when those files exist [@catalog-generator].

Before scanning entries, the script tries to run `npm run security-audit:json` in the CLI tool and then reads `security-report.json` to build per-component security metadata [@catalog-generator]. It also tries to fetch Supabase download records, paginates through `component_downloads`, maps singular event types to plural catalog groups, and falls back to a `download_stats` table if the raw download table has no data [@catalog-generator].

## Component Records

For ordinary Markdown and JSON components, the generator records name, category, singular type, path, raw content, description, author, repo, version, license, keywords, downloads, and security metadata [@catalog-generator]. Markdown components get metadata from frontmatter, MCP JSON gets description from the first `mcpServers` entry, and settings or hooks read description and package metadata from top-level JSON fields [@catalog-generator].

Skills are handled differently because each skill is a directory with a required `SKILL.md`. The generator walks category directories, reads each skill's `SKILL.md`, extracts frontmatter metadata, records reference files beside `SKILL.md`, and stores the skill path as `category/skill-name` [@catalog-generator].

Templates are cataloged from `cli-tool/templates` rather than component files. Language templates become entries with subtype `language`, while framework examples under `examples/` become subtype `framework`; both include file lists, generated install commands, and download counts [@catalog-generator].

## Artifact Split

The generator keeps content-bearing component types separate from lightweight indexes. It writes raw content into `dashboard/public/component-content/{type}/{slug}.json`, where the slug is the component path without `.md` or `.json` [@catalog-generator]. It then writes `docs/components.json` as an index without `content` but with `security`, because the legacy docs site still renders security badges [@catalog-generator] [@docs-components].

The dashboard gets a smaller copy. `dashboard/public/components.json` strips both `content` and `security`, `dashboard/public/counts.json` stores per-type counts, `dashboard/public/components/{type}.json` stores per-type slices, and `dashboard/public/search-index.json` stores only type, name, path, description, and category for global search [@catalog-generator] [@dashboard-components] [@dashboard-slices] [@search-index]. The per-component content directory is the only dashboard artifact that keeps full raw component text [@dashboard-content].

## Related Generators

`scripts/generate_trending_data.py` is the separate trending pipeline. It fetches Supabase `component_downloads` with cursor-based pagination, computes total, today, week, month, chart, and country statistics, and writes `docs/trending-data.json`, using fallback data when Supabase fetches fail [@trending-generator].

`scripts/generate_agents_api.py` derives `docs/api/agents.json` from `docs/components.json`, keeping only agent name, extensionless path, category, and a truncated description [@agents-api-generator]. The Node CLI can use that lightweight agent API as a fallback when local catalog data is missing during available-agent lookup [@agents-api-generator].

## Operational Contract

The repository includes a catalog-generator agent whose sole job is to run `python3 scripts/generate_components_json.py`, report counts and errors, and make no other changes [@catalog-agent]. That instruction matters because the main generator is the authoritative sync point after component additions, edits, or deletions [@catalog-agent].

The main failure modes are deliberately soft for optional enrichment. Missing Supabase credentials skip download stats, missing security reports skip security metadata, missing component directories print warnings, and individual content-file write failures do not stop the entire generation run [@catalog-generator]. The invariant is that local component and template files remain the structural source of truth, while telemetry, security, and marketplace data enrich the catalog when available [@catalog-generator].
