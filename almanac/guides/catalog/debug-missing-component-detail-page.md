---
title: "Debug Missing Component Detail Page"
summary: "A missing component detail page is usually a mismatch between the URL type, catalog path, generated content file, and dashboard type configuration."
topics: [guides, catalog, dashboard]
sources:
  - id: detail-route
    type: file
    path: dashboard/src/pages/component/[type]/[...slug].astro
  - id: data-loader
    type: file
    path: dashboard/src/lib/data.ts
  - id: generator
    type: file
    path: scripts/generate_components_json.py
  - id: icons
    type: file
    path: dashboard/src/lib/icons.ts
  - id: dashboard-public
    type: file
    path: dashboard/public/
---

# Debug Missing Component Detail Page

A component detail page depends on four things lining up: the URL type, the catalog record path, the generated split content file, and the dashboard's known type configuration. Debug the data path first, because the route renders "Component not found" when it cannot match a catalog record and renders an empty body when the record exists but its split content file cannot be loaded [@detail-route] [@data-loader] [@generator].

## Preconditions

Know the intended URL. The detail route is `/component/[type]/[...slug]`, and it converts the URL type to a plural key by appending `s` unless the type already ends with `s` [@detail-route].

Know the source component path. The generator records normal component paths as `category/file.md` or `category/file.json`, while skills use `category/skill-name` with content read from `SKILL.md` [@generator].

## Steps

1. Check whether the URL type is a dashboard-known plural type. `TYPE_CONFIG` defines `skills`, `agents`, `commands`, `settings`, `hooks`, `mcps`, and `loops`, and the route uses that config for labels, icons, colors, and navigation [@icons] [@detail-route].

2. Check whether the catalog has the component under the matching plural array. The route calls `fetchComponents()`, resolves `typeKey`, and searches `data[typeKey]` for an item whose path without `.md` or `.json` equals the slug, or whose name equals the slug [@detail-route] [@data-loader].

3. Check the generated component path. If the URL slug is `security/audit-helper`, the catalog path must cleanly become `security/audit-helper` after extension removal; a path such as `audit-helper.md` in the wrong category will not match that slug [@detail-route] [@generator].

4. Check split content. After finding the catalog record, the route calls `fetchComponentContent(component.type, cleanSlug)`, and the loader fetches `/component-content/{typePlural}/{slug}.json` [@detail-route] [@data-loader]. The generator creates those files for content-bearing types by stripping `.md` or `.json` from the recorded component path [@generator].

5. Check local development fallback paths. In dev server-side mode, `fetchComponents()` reads `public/components.json`, per-type loading reads `public/components/{type}.json`, and content loading reads `public/component-content/{typePlural}/{slug}.json` relative to the dashboard app [@data-loader]. If you run Astro from an unexpected directory, those disk fallbacks can miss the generated files [@data-loader].

6. Regenerate if any artifact is missing or stale. The generator owns `dashboard/public/components.json`, per-type slices, `search-index.json`, and `component-content`, so hand-editing only one generated file can leave the route and search surfaces inconsistent [@generator] [@dashboard-public]. Use [Regenerate Catalog Safely](regenerate-catalog-safely) for the full artifact check.

## Verification

A healthy detail page has a matching component record, a non-empty `component.content` value after the split content fetch, and a canonical path built as `/component/{typePlural}/{component.path without extension}` [@detail-route].

For JSON-backed types, a blank Markdown body may be normal only after confirming the JSON content was loaded. The route sends settings, hooks, and MCPs to `JsonViewer`, while Markdown-backed types use `MarkdownViewer` and skills can also show reference-file UI [@detail-route].

For loops, verify referenced component links separately. The route parses the loop frontmatter `components` list into links shaped as `/component/{typePlural}/{path}`, so a loop can load correctly while one referenced component link is broken by its own type or path mismatch [@detail-route].

## Recovery

If the page says "Component not found", fix the catalog record or URL. The route has not found any item whose cleaned path or name matches the slug under the requested type key [@detail-route].

If the page header appears but content is empty, fix the generated content artifact. The route found the component but `fetchComponentContent()` returned an empty string after failing to fetch or parse the split content file [@detail-route] [@data-loader].

If the page has the wrong icon, label, or back link, check the plural type against `TYPE_CONFIG`. Unknown types fall back poorly because the dashboard's icons and valid type list are centralized in `dashboard/src/lib/icons.ts` [@icons] [@detail-route].
