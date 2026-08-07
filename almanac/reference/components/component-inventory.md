---
title: "Component Inventory"
summary: "Current component neighborhoods, generated counts, duplicate names, and dashboard exposure for the component catalog."
topics: [reference, components]
sources:
  - id: component-dir
    type: file
    path: cli-tool/components/
  - id: catalog-generator
    type: file
    path: scripts/generate_components_json.py
  - id: generated-components
    type: file
    path: docs/components.json
---

# Component Inventory

The component inventory is the current generated view of `cli-tool/components/` and related template/plugin inputs. The source tree is organized by component neighborhoods such as agents, commands, MCPs, settings, hooks, skills, loops, and sandbox assets [@component-dir]. The generated `docs/components.json` index currently exposes 421 agents, 281 commands, 91 MCPs, 68 settings, 58 hooks, 11 sandbox entries, 849 skills, 18 loops, 14 templates, and no plugin entries in its `plugins` array [@generated-components]. For schema details, see [Component Schema Reference](component-schema-reference); for generation behavior, see [Catalog Generation Pipeline](../../architecture/catalog/catalog-generation-pipeline).

## Generated Counts

| Collection | Generated count | Source neighborhood |
| --- | ---: | --- |
| `agents` | 421 | `cli-tool/components/agents/` [@generated-components] [@component-dir] |
| `commands` | 281 | `cli-tool/components/commands/` [@generated-components] [@component-dir] |
| `mcps` | 91 | `cli-tool/components/mcps/` [@generated-components] [@component-dir] |
| `settings` | 68 | `cli-tool/components/settings/` [@generated-components] [@component-dir] |
| `hooks` | 58 | `cli-tool/components/hooks/` [@generated-components] [@component-dir] |
| `sandbox` | 11 | `cli-tool/components/sandbox/` [@generated-components] [@component-dir] |
| `skills` | 849 | `cli-tool/components/skills/{category}/{skill}/SKILL.md` [@generated-components] [@catalog-generator] |
| `loops` | 18 | `cli-tool/components/loops/` [@generated-components] [@component-dir] |
| `templates` | 14 | `cli-tool/templates/` rather than `cli-tool/components/` [@catalog-generator] [@generated-components] |
| `plugins` | 0 | Marketplace-derived plugin records when present [@catalog-generator] [@generated-components] |

## Neighborhood Shape

Most file components use a simple `{type}/{category}/{file}` layout. Agents, commands, MCPs, settings, hooks, sandbox entries, and loops are scanned from one category level below their type folder [@catalog-generator]. Skills use a deeper directory layout: the generator finds `SKILL.md` under `skills/{category}/{skill}/`, uses the skill directory as the catalog name, and records sibling files as references [@catalog-generator].

The generated index keeps paths relative to the type folder. For example, a command path is shaped like `database/supabase-migration-assistant.md`, while a skill path is shaped like `category/skill-name` without the `SKILL.md` suffix [@generated-components] [@catalog-generator].

## Duplicate Names

The current catalog has no evidence of identical generated `path` values inside `docs/components.json`; paths are the stable disambiguator for install and detail routing [@generated-components]. It does have duplicate `name` values across categories. Examples include `accessibility-tester` in both `agents/accessibility` and `agents/development-tools`, `prompt-engineer` in both `agents/ai-specialists` and `agents/data-ai`, `commit` in both `commands/git-workflow` and `commands/orchestration`, and `using-superpowers` in both `skills/development` and `skills/utilities` [@generated-components]. Contributors should treat `type + path`, not bare `name`, as the unique lookup key.

## Catalog Exposure

The generator writes catalog exposure in layers. `docs/components.json` is the legacy/docs index without raw `content`, while `dashboard/public/components.json` is the dashboard index without `content` or `security` fields [@catalog-generator]. The dashboard also receives `dashboard/public/counts.json`, per-type slices under `dashboard/public/components/{type}.json`, a flat `dashboard/public/search-index.json`, and per-component raw content files under `dashboard/public/component-content/{type}/{slug}.json` [@catalog-generator].

This split means the inventory count in `docs/components.json` is the source to check when a component is missing from the docs or dashboard catalog, while the split dashboard artifacts are the source to check when a detail page or search result is missing after generation [@catalog-generator] [@generated-components].
