---
title: "Validation Error Model"
summary: "The shared structure for validation errors, warnings, info messages, scores, timestamps, metadata, and aggregate reports."
topics: [concepts]
sources:
  - id: base-validator
    type: file
    path: cli-tool/src/validation/BaseValidator.js
  - id: orchestrator
    type: file
    path: cli-tool/src/validation/ValidationOrchestrator.js
  - id: validation-readme
    type: file
    path: cli-tool/src/validation/README.md
---

# Validation Error Model

The validation error model is the common result language used by the repository's component security validators. Every validator built on `BaseValidator` records errors, warnings, and info entries with a severity level, code, human message, metadata object, and ISO timestamp [@base-validator]. The orchestrator then groups those findings by validator, totals errors and warnings, computes an overall score, and emits either a human-readable report or JSON [@orchestrator].

## Finding Shape

`BaseValidator.addError()`, `addWarning()`, and `addInfo()` all create the same basic object shape: `level`, `code`, `message`, `metadata`, and `timestamp` [@base-validator]. The level is one of `error`, `warning`, or `info`, while the code is the durable identifier used by reports and downstream tooling [@base-validator].

Metadata is intentionally open-ended. Validators can attach context such as paths, fields, line positions, detected patterns, or other details without changing the shared result schema [@base-validator]. `getLineFromIndex()` supports source-location metadata by converting a character index into line number, column, trimmed line text, and `line:column` position [@base-validator].

## Validity And Scores

At the validator level, validity is binary: a result is valid when it has no errors [@base-validator]. The score is numeric and starts at 100, then subtracts 25 points per error and 5 points per warning, with a floor of zero [@base-validator]. `getResults()` returns that score alongside `valid`, counts, and the three arrays of findings [@base-validator].

The orchestrator aggregates validator results into a component-level object. It records the component path and type, a top-level timestamp, overall validity, overall score, total error count, total warning count, and a `validators` object keyed by validator name [@orchestrator]. If any validator result is invalid, the component result becomes invalid [@orchestrator].

## Orchestrated Results

The orchestrator knows five validator tiers: structural, integrity, semantic, reference, and provenance [@orchestrator]. By default it runs all five, but callers can pass a validator list and options such as `strict` for semantic validation or `updateRegistry` for integrity validation [@orchestrator].

Each validator result is copied into the aggregate report with `valid`, `score`, counts, errors, warnings, and info. Optional fields such as `hash` and `metadata` are preserved when a validator returns them [@orchestrator]. If a validator throws, the orchestrator records that validator as invalid with the thrown error message, increments the overall error count, and continues building the report [@orchestrator].

## Batch And Report Forms

Batch validation wraps individual component results in a summary with total, passed, failed, warnings, and timestamp fields [@orchestrator]. Human-readable reports show pass or fail status, score badges, per-validator status, and in verbose mode a capped list of errors and warnings for each validator [@orchestrator]. JSON reports are the same data serialized with indentation [@orchestrator].

The README describes the validation system as a five-tier security audit covering structure, integrity, semantic risk, external references, and provenance [@validation-readme]. It also documents error-code families such as `STRUCT_*`, `INT_*`, `SEM_*`, `REF_*`, and `PROV_*`, which matches the code's shared `code` field model [@validation-readme].

## Code And Documentation Difference

The README presents a weighted scoring formula across validator tiers, with semantic checks weighted most heavily [@validation-readme]. The current `ValidationOrchestrator` implementation instead calculates the overall score as the rounded average of positive validator scores that were returned [@orchestrator]. Future readers should treat `BaseValidator` and `ValidationOrchestrator` as authoritative for current runtime behavior, and the README as stated design intent where it differs.
