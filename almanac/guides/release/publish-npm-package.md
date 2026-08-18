---
title: "Publish NPM Package"
summary: "How to publish the claude-code-templates npm package after version alignment, tests, token setup, cleanup, tagging, and deployment follow-up."
topics: [guides, cli]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: root-claude
    type: file
    path: CLAUDE.md
  - id: root-package
    type: file
    path: package.json
  - id: cli-package
    type: file
    path: cli-tool/package.json
  - id: cli-testing
    type: file
    path: cli-tool/TESTING.md
---

# Publish NPM Package

This guide is the release path for publishing `claude-code-templates` to npm. The coverage map assigns it to package version alignment, npm granular tokens, publishing, token cleanup, tagging, and deployment follow-up, with `CLAUDE.md`, `cli-tool/TESTING.md`, and both package manifests as evidence [@coverage-entry].

## Successful outcome

A successful npm publish leaves the registry on the intended version, removes the npm auth token from local config, pushes a matching Git tag, and follows up on website deployment. The repository guidance lists the publish flow as catalog generation, tests, registry version check, local version bump, commit and push, npm publish with a granular token, token deletion, release tag, and website deploy follow-up [@root-claude].

For the test gate before this guide, use [Run API and CLI Tests](run-api-and-cli-tests.md).

## Preconditions

Confirm which package manifest you are publishing. The root `package.json` publishes the package name `claude-code-templates`, exposes the `claude-code-templates` and `cct` bins from `cli-tool/bin/create-claude-config.js`, and includes `cli-tool/bin/`, `cli-tool/src/`, sandbox component folders, `cli-tool/package.json`, and `README.md` in the package files [@root-package]. The nested `cli-tool/package.json` also has the same package name but includes many bin aliases, a `prepublishOnly` script, and its own `files` list [@cli-package].

Check the current npm registry version before editing. The project notes warn that the local `package.json` version can drift from npm and says to run `npm view claude-code-templates version` before aligning the local version one patch above the registry version [@root-claude].

Use a granular npm token, not a hardcoded secret. The publishing notes require a granular token with read and write access for `claude-code-templates`, with bypass 2FA enabled, and also say never to hardcode or commit tokens [@root-claude].

## Ordered work

1. Regenerate the component catalog if the release includes component changes. The repository's publish workflow starts with `python scripts/generate_components_json.py` [@root-claude].

2. Run the release test gate. The root guidance lists `npm test` in the publish flow, and the CLI testing guide says pre-publish checks should include `npm run test:all`, manual verification, and fresh-environment testing when applicable [@root-claude] [@cli-testing].

3. Align the version. Run `npm view claude-code-templates version`, choose the next patch, minor, or major version, and update the publishing manifest deliberately [@root-claude].

4. Commit and push the version bump before publishing. The documented flow uses `git add package.json`, a version bump commit, and `git push origin main` before npm publish [@root-claude].

5. Configure the token only for the publish operation. The documented command is `npm config set //registry.npmjs.org/:_authToken=YOUR_GRANULAR_TOKEN`, followed by `npm publish` [@root-claude].

6. Remove the token immediately after publish. The same workflow requires `npm config delete //registry.npmjs.org/:_authToken` and explicitly says to always clean up after publishing [@root-claude].

7. Tag the release. The documented release tag format is `vX.Y.Z`, pushed with `git push origin vX.Y.Z` [@root-claude].

8. Confirm deployment follow-up. The repo notes say dashboard deploys to production automatically from GitHub Actions on pushes to `main` that change `dashboard/**`, and manual deploys use Cloudflare Pages through `npm run deploy`, not Vercel [@root-claude].

## Verification

Verify the package surface before and after publishing. The root manifest's package files and bins define what npm consumers receive, while the CLI manifest's bins define additional command aliases that should still work in local CLI tests [@root-package] [@cli-package].

Verify the published version with `npm view claude-code-templates version` after publish. The same command is the documented source of truth for registry version alignment [@root-claude].

Verify the token is gone from npm config after publish. This matters because the repository's security guidance says secrets and tokens must not be hardcoded or committed, and the publish notes require token deletion after `npm publish` [@root-claude].

## Recovery notes

If `npm publish` fails because tests run automatically, inspect `cli-tool/package.json`. Its `prepublishOnly` script runs `npm run build:ui && npm test`, so a failed analytics UI build or Jest run can block publish from that package [@cli-package].

If a publish used the wrong version, do not guess from local files. Check the registry version again, then decide whether to publish a corrected next version or deprecate the mistaken version according to npm policy [@root-claude].
