---
title: "Five Tier Validation System"
summary: "The component security audit runs structural, integrity, semantic, reference, and provenance validators through a shared orchestrator and error model."
topics: [architecture, validation]
sources:
  - id: validation-architecture
    type: file
    path: cli-tool/src/validation/ARCHITECTURE.md
  - id: orchestrator
    type: file
    path: cli-tool/src/validation/ValidationOrchestrator.js
  - id: base-validator
    type: file
    path: cli-tool/src/validation/BaseValidator.js
  - id: structural-validator
    type: file
    path: cli-tool/src/validation/validators/StructuralValidator.js
  - id: integrity-validator
    type: file
    path: cli-tool/src/validation/validators/IntegrityValidator.js
  - id: semantic-validator
    type: file
    path: cli-tool/src/validation/validators/SemanticValidator.js
  - id: reference-validator
    type: file
    path: cli-tool/src/validation/validators/ReferenceValidator.js
  - id: provenance-validator
    type: file
    path: cli-tool/src/validation/validators/ProvenanceValidator.js
  - id: orchestrator-tests
    type: file
    path: cli-tool/tests/validation/ValidationOrchestrator.test.js
---

# Five Tier Validation System

The five tier validation system is the component security audit pipeline for agents, commands, MCPs, settings, and hooks. It combines five independent validators under one orchestrator: structural format checks, content integrity checks, semantic threat detection, reference safety checks, and provenance metadata checks [@validation-architecture] [@orchestrator].

## Responsibility

The system's responsibility is to convert component content into a structured validation result. Each validator returns validity, score, errors, warnings, and info entries using the common result model from `BaseValidator` [@base-validator]. The orchestrator then aggregates those per-validator results into an overall validity flag, error count, warning count, and average score [@orchestrator].

The architecture document describes the tiers as security gates: structural validation is critical, semantic validation is high priority, reference validation is medium priority, integrity is high priority, and provenance is medium priority [@validation-architecture].

## Tiers

Structural validation checks component shape. It enforces frontmatter parsing, required fields by component type, file size, UTF-8 encoding, description length, agent tools and model fields, recommended fields, content structure, and section count [@structural-validator].

Integrity validation hashes component content with SHA-256, can compare against an expected hash, can consult and update a hash registry, and validates version strings when a version is present [@integrity-validator].

Semantic validation scans component text for prompt injection, jailbreaks, role manipulation, command execution attempts, credential harvesting, shell access, security bypass language, unconditional obedience, context manipulation, self-modification, and sensitive data patterns [@semantic-validator].

Reference validation extracts markdown and plain URLs, blocks dangerous protocols such as `file:`, `data:`, and `javascript:`, warns or errors around HTTP depending on strictness, checks private IP ranges, and validates image sources [@reference-validator].

Provenance validation extracts metadata such as author, repository, and version from frontmatter, reads Git metadata when the file exists, validates repository URLs, and returns provenance metadata in the result [@provenance-validator].

## Entrypoints

`ValidationOrchestrator.validateComponent()` runs all five validators by default in this order: structural, integrity, semantic, reference, provenance [@orchestrator]. Callers can pass a `validators` list to run only a subset, which is covered by the selective execution test [@orchestrator] [@orchestrator-tests].

`validateComponents()` runs the same component-level pipeline for a batch and counts passed, failed, and warning totals [@orchestrator]. Report helpers then render either human-readable output or JSON, and `getErrorCodes()` extracts unique error codes from single or batch results [@orchestrator].

## Invariants And Failure Modes

The common result model is the key invariant. Validators should add errors, warnings, and info through `BaseValidator`, because scoring depends on the shared penalty model: each error costs 25 points, each warning costs 5 points, and scores floor at zero [@base-validator].

The orchestrator is tolerant of unknown validator names and individual validator exceptions. Unknown names are skipped with a warning, while thrown errors become failed validator results and increment the overall error count [@orchestrator].

The system is also intentionally selectable. Strict semantic mode and integrity registry updates are passed only to the relevant validator, so new options should be routed at the orchestrator boundary instead of leaking unrelated options to every tier [@orchestrator].

The main contributor risk is treating the architecture document as the only source of truth. The document names the intended tiers and CLI contract, while the executable behavior is defined by `ValidationOrchestrator` and the individual validator classes [@validation-architecture] [@orchestrator].
