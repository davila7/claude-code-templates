---
title: "GitHub as Runtime Source"
summary: "The CLI installs components and templates from GitHub at runtime instead of relying only on the files bundled in the npm package."
topics: [decisions, cli, components, catalog]
sources:
  - id: node-install
    type: file
    path: cli-tool/src/index.js
  - id: template-files
    type: file
    path: cli-tool/src/file-operations.js
  - id: rust-constants
    type: file
    path: cli-rust/src/constants.rs
  - id: root-package
    type: file
    path: package.json
  - id: cli-package
    type: file
    path: cli-tool/package.json
---

# GitHub as Runtime Source

The CLI treats the GitHub repository as a live runtime source for installable components and templates. Direct component installers build raw GitHub URLs against the `main` branch, template setup downloads files and directories from GitHub, and the Rust port centralizes the same repository coordinates, so publishing the npm package is not the only way component content reaches users [@node-install] [@template-files] [@rust-constants].

## Status

Accepted. Component and template installation fetch from `davila7/claude-code-templates` on the `main` branch at runtime, while the npm packages still expose the CLI entrypoints and include selected local assets [@node-install] [@template-files] [@root-package] [@cli-package].

## Context

The Node direct-install path supports agents, commands, MCPs, settings, hooks, skills, and loops. For those types, `cli-tool/src/index.js` constructs URLs under `https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/...`, and skills use the GitHub contents API to recursively download a skill tree [@node-install].

Template setup uses a parallel GitHub source. `file-operations.js` defines owner, repo, branch, and `cli-tool/templates`, then downloads individual files from raw GitHub and directories from the GitHub contents API with retry handling for rate limits and transient errors [@template-files].

The package metadata still matters. The root package and the `cli-tool` package both expose CLI bin names, and the CLI package includes component and template paths in its published file list [@root-package] [@cli-package].

## Decision

Runtime installation should use GitHub as the source of current component and template content. The Node installer records installed component outcomes with `source: 'github_main'`, and the user-facing output names GitHub main branch as the download source for direct installs [@node-install].

The Rust port follows the same source boundary. Its constants define `REPO` as `davila7/claude-code-templates`, `BRANCH` as `main`, a raw components base under `raw.githubusercontent.com`, and a GitHub contents API base under `api.github.com/repos/.../contents/cli-tool/components` [@rust-constants].

Local package files remain useful for bootstrapping, sandbox assets, and package metadata, but they are not the only content authority for normal component and template installs [@node-install] [@template-files] [@cli-package].

## Consequences

Component fixes can reach runtime installers when they land on `main`, even before every user refreshes an installed package, because the installer fetches the requested file path from GitHub during the command [@node-install].

The design makes network and GitHub availability part of the install path. The template downloader has retry and rate-limit handling, and the component installer reports missing or failed downloads as install failures rather than silently falling back to stale local content [@template-files] [@node-install].

The repository structure is part of the public install contract. Moving `cli-tool/components` or `cli-tool/templates`, renaming category paths, or changing branch assumptions would break runtime URLs in both Node and Rust unless the installers change at the same time [@node-install] [@template-files] [@rust-constants].
