---
title: "Security Audit CLI Contract"
summary: "Exact commands, flags, output modes, scan scope, and exit behavior for the component security audit."
topics: [reference, validation, security, cli]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: audit-cli
    type: file
    path: cli-tool/src/security-audit.js
  - id: validation-readme
    type: file
    path: cli-tool/src/validation/README.md
  - id: cli-package
    type: file
    path: cli-tool/package.json
---

# Security Audit CLI Contract

The security audit CLI is the executable validation gate for repository components. The coverage map assigns this page to the exact command, mode, JSON-output, and CI-failure behavior of `cli-tool/src/security-audit.js`; the script itself scans component files, runs `ValidationOrchestrator`, prints a report and summary, and chooses its exit code from CI mode plus failed component count [@coverage-entry] [@audit-cli].

## Entry Points

The package scripts are the supported short commands: `npm run security-audit`, `npm run security-audit:ci`, `npm run security-audit:verbose`, and `npm run security-audit:json` [@cli-package]. They all execute `node src/security-audit.js`, with `:ci` adding `--ci`, `:verbose` adding `--verbose`, and `:json` adding `--json --output=security-report.json` [@cli-package].

Direct execution is also documented from the CLI tool directory as `node src/security-audit.js [options]` [@validation-readme]. The current executable recognizes `--ci`, `--verbose`, `-v`, `--json`, and `--output=FILE`; it does not parse target component flags such as `--agent` or `--file` [@audit-cli].

## Scan Scope

The script first looks for `components/` under the current working directory, then falls back to `cli-tool/components/` [@audit-cli]. If neither directory exists, it prints both attempted paths and exits with status 1 [@audit-cli].

Within the chosen directory, the scanner visits `agents`, `commands`, `mcps`, `settings`, and `hooks`, then recursively collects files ending in `.md` [@audit-cli]. Each collected component carries raw content, a path relative to `process.cwd()`, and a singular type derived by removing the final `s` from the directory name [@audit-cli].

## Validation Mode

The CLI creates `ValidationOrchestrator` and calls `validateComponents()` for every scanned component [@audit-cli]. CI mode is passed as `strict: true`, which makes semantic suspicious-pattern findings become errors inside the semantic validator; non-CI mode passes `strict: false` [@audit-cli] [@validation-readme].

The audit never updates the integrity hash registry during this command path. It always passes `updateRegistry: false`, so the run can detect registry drift but will not rewrite `.claude/security/component-hashes.json` [@audit-cli].

## Output Modes

Without `--json`, the CLI prints the orchestrator's human-readable report. `--verbose` or `-v` includes detailed validation findings in that report, and color output is disabled when `--ci` is present [@audit-cli].

With `--json`, the CLI serializes the full batch result through `generateJsonReport()` [@audit-cli]. If `--output=FILE` is present, the JSON string is written to that file and the CLI prints a saved-file message; otherwise the JSON report is printed to stdout [@audit-cli].

Every mode also prints a validation summary after the report step. The summary includes total component count, passed count, failed count, and warning count from `results.summary` [@audit-cli].

## Exit Codes

CI mode is the failing gate. If `--ci` is present and at least one component fails validation, the script prints a CI failure message and exits with status 1 [@audit-cli].

Non-CI mode is advisory. If components fail validation without `--ci`, the script prints a warning and exits with status 0; if all components pass, it prints a success message and exits with status 0 [@audit-cli].

Runtime failures are hard failures. Missing component directories, unhandled promise rejections, and top-level exceptions all exit with status 1, with `--verbose` adding the full thrown error for top-level failures [@audit-cli].

## Documentation Drift To Watch

`cli-tool/src/validation/README.md` matches the package scripts and direct `node src/security-audit.js` usage, so it is useful for normal audit commands [@validation-readme]. A separate architecture document describes a `create-claude-config --security-audit` style interface, but the current package scripts and executable contract are the direct `security-audit.js` path covered here [@cli-package] [@audit-cli].

For the validator architecture behind this command, read [Five-Tier Validation System](../../architecture/validation/five-tier-validation-system). For adding validators, read [Add New Validator](../../guides/validation/add-new-validator). For component quality review before audit, read [Component Quality Gates](../../concepts/components/component-quality-gates).
