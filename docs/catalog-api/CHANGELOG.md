# Catalog API changelog

Changes to the data format published under `https://www.aitmpl.com/api/v1/`
(`catalog.json`, `catalog/{type}.json`, `version.json`, `schema.json`). This
file is separate from the CLI's release notes in `/CHANGELOG.md`. Docs and
stability policy: https://www.aitmpl.com/developers/catalog-api

Within a major version every change is additive. A breaking change ships as a
new major at a new path, announced here on the day it ships, and the previous
major stays published for at least 6 months.

## [1.0.0] - 2026-10-21

First versioned release.

- `catalog.json` with every component; `catalog/{type}.json` per type
  (`agents`, `commands`, `mcps`, `settings`, `hooks`, `skills`, `loops`, `mods`).
- `version.json` (`schemaVersion`, `generatedAt`, `sha256`, `count`, `counts`) for cheap polling.
- `schema.json`, JSON Schema draft 2020-12.
- Component fields: `id`, `type`, `name`, `category`, `path`, `description`,
  `author`, `repo`, `version`, `license`, `keywords`, `downloads`,
  `install.{command,args}`, `urls.{page,source,content}`, `files`, `scan`.
- Compared with the site's internal `components.json`: `type` is the plural
  group key (the internal file says `agent`, and `sandbo` for sandbox); unknown
  values are `null` instead of `""`; `security` (never populated) is dropped;
  `skillspector` becomes the smaller `scan`; `references` becomes `files` for
  skills and mods only; `sandbox`, `templates`, `plugins` and
  `componentsMarketplace` are not published.

## Before 1.0.0 (unversioned files)

There was no contract before 1.0.0, but these changes to the site's internal
files are listed for anyone who was reading them:

- 2026-10-18: `skillspector` object added to every component (#1204).
- 2026-10-04: frontmatter parsed as YAML, so `author`, `version` and `keywords`
  appear for skills that keep them under `metadata` (#1070).
- 2026-09-26: `downloads` counts every recorded install; before, it was a
  partial count (#1005).
- 2026-09-16: `function-hooks` group renamed to `mods`, CLI flag
  `--function-hook` renamed to `--mod` (#910).
