---
title: "Run API and CLI Tests"
summary: "Which API, CLI, validation, and predeploy commands to run before release or deployment, and how to interpret failures."
topics: [concepts]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: api-package
    type: file
    path: api/package.json
  - id: api-tests
    type: file
    path: api/__tests__/endpoints.test.js
  - id: api-jest
    type: file
    path: api/jest.config.cjs
  - id: cli-package
    type: file
    path: cli-tool/package.json
  - id: cli-testing
    type: file
    path: cli-tool/TESTING.md
  - id: predeploy-check
    type: file
    path: scripts/predeploy-check.sh
  - id: root-claude
    type: file
    path: CLAUDE.md
---

# Run API and CLI Tests

This guide defines the test gate before release or deployment. The coverage map assigns it to API, CLI, validation, and predeploy test commands, using the API test package, endpoint tests, CLI package, CLI testing guide, and predeploy script as evidence [@coverage-entry].

## Successful outcome

A successful run proves the public API endpoints respond without server errors, the CLI tests pass, security validation can run, and the predeploy script does not stop on missing dependencies or failing API tests. For publishing steps after the gate, use [Publish NPM Package](publish-npm-package.md).

## Preconditions

Know which test suite hits production-like endpoints. `api/package.json` runs Jest with `jest.config.cjs`; `npm run test:api` targets `__tests__/endpoints.test.js` [@api-package]. The endpoint test file defaults `API_BASE_URL` to `https://aitmpl.com`, so set `API_BASE_URL` when you intend to test another environment [@api-tests].

Know which test suite exercises the CLI package. `cli-tool/package.json` defines `npm test` as Jest, with separate commands for unit, integration, end-to-end, analytics, command tests, and security audit scripts [@cli-package].

## Ordered work

1. Run the API endpoint suite from `api/`. Use `npm run test:api` for the critical endpoint file or `npm test` for the configured Jest suite [@api-package].

2. Check what the API tests are proving. They POST to `/api/track-download-supabase`, `/api/discord/interactions`, and `/api/track-command-usage`, GET `/api/claude-code-check`, verify non-5xx availability, validate bad input handling, and enforce a 30-second response window for critical endpoints [@api-tests].

3. Run the CLI Jest suite from `cli-tool/`. Use `npm test` for all configured Jest tests, or narrow with `npm run test:unit`, `npm run test:integration`, or `npm run test:analytics` when isolating a failure [@cli-package].

4. Run command-level CLI checks when changing install behavior. The CLI testing guide recommends `npm run dev:link`, `npm test`, detailed tests, framework-specific tests, and `npm run dev:unlink` for local package testing [@cli-testing].

5. Run security validation when changing components or validation code. The CLI package exposes `npm run security-audit`, `npm run security-audit:ci`, `npm run security-audit:verbose`, and `npm run security-audit:json` [@cli-package].

6. Use `scripts/predeploy-check.sh` before production deployment when API confidence matters. The script checks git state, Node and npm, installs root and API dependencies with ignored scripts, runs `npm run test:api`, verifies critical endpoint files, inspects `.env.example`, checks `vercel.json`, and prints a pass/fail summary [@predeploy-check].

## Verification

API verification is not just a green Jest process. The test file marks component download tracking as critical, rejects missing or invalid payloads, checks command usage validation, and confirms all critical endpoints respond within the configured timeout [@api-tests]. The Jest config sets a node environment, matches `**/__tests__/**/*.test.js`, uses a 30-second default timeout, keeps running after failures, and allows up to four workers [@api-jest].

CLI verification should include the behavior that changed. The testing guide lists automated coverage for command variants, help and version output, language and framework support, file creation, framework commands, dry run mode, and invalid input handling [@cli-testing].

## Recovery notes

If API tests fail with connection or timeout errors, check `API_BASE_URL` first because the suite defaults to the production domain [@api-tests]. If only validation expectations fail, read the request payload in the failing test before changing endpoint code; several tests intentionally expect 400 responses for bad input [@api-tests].

If `predeploy-check.sh` gives stale deployment advice, treat the script as a test runner and file-structure check, not as the source of deployment truth. It still prints Vercel-oriented messages, while the repository's current guidance says dashboard deploys use Cloudflare Pages; keep the test result, but follow the current deployment guide in the root project notes [@predeploy-check] [@root-claude].
