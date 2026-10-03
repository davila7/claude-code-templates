---
title: "Regenerate Catalog Safely"
summary: "Regenerate the component catalog by running the Python generator from the repository root, then verify every docs and dashboard artifact it owns."
topics: [guides, catalog, components]
sources:
  - id: claude-catalog
    type: file
    path: CLAUDE.md
  - id: generator-script
    type: file
    path: scripts/generate_components_json.py
  - id: generator-agent
    type: file
    path: .claude/agents/catalog-generator.md
  - id: docs-catalog
    type: file
    path: docs/components.json
  - id: dashboard-public
    type: file
    path: dashboard/public/
---

# Regenerate Catalog Safely

Regenerating the catalog means running `python scripts/generate_components_json.py` from the repository root and then checking the generated docs and dashboard artifacts together. The script scans component source directories, preserves legacy catalog needs, emits lighter Cloudflare Pages dashboard files, and is expected after component additions, edits, or deletions [@claude-catalog] [@generator-script] [@generator-agent].

## Preconditions

Run component review before regeneration when the change touches `cli-tool/components/`. The repository instructions require the component reviewer for component changes before the catalog update step [@claude-catalog].

Run the generator from the repository root. The script uses relative paths such as `cli-tool/components`, `cli-tool/templates`, `docs/components.json`, and `dashboard/public`, so changing the working directory can make it scan or write the wrong locations [@generator-script].

Expect optional external data to degrade. The generator tries to run the CLI security audit and fetch Supabase download statistics; if npm, reports, credentials, or network access are missing, it prints warnings and continues with empty security or download metadata rather than making those integrations mandatory [@generator-script].

## Steps

1. Run `python scripts/generate_components_json.py`. The catalog-generator agent documents that this is the whole regeneration command and that it may take 30 to 60 seconds because of Supabase calls [@generator-agent].

2. Read the generation summary. The script prints counts for agents, commands, MCPs, settings, hooks, sandbox items, skills, loops, templates, and plugins, and it reports security validation totals for component types that carry security metadata [@generator-script].

3. Check `docs/components.json`. The script writes this file as the legacy/docs index with `security` preserved but `content` removed, because the legacy static site still renders security badges [@generator-script] [@docs-catalog].

4. Check dashboard artifacts under `dashboard/public/`. The generator writes a dashboard index without `content` or `security`, a `counts.json` file, one `components/{type}.json` file per component type, a flat `search-index.json`, and per-component content JSON under `component-content/{type}/{slug}.json` [@generator-script] [@dashboard-public].

5. Build or run the dashboard when the catalog affects visible pages. Dashboard guidance says the Cloudflare Pages dashboard loads `components.json` and per-component content from `dashboard/public/`, so catalog changes are runtime data for the dashboard, not only docs metadata [@claude-catalog] [@dashboard-public].

## Verification

Verify that a changed component appears in the right plural type array and the right per-type slice. The generator stores normal component paths as `category/file.md` or `category/file.json`, stores skills as `category/skill-name`, and sorts non-template components by path [@generator-script].

Verify that content-bearing components have matching content files. For agents, commands, MCPs, settings, hooks, sandbox items, skills, and loops, the generator strips the extension from the path and writes `dashboard/public/component-content/{type}/{slug}.json` with the raw content string [@generator-script].

Verify that `search-index.json` has only lightweight search fields. The generator writes `type`, `name`, `path`, `description`, and `category` into the flat search index, so missing full content there is expected [@generator-script].

## Recovery

If a component is absent from all generated files, check whether the source file is in a scanned location and has a scanned shape. Normal component types are read from `cli-tool/components/{type}/{category}` as `.md` or `.json`, while skills must have `SKILL.md` inside a skill directory [@generator-script].

If the dashboard index exists but a detail page has no body, check the generated `component-content` file before editing dashboard code. The detail route depends on the split content artifact, so a missing or stale content JSON file can look like an application bug [@generator-script]. The focused debug path is [Debug Missing Component Detail Page](debug-missing-component-detail-page).

If the generator reports warnings about security validation or Supabase download stats, decide whether the current change depends on those fields. The script is designed to continue without them, but release-sensitive catalog work should rerun in an environment with the expected npm command, security report, credentials, and network access [@generator-script] [@generator-agent].
