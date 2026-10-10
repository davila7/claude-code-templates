# Feature: publish the independent local task orchestrator as a template mod

## Objective

Package the standalone Claude Code local classification/extraction mod in the Claude Code templates catalog on a dedicated branch based on the refreshed upstream `main`, then submit a PR to the original repository once delivery and verification gates are resolved, without changing the Pudu telemetry feature.

## Problem and why

The mod currently exists as an independent plugin repository nested beside the template checkout. The user wants it prepared for submission through the same template repository used for `feature/pudu-task-telemetry`, but on its own branch based on current `main` and compliant with that repository's mod and contribution requirements.

## Scope

- Add the complete standalone mod under `cli-tool/components/mods/productivity/local-task-orchestrator/`.
- Preserve explicit classification/extraction behavior, fixed loopback-only Ollama access, user-selected installed model, strict bounds, fail-closed validation, and the approved flow of validated results back into Claude's context.
- Adapt its README to the template mod installation/distribution and validation guidance.
- Add/update only catalog tests or metadata that repository inspection proves are required.
- Verify the repository contribution checks and report unavailable compatibility/runtime checks honestly.
- Keep all Pudu telemetry changes and its branch untouched. The user requested a PR to the original repository; confirm the push destination and GitHub session before remote mutation. Only anonymous `npm ci --ignore-scripts` from `registry.npmjs.org` is authorized for local dependency setup; do not update Claude Code without separate authorization.

## Constraints and decisions

- Destination repository: `davila7/claude-code-templates` (verified from local project metadata/docs).
- Authorized remote operation: fetch `main` from `origin` using the existing GitHub CLI identity `devjaime`. This was performed with a one-command `gh auth git-credential` helper override; global credential configuration was not changed.
- Refreshed base: `origin/main` at `9b563c1` (`chore: Update component content`, 2026-10-04); prior local `main` was 143 commits behind. The feature worktree is isolated from the Pudu checkout.
- Feature branch: `feature/local-task-orchestrator`; worktree: `/Volumes/KINGSTON/projects/claude-code-template/local-task-orchestrator-catalog`.
- Category: `productivity` is a reasoned fit, not a prescribed template policy; the local mod guide leaves category choice open.
- No dependency on `pudu-task-telemetry`; this is an independent mod with its own manifest/hooks/tests/docs.
- Claude Code is 2.1.178; official native-mod docs require >=2.1.287. Do not weaken the native hook-module format or upgrade CLI in this task. Strict validation/runtime loading may remain blocked on the installed CLI.
- User approved local-model results returning to Claude context. Inputs/results enter Claude's context and may be handled by the configured host provider; do not claim transcript isolation.
- Strict TDD: enabled per supplied project/session instructions. Runner: `npm test`; template contribution checks: `cd cli-tool && npm test`, `npm start -- --dry-run`.
- RDD: on (global default), observed with `gentle-ai review mode status`.
- Delivery strategy: `ask-on-risk`; the user selected `feature-branch-chain`. The staged candidate exceeds 400 authored changed lines, so use focused child PR slices and keep the tracker draft/no-merge until the complete mod is integrated. The user clarified they want PRs, not a direct merge. Local Git config names `devjaime/claude-code-templates` as `fork` and `davila7/claude-code-templates` as `origin`; authorization to push to the fork with a named session is still pending.
- Project skill registry `.atl/skill-registry.md` is absent; selected skill paths are passed directly to the writer. Engram task mirror is pending because project detection returns ambiguous sibling projects; do not associate this feature with Pudu or tgrep.

## Acceptance criteria

1. The complete mod is discoverable at the documented `productivity/local-task-orchestrator` catalog path and installs via the documented `--mod` workflow.
2. Manifest, hooks module registration, config surface, test structure, and README conform to the current template guide and official Claude native-mod contract.
3. Classification outputs remain limited to input labels; extraction remains schema-limited. No inference, command execution, file writes, cloud fallback, model download, or Pudu telemetry dependency is added.
4. Tests use mocked/synthetic input only; no real model inference or remote Ollama/model service calls run during checks.
5. Template checks (`npm test`, `npm start -- --dry-run`) and applicable mod-local tests are run, with exact outcomes recorded. Installed-CLI incompatibility is reported as blocked, not passed.
6. The Pudu feature branch and all other unrelated repository content remain unchanged; final diff is limited to the catalog mod and this feature record.

## Tasks

- [x] LOC-CAT-01: Added the independent plugin under `cli-tool/components/mods/productivity/local-task-orchestrator/` with manifest, native hook module registration, implementation, mocked tests, package script, and catalog-specific README. No separate registry/catalog metadata was required: the CLI resolves a category/name path and downloads the directory recursively.
- [x] LOC-CAT-02: Verified the mod and template integration proportionally. Mod-local tests pass 14/14, the noninteractive template dry-run passes, and the template Jest failures reproduce unchanged with the candidate files removed, so they are base-only. Installed Claude CLI 2.1.178 still cannot validate the documented native `hooks/modules` schema; this remains an explicit environment limitation, not a pass.
- [ ] LOC-CAT-03: Split the candidate into reviewable work-unit commits using the user-selected `feature-branch-chain`; verify each slice independently and record commit/review evidence before opening PRs.
- [ ] LOC-CAT-04: Submit reviewable PR slice(s) targeting `davila7/claude-code-templates` with clear scope, verification outcomes, compatibility caveats, and chain context after push destination/session authorization; do not claim blocked checks passed.

