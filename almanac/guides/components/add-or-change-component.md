---
title: "Add or Change Component"
summary: "Add or edit a component by changing the right file under `cli-tool/components`, reviewing it with the component reviewer, and regenerating the catalog artifacts."
topics: [guides, components, catalog]
sources:
  - id: contributing
    type: file
    path: CONTRIBUTING.md
  - id: claude-components
    type: file
    path: CLAUDE.md
  - id: component-reviewer
    type: file
    path: .claude/agents/component-reviewer.md
  - id: components-dir
    type: file
    path: cli-tool/components/
  - id: catalog-generator
    type: file
    path: scripts/generate_components_json.py
---

# Add or Change Component

Adding or changing a component is a three-part workflow: place the component in the correct `cli-tool/components/{type}/{category}` location, run the component reviewer against the changed component, and regenerate the catalog so the docs and dashboard see the new state [@claude-components] [@component-reviewer] [@catalog-generator]. The expected outcome is a valid component file plus updated generated artifacts, not just a local file that happens to exist [@claude-components].

## Preconditions

Know which component type you are changing. The repository has agents, commands, MCPs, settings, hooks, loops, skills, templates, sandbox items, and plugins in or near the component catalog, and the `cli-tool/components/` tree is organized by type and category [@claude-components] [@components-dir].

Use kebab-case names and keep paths relative. Repository guidance requires hyphenated names for component files, rejects absolute paths such as user home directories, and forbids hardcoded secrets or infrastructure identifiers in components [@claude-components] [@component-reviewer].

## Steps

1. Put the file in the right type directory. Agents and commands are Markdown files under their type and category folders, MCPs, settings, and hooks are JSON files, loops are Markdown files, and skills are directories with a `SKILL.md` file plus optional supporting folders [@contributing] [@component-reviewer].

2. Follow the type contract. Agents need frontmatter such as `name`, `description`, `tools`, and `model`; commands need `allowed-tools`, `argument-hint`, and `description`; hooks need a description plus hook event configuration; MCPs need `mcpServers`; settings need a description plus a supported configuration field; loops need a goal-oriented frontmatter contract and resolvable referenced components [@component-reviewer].

3. Keep supporting files beside the component when the type requires them. The reviewer checks that hook scripts exist when referenced and that skill supporting files are organized under the skill directory [@component-reviewer].

4. Run the component reviewer on the changed file or component directory. `CLAUDE.md` says component changes must be reviewed with the `component-reviewer` agent before committing, and the reviewer is expected to validate format, required fields, naming, supporting files, security, category placement, and path rules [@claude-components] [@component-reviewer].

5. Fix critical issues before regenerating. The reviewer treats hardcoded secrets, missing required fields, absolute paths, invalid JSON or YAML, and broken referenced files as blocking issues [@component-reviewer].

6. Regenerate the catalog. `CLAUDE.md` and the generator agent both point to `python scripts/generate_components_json.py`; the script scans component directories, reads metadata and content, fetches download stats when credentials exist, and writes docs and dashboard catalog artifacts [@claude-components] [@catalog-generator]. The safer regeneration process is covered in [Regenerate Catalog Safely](../catalog/regenerate-catalog-safely).

## Verification

Check that the changed component is present in the generated catalog. The generator writes `docs/components.json`, `dashboard/public/components.json`, `dashboard/public/counts.json`, per-type files under `dashboard/public/components/`, `dashboard/public/search-index.json`, and content files under `dashboard/public/component-content/` for content-bearing component types [@catalog-generator].

For component detail pages, verify the install command uses the expected type flag and path. The dashboard install helper maps singular component types to flags such as `--agent`, `--command`, `--mcp`, `--setting`, `--hook`, `--skill`, `--loop`, and `--template`, then strips `.md` or `.json` from the component path [@catalog-generator].

## Recovery

If the reviewer fails the component, fix the component file first rather than editing generated JSON by hand. The reviewer is the source for component quality gates, and the generator is meant to derive catalog output from source files [@component-reviewer] [@catalog-generator].

If the catalog misses the component after regeneration, check type and category placement, file extension, and skill structure. The generator scans normal component types by one directory of categories and file names, but skills are scanned as `category/skill-name/SKILL.md` directories [@catalog-generator]. If the dashboard detail page is the failure, use [Debug Missing Component Detail Page](../catalog/debug-missing-component-detail-page).
