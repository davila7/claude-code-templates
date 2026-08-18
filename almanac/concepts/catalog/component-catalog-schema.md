---
title: "Component Catalog Schema"
summary: "The component catalog schema is the generated JSON shape shared by the CLI, documentation, and dashboard."
topics: [concepts, catalog]
sources:
  - id: catalog-generator
    type: file
    path: scripts/generate_components_json.py
  - id: dashboard-types
    type: file
    path: dashboard/src/lib/types.ts
  - id: dashboard-data
    type: file
    path: dashboard/src/lib/data.ts
  - id: generated-components
    type: file
    path: docs/components.json
---

# Component Catalog Schema

The component catalog schema is the generated JSON contract that turns files under `cli-tool/components` and `cli-tool/templates` into browsable and installable records. The generator emits plural arrays such as `agents`, `commands`, `mcps`, `settings`, `hooks`, `skills`, `loops`, and `templates`, while each component record carries a singular `type` such as `agent`, `skill`, or `template` [@catalog-generator] [@generated-components]. This schema matters because the CLI, docs, dashboard grids, search, detail pages, and install command builders all rely on consistent names, paths, categories, and type singularization.

## Core Record Shape

The dashboard TypeScript type defines a component record with `name`, `path`, `category`, `type`, `content`, optional `description`, optional `url`, optional `downloads`, and optional `references` [@dashboard-types]. The generated `docs/components.json` artifact follows that idea but also includes fields created by the generator, such as author, repo, version, license, keywords, and security metadata for many component types [@catalog-generator] [@generated-components].

Normal file-based components get records with `name`, `path`, `category`, singular `type`, `content`, `description`, author metadata, keywords, downloads, and security metadata [@catalog-generator]. The `type` value comes from the plural array name by removing the trailing `s`, so entries in the `agents` array have `type: "agent"` and entries in the `loops` array have `type: "loop"` [@catalog-generator] [@generated-components].

Skills are special. The generator looks for `SKILL.md` inside `cli-tool/components/skills/{category}/{skill-name}/`, uses the directory name as `name`, sets `path` to `category/name` without a file extension, sets `type` to `skill`, extracts frontmatter metadata, and adds a sorted `references` list of files other than `SKILL.md` [@catalog-generator] [@generated-components].

Templates are also special. Language and framework templates are generated from `cli-tool/templates`, use `type: "template"`, include `subtype` values such as `language` or `framework`, use categories such as `languages` or `frameworks`, include discovered template files, and carry an `installCommand` string [@catalog-generator] [@generated-components].

## Singular And Plural Type Rules

The schema uses plural type names for top-level collections and artifact file names, but singular type names inside component records and route parameters. The dashboard data loader exposes `ComponentsData` with plural arrays for agents, commands, MCPs, settings, hooks, skills, loops, and templates [@dashboard-types]. Detail content lookup receives a singular type, converts it to plural by appending `s` when needed, and fetches `/component-content/{type-plural}/{slug}.json` [@dashboard-data].

Install command generation goes the other direction. The dashboard maps singular record types to CLI flags: `agent` to `--agent`, `command` to `--command`, `mcp` to `--mcp`, `setting` to `--setting`, `hook` to `--hook`, `skill` to `--skill`, `loop` to `--loop`, and `template` to `--template` [@dashboard-data]. It strips `.md` or `.json` from the component path before building the command [@dashboard-data].

This singular/plural boundary is easy to break. A catalog record with the wrong singular `type` can generate the wrong CLI flag, while a dashboard lookup with the wrong plural type will miss the per-component content artifact [@dashboard-data].

## Generated Artifacts

The generator writes several related artifacts. `docs/components.json` is an index without raw `content` but with security metadata retained for the legacy docs site [@catalog-generator]. `dashboard/public/components.json` strips both content and security for the dashboard payload [@catalog-generator]. The generator also writes `dashboard/public/component-content/{type}/{slug}.json` files containing raw content for detail pages, `dashboard/public/counts.json` for counts, `dashboard/public/components/{type}.json` for per-type slices, and `dashboard/public/search-index.json` for global search fields [@catalog-generator].

The dashboard data layer mirrors those artifacts. It can fetch the full components index, fetch one plural type slice from `/components/{type}.json`, fetch the flat search index, and fetch raw content on demand for a single component detail page [@dashboard-data].

## Relation To Components

The catalog schema is the index form of the [Component System](../components/component-system). Component files define behavior and install content. Catalog records define how those files are named, searched, sorted, routed, counted, and converted into install commands [@catalog-generator] [@dashboard-data].