## Chain plan

- Tracker branch: `feature/local-task-orchestrator` -> draft/no-merge PR to upstream `main`. First work unit is the bounded classifier/extractor core, its synthetic unit tests, package test script, and this feature record (roughly 270-290 added lines).
- Child branch: `feature/local-task-orchestrator-adapter` -> PR targeting the tracker branch. Second work unit is the native plugin manifest, hook adapter, adapter tests, and installation/usage README (334 added lines before any corrections).
- Only integrate the tracker into `main` after the child lands and the complete mod passes applicable checks. Each child PR must show only its own slice; never push the combined staged candidate as one >400-line PR.

## Progress and evidence

- Updated remote ref with `git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main` using the authorized `devjaime` session. Fetch advanced `origin/main` from `cfb95ee` to `9b563c1`.
- Created isolated worktree on `feature/local-task-orchestrator` from `origin/main`; Pudu checkout remains on `feature/pudu-task-telemetry` and was clean at branch creation.
- Added the complete mod directory and updated only this feature record. The existing source package remains read-only. No Pudu branch/worktree changes, commits, pushes, or PRs were made.
- The mod guide requires the native `hooks/hooks.json` `modules` entry and describes category/name directory distribution. `cli-tool/src/index.js` resolves the path directly as `components/mods/{category}/{name}` and downloads the whole directory; no catalog index or separate registry metadata is required. The chosen `productivity` category matches existing related routing/productivity mods; no category mandate exists.
- RED before source copy: mod `npm test` failed to import absent `hooks/register.js` and `src/tasks.js`. GREEN after packaging: mod `npm test` passed 14/14 tests.
- Parent spot-check repeated mod `npm test` (14/14 passed), checked JavaScript syntax with `node --check`, and verified the staged snapshot with `git diff --cached --check` (clean).
- Initial template checks were blocked by absent dependencies (`jest` and `commander`). `claude plugin validate --strict <absolute mod path>` failed with `hooks: Invalid input: expected record, received undefined` on installed CLI 2.1.178; this is the known pre-native-mod compatibility limitation, not a pass.
- Readme now documents template `--mod` installation, trust/enablement, configuration acknowledgments, transcript data flow, bounds, tests, and the unsupported runtime limitation. Mod contains no references/dependency on Pudu telemetry or tgrep.
- The user subsequently requested a PR against the original repository. No commit, push, or PR was made before resolving the >400-line strategy and the remote push/session boundary.
- The user selected `feature-branch-chain`. A single honest file/work-unit split fits the 400-line review budget: core/tests on the tracker, then manifest/hooks/integration tests/README on a child.
- The prior Pudu checkout has `cli-tool/node_modules`, but its `package-lock.json` hash differs from the refreshed `main` worktree. Reusing that installation cannot establish template check validity for this base; the fresh worktree still needs its own authorized dependency setup.
- The refreshed lockfile resolves only to `registry.npmjs.org`; two dependencies declare install scripts (`fsevents`, `unrs-resolver`). Prefer an explicitly authorized anonymous `npm ci --ignore-scripts` with isolated npm config before considering any lifecycle scripts.
- The user approved that exact anonymous, no-lifecycle-script dependency setup. This does not authorize any other remote destination, dependency script execution, or Claude Code upgrade. No push or PR has occurred.
- The first isolated install preflight stopped because tracked `.npmrc` files exist at the worktree root and `cli-tool`; their contents were not inspected. The later authorized run temporarily moved and restored them safely.
- The user clarified delivery should be by PR. The locally configured `fork` URL resolves to `github.com/devjaime/claude-code-templates`, and `gh` reports `devjaime` active; these observations do not by themselves authorize a push or PR mutation.
- Anonymous dependency setup completed with both tracked `.npmrc` files temporarily moved without reading them and restored byte-for-byte (matching SHA-256 before/after). `npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org/` installed 446 packages without lifecycle scripts or credential use; no tracked file changed.
- Template paired comparison: `cd cli-tool && npm test` exits 1 both with and without the candidate files, with identical failing-suite/test identifiers (9 failed / 5 passed suites; 69 failed / 138 passed / 1 skipped tests). Representative failures are existing parser/runtime/coverage failures in `StateService`, `DataService`, validators, cache/performance/websocket services, and analytics. These failures are base-only; they are not reported as passing.
- `npm start -- --dry-run --yes --template common` exits 0, detects the project, lists `common/CLAUDE.md -> CLAUDE.md`, and returns before copying. Bare `--dry-run` is interactive and was stopped at language selection.
- Mod `npm test` remains green (14 passed, 0 failed), and `git diff --check` passes. The installed Claude Code 2.1.178 validator remains incompatible with native modules; no CLI update or runtime-loading claim is made.
- Read-only GitHub inspection found no existing PR for either `devjaime:feature/local-task-orchestrator` or `devjaime:feature/local-task-orchestrator-adapter`; neither branch has been pushed.

## Next step

Create and verify the two local work-unit commits, run native risk assessment for each review boundary, then obtain explicit authorization to push both branches with the `devjaime` session and open the draft tracker plus child PR. Keep the native-runtime limitation and base-only Jest failures visible in each applicable PR.

## Relevant files

- `cli-tool/components/mods/README.md` — local template mod format and installation/validation guidance.
- `CONTRIBUTING.md` — branch and contribution verification expectations.
- `/Volumes/KINGSTON/projects/claude-code-template/claude-code-local-orchestrator/` — read-only source implementation to package.
