---
title: "Validation Scoring Code vs Docs"
summary: "Runtime validation scoring currently averages positive validator scores even though the README documents a weighted formula."
topics: [decisions, validation]
sources:
  - id: validation-orchestrator
    type: file
    path: cli-tool/src/validation/ValidationOrchestrator.js
  - id: validation-readme
    type: file
    path: cli-tool/src/validation/README.md
  - id: validation-architecture
    type: file
    path: cli-tool/src/validation/ARCHITECTURE.md
---

# Validation Scoring Code vs Docs

The validation score contract has drifted: the README documents a weighted formula across structural, integrity, semantic, reference, and provenance validators, but `ValidationOrchestrator` currently calculates the overall score as the rounded average of positive validator scores that were returned [@validation-readme] [@validation-orchestrator]. Until the docs or code are changed, the runtime code is the authoritative behavior for reports and JSON output.

## Status

Active documentation drift. The validator architecture and README describe a trust-score system and per-validator score fields, while the orchestrator implementation owns the score emitted by actual validation runs [@validation-architecture] [@validation-readme] [@validation-orchestrator].

## Context

The orchestrator runs five validator tiers by default: structural, integrity, semantic, reference, and provenance [@validation-orchestrator]. Each validator result contributes validity, score, error count, warning count, errors, warnings, and info to the aggregate report, with optional hash and metadata preserved when present [@validation-orchestrator].

The README's scoring section gives semantic validation the largest weight, then structural, integrity, reference, and provenance weights [@validation-readme]. The architecture document shows per-validator audit scores in generated component metadata, but does not override the current orchestrator calculation [@validation-architecture].

## Decision

Treat `ValidationOrchestrator` as the source of truth for current scoring. It gathers validator scores, substitutes `0` when a validator score is missing, filters out scores that are not greater than zero, and rounds the arithmetic average of the remaining scores [@validation-orchestrator].

The README formula remains design intent, not runtime behavior, until someone either implements weighted scoring or edits the docs to match averaging [@validation-readme] [@validation-orchestrator].

## Consequences

Pages such as [Five Tier Validation System](../../architecture/validation/five-tier-validation-system) and [Validation Error Model](../../concepts/validation/validation-error-model) should describe the code path when explaining observed reports. A component can show an overall score that differs from the weighted formula readers might expect from the README [@validation-readme] [@validation-orchestrator].

Fixing the drift requires a deliberate compatibility decision. Implementing the README formula would make semantic failures count more heavily, while changing the docs would preserve the simpler average that existing reports already emit [@validation-readme] [@validation-orchestrator].
