---
title: "Add New Validator"
summary: "How to add a validator to the security validation system without breaking orchestration, scoring, reports, or tests."
topics: [concepts]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: validation-readme
    type: file
    path: cli-tool/src/validation/README.md
  - id: base-validator
    type: file
    path: cli-tool/src/validation/BaseValidator.js
  - id: orchestrator
    type: file
    path: cli-tool/src/validation/ValidationOrchestrator.js
  - id: validation-tests-dir
    type: file
    path: cli-tool/tests/validation/
  - id: cli-package
    type: file
    path: cli-tool/package.json
---

# Add New Validator

This guide explains how to add a validator to the repository's security validation system and make it behave like the existing five tiers. The coverage map assigns this page to the workflow for adding a validator and its tests, using the validation README, `BaseValidator`, `ValidationOrchestrator`, and validation tests as evidence [@coverage-entry].

## Successful outcome

A successful new validator is a `BaseValidator` subclass that returns the shared result shape, is registered in `ValidationOrchestrator`, appears in human and JSON reports, and has focused tests under `cli-tool/tests/validation/`. The existing system validates components through structural, integrity, semantic, reference, and provenance tiers [@validation-readme].

## Preconditions

Read the validation tier you are extending before adding a new one. The README defines each tier's job and code family: structural checks component format, integrity handles SHA256 and tamper detection, semantic detects malicious patterns, reference validates URLs and SSRF risks, and provenance checks authorship and repository metadata [@validation-readme].

Keep the result contract unchanged. `BaseValidator` owns `errors`, `warnings`, `info`, `addError()`, `addWarning()`, `addInfo()`, `isValid()`, `getScore()`, `getResults()`, `reset()`, line-location helpers, and the abstract `validate()` method that subclasses must implement [@base-validator].

## Ordered work

1. Create the validator class in `cli-tool/src/validation/validators/`. It should extend `BaseValidator`, call `reset()` at the start of validation when needed, add findings through `addError()`, `addWarning()`, and `addInfo()`, and return `getResults()` or an object compatible with it [@base-validator].

2. Choose code prefixes before writing rules. The current tiers use prefixes such as `STRUCT_E001`, `INT_E001`, `SEM_E001`, `REF_E001`, and `PROV_E001`; a new validator should use its own prefix so report filtering stays clear [@validation-readme].

3. Import and instantiate the validator in `ValidationOrchestrator`. The orchestrator currently imports the five validator classes and stores instances in `this.validators` under lowercase keys [@orchestrator].

4. Add the new validator key to the default list if it must run in normal audits. `validateComponent()` defaults to `['structural', 'integrity', 'semantic', 'reference', 'provenance']`; a new always-on tier belongs in that default array [@orchestrator].

5. Add validator-specific options only in the orchestrator boundary. Existing options are passed selectively: `semantic` receives `strict`, and `integrity` receives `updateRegistry` [@orchestrator].

6. Add tests in `cli-tool/tests/validation/`. That directory already contains focused validator tests plus a `ValidationOrchestrator` test file, which is the right place to cover both standalone behavior and orchestration registration [@validation-tests-dir].

## Verification

Run the security audit scripts from `cli-tool`. The package exposes `npm run security-audit`, `npm run security-audit:ci`, `npm run security-audit:verbose`, and `npm run security-audit:json`, all backed by `node src/security-audit.js` with the matching flags [@cli-package].

Run the Jest validation tests through the CLI package test command. `cli-tool/package.json` defines `npm test` as `jest`, along with narrower commands such as `npm run test:unit`, `npm run test:integration`, and `npm run test:analytics` [@cli-package].

Check the report output after adding the tier. `generateReport()` prints a validator breakdown for every entry in `componentResult.validators`, and `generateJsonReport()` serializes the same results, so a missing tier usually means the validator was not registered or was not included in the default list [@orchestrator].

## Recovery notes

If the audit warns about an unknown validator, the requested key is not present in `this.validators`; the orchestrator logs unknown names and skips them [@orchestrator]. If the whole component fails with one validator error and no structured findings, the subclass likely threw from `validate()`, and `validateComponent()` converted that exception into a failed validator result [@orchestrator].

If the new validator makes scores unexpectedly harsh, inspect `BaseValidator.getScore()`. Each error costs 25 points and each warning costs 5 points, with a floor of zero [@base-validator].
