---
title: "Split Heavy Content From Index"
summary: "Catalog generation keeps heavy component content out of dashboard indexes and writes it as per-component files loaded on demand."
topics: [decisions, catalog, dashboard]
sources:
  - id: catalog-generator
    type: file
    path: scripts/generate_components_json.py
  - id: dashboard-data
    type: file
    path: dashboard/src/lib/data.ts
---

# Split Heavy Content From Index

The catalog is split so list and search views load lightweight indexes, while full component bodies live in separate `component-content` files. The generator writes docs and dashboard artifacts differently: docs keep security metadata while dropping raw content, and the dashboard drops both raw content and security from indexes, then fetches content only for detail or PR flows [@catalog-generator] [@dashboard-data].

## Status

Accepted. `scripts/generate_components_json.py` writes per-component content files, a docs index without `content`, and dashboard indexes without `content` or `security` [@catalog-generator].

## Context

The generator first builds rich component records that include raw content, metadata, download counts, and security metadata for content-bearing component types [@catalog-generator]. Without splitting, those records would make every dashboard list, sidebar, and search request carry full Markdown or JSON bodies that most views do not need.

The dashboard data layer is already built around the split. It defines `/component-content` as the content base, loads `/components.json` as the main catalog, loads per-type slices and `/search-index.json` for lighter browsing, and has a separate `getComponentContent()` path for raw component text [@dashboard-data].

## Decision

The generator writes raw component content to `dashboard/public/component-content/{type}/{slug}.json`, where the slug is the component path with its extension stripped [@catalog-generator]. This is the only dashboard artifact intended to carry the full raw component body [@catalog-generator].

The docs artifact keeps security metadata but removes `content`. The generator comments say the legacy docs index needs `security` because old static docs render security badges, so `docs/components.json` strips only the raw content field [@catalog-generator].

The dashboard artifacts are leaner. `dashboard/public/components.json` and `dashboard/public/components/{type}.json` strip both `content` and `security`, `counts.json` stores counts, and `search-index.json` contains only type, name, path, description, and category [@catalog-generator].

## Consequences

Dashboard browsing stays cheaper because tabs, sidebars, and search can load indexes instead of full component bodies [@dashboard-data]. Detail pages and flows that actually need raw content pay the cost later through the per-component content fetch [@dashboard-data].

Catalog regeneration must keep index files and content files in sync. A missing `component-content` file can make a component appear in the index while its detail view has no body, so debugging should start with the generated content artifact before changing dashboard routing [@catalog-generator] [@dashboard-data].

Security display requirements differ by consumer. Legacy docs can still read security metadata from `docs/components.json`, while the Cloudflare dashboard intentionally avoids carrying that field in its public indexes [@catalog-generator].
