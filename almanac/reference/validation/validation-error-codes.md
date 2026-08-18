---
title: "Validation Error Codes"
summary: "Lookup material for structural, semantic, reference, integrity, and provenance validation codes."
topics: [reference, validation, security]
sources:
  - id: coverage-entry
    type: file
    path: almanac/coverage-map.md
  - id: base-validator
    type: file
    path: cli-tool/src/validation/BaseValidator.js
  - id: architecture-doc
    type: file
    path: cli-tool/src/validation/ARCHITECTURE.md
  - id: validation-readme
    type: file
    path: cli-tool/src/validation/README.md
  - id: structural-validator
    type: file
    path: cli-tool/src/validation/validators/StructuralValidator.js
  - id: semantic-validator
    type: file
    path: cli-tool/src/validation/validators/SemanticValidator.js
  - id: reference-validator
    type: file
    path: cli-tool/src/validation/validators/ReferenceValidator.js
  - id: integrity-validator
    type: file
    path: cli-tool/src/validation/validators/IntegrityValidator.js
  - id: provenance-validator
    type: file
    path: cli-tool/src/validation/validators/ProvenanceValidator.js
---

# Validation Error Codes

Validation codes are stable identifiers attached to every validator finding. The coverage map assigns this page to the `STRUCT_*`, `SEM_*`, `REF_*`, `INT_*`, and `PROV_*` families, while `BaseValidator` defines the shared finding shape as `level`, `code`, `message`, `metadata`, and `timestamp` [@coverage-entry] [@base-validator].

## Code Families

The validation docs describe five validator families: structural, integrity, semantic, reference, and provenance [@validation-readme]. The architecture document gives the same five-tier model but lists only a subset of the codes that the current validators emit, so use validator source files as the authoritative lookup when docs and code differ [@architecture-doc] [@structural-validator] [@semantic-validator] [@reference-validator] [@integrity-validator] [@provenance-validator].

| Prefix | Validator | Meaning |
| --- | --- | --- |
| `STRUCT_*` | Structural | Frontmatter, file size, encoding, required fields, tools, model, and markdown structure [@structural-validator]. |
| `SEM_*` | Semantic | Prompt injection, jailbreak, role manipulation, credential, XSS, and dangerous-command content [@semantic-validator]. |
| `REF_*` | Reference | URL protocols, HTTP/HTTPS, private IPs, localhost, suspicious TLDs, markdown links, and image sources [@reference-validator]. |
| `INT_*` | Integrity | Content hashes, expected-hash checks, registry drift, registry updates, and version format [@integrity-validator]. |
| `PROV_*` | Provenance | Author metadata, git metadata, repository platform, repository protocol, and version consistency [@provenance-validator]. |

## Structural Codes

`StructuralValidator` emits errors for empty content, missing or invalid frontmatter, oversized files, invalid encoding, null bytes, missing required fields, invalid descriptions, and invalid tools fields [@structural-validator]. It emits warnings for large files, short or long descriptions, empty or unknown tools, missing or unknown models, short content, missing markdown headers, and high section counts [@structural-validator].

| Code | Level | Trigger |
| --- | --- | --- |
| `STRUCT_E001` | error | Missing content or YAML frontmatter. |
| `STRUCT_E002` | error | Empty, non-object, or invalid YAML frontmatter. |
| `STRUCT_E003` | error | File size exceeds 100KB. |
| `STRUCT_E004` | error | Invalid UTF-8 or failed encoding validation. |
| `STRUCT_E005` | error | Null bytes in content. |
| `STRUCT_E006` | error | Missing required field for the component type. |
| `STRUCT_E007` | error | Description is not a string. |
| `STRUCT_E008` | error | Agent `tools` is neither string nor array. |
| `STRUCT_W002` | warning | File size is above 80 percent of the 100KB limit. |
| `STRUCT_W003` | warning | Description is shorter than 20 characters. |
| `STRUCT_W004` | warning | Description is longer than 500 characters. |
| `STRUCT_W005` | warning | Tools string or array is empty. |
| `STRUCT_W006` | warning | Agent tools include unknown tool names. |
| `STRUCT_W007` | warning | Agent model is missing. |
| `STRUCT_W008` | warning | Agent model is not in the known model list. |
| `STRUCT_W009` | warning | Body content is under 50 characters. |
| `STRUCT_W010` | warning | Body has no markdown headers. |
| `STRUCT_W011` | warning | Body has more than 20 markdown sections. |
| `STRUCT_I001` | info | File size recorded. |
| `STRUCT_I002` | info | Valid frontmatter found. |
| `STRUCT_I003` | info | Recommended fields missing. |
| `STRUCT_I004` | info | Section count recorded. |

## Semantic Codes

`SemanticValidator` treats dangerous patterns, hardcoded sensitive data, HTML/script injection, and dangerous command strings as errors [@semantic-validator]. Suspicious patterns are warnings by default but become errors when strict mode is enabled by the audit CLI's `--ci` path [@semantic-validator].

| Code | Level | Trigger |
| --- | --- | --- |
| `SEM_E001` | error | Empty content or "ignore previous instructions" style jailbreak. |
| `SEM_E002` | error | System, developer, hidden, or internal instruction references. |
| `SEM_E003` | error | "You are now..." role manipulation. |
| `SEM_E004` | error | "Execute the following code/command/script" pattern. |
| `SEM_E005` | error | Credential harvesting request. |
| `SEM_E006` | error | Shell, terminal, bash, cmd, or PowerShell access request. |
| `SEM_E007` | error | Security, safety, filter, protection, or validation bypass request. |
| `SEM_E008` | error | Unconditional obedience instruction. |
| `SEM_E009` | error | Context manipulation request. |
| `SEM_E010` | error | Self-modification request. |
| `SEM_E011` | error | Hardcoded password. |
| `SEM_E012` | error | Hardcoded API key. |
| `SEM_E013` | error | Hardcoded secret or token. |
| `SEM_E014` | error | `<script>` tag. |
| `SEM_E015` | error | `<iframe>` tag. |
| `SEM_E016` | error | `javascript:` protocol. |
| `SEM_E017` | error | Inline `onclick=` handler. |
| `SEM_E018` | error | Inline `onerror=` handler. |
| `SEM_E019` | error | Dangerous command content such as destructive remove, fork bomb, or raw disk write. |
| `SEM_W001` | warning or strict error | Role pretending instruction. |
| `SEM_W002` | warning or strict error | Known jailbreak terminology. |
| `SEM_W003` | warning or strict error | Raw output request. |
| `SEM_W004` | warning or strict error | Repeat or echo instruction. |
| `SEM_W005` | warning | Agent-specific overly permissive instruction. |

## Reference Codes

`ReferenceValidator` extracts markdown and plain HTTP(S) URLs, validates blocked and allowed protocols, checks private and localhost hosts, warns on suspicious TLDs, checks dangerous markdown links, and validates image sources [@reference-validator].

| Code | Level | Trigger |
| --- | --- | --- |
| `REF_E001` | error | Component content is empty or missing. |
| `REF_E002` | error | Blocked protocol such as `file:`, `ftp:`, `data:`, `javascript:`, or `vbscript:`. |
| `REF_E003` | error | HTTP URL when strict HTTPS is required. |
| `REF_E004` | error | Private IP address, including loopback, RFC 1918, link-local, and unique-local ranges. |
| `REF_E005` | error | Dangerous protocol inside a markdown link. |
| `REF_W001` | warning | Unknown protocol. |
| `REF_W002` | warning | HTTP URL when strict HTTPS is not required. |
| `REF_W003` | warning | Localhost reference. |
| `REF_W004` | warning | Suspicious or uncommon TLD. |
| `REF_W005` | warning | Invalid URL format. |
| `REF_W006` | warning | Large data URI image. |
| `REF_I001` | info | Accessibility check skipped after URL extraction. |

## Integrity Codes

`IntegrityValidator` always hashes non-empty content with SHA256, can compare that hash to an expected value, checks the local hash registry, validates optional version strings, and can update the registry when called with `updateRegistry` [@integrity-validator].

| Code | Level | Trigger |
| --- | --- | --- |
| `INT_E001` | error | Component content is empty or missing. |
| `INT_E002` | error | Current SHA256 hash does not match the expected hash. |
| `INT_W001` | warning | Component hash changed since last registry validation. |
| `INT_W003` | warning | Version is not `X.Y.Z` or simple numeric format. |
| `INT_W004` | warning | Hash registry update failed. |
| `INT_I001` | info | SHA256 hash generated. |
| `INT_I002` | info | Expected-hash verification passed. |
| `INT_I003` | info | Current hash matches registry. |
| `INT_I004` | info | Version changed from registry value. |
| `INT_I005` | info | Component is new to the registry. |
| `INT_I006` | info | Hash registry missing or unreadable. |
| `INT_I007` | info | Version format accepted. |
| `INT_I008` | info | Hash registry updated. |
| `INT_I009` | info | Component has no inline version because metadata can live in marketplace data. |

## Provenance Codes

`ProvenanceValidator` extracts `author`, `repository`, and `version` from YAML frontmatter with regular expressions, optionally checks git metadata for existing files, validates repository platforms, and records metadata in the result object [@provenance-validator].

| Code | Level | Trigger |
| --- | --- | --- |
| `PROV_E001` | error | Component content is empty or missing. |
| `PROV_E002` | error | Author is required by options but missing. |
| `PROV_W001` | warning | Git metadata is required by options but unavailable. |
| `PROV_W003` | warning | Author name is shorter than two characters. |
| `PROV_W004` | warning | Git remote is not a recognized platform. |
| `PROV_W005` | warning | Frontmatter repository is not from a recognized platform. |
| `PROV_W006` | warning | Frontmatter repository uses HTTP. |
| `PROV_W007` | warning | Version does not follow semantic versioning. |
| `PROV_I001` | info | File path does not exist, so the component is treated as in-memory. |
| `PROV_I002` | info | Author recorded. |
| `PROV_I003` | info | Git commit recorded. |
| `PROV_I004` | info | Git remote recorded. |
| `PROV_I005` | info | Frontmatter repository recorded. |
| `PROV_I006` | info | Version recorded. |
| `PROV_I007` | info | Component has no inline author because metadata can live in marketplace data. |

For the result object that carries these codes, read [Validation Error Model](../../concepts/validation/validation-error-model). For the orchestrated five-tier flow, read [Five-Tier Validation System](../../architecture/validation/five-tier-validation-system). For CLI behavior around strict mode, read [Security Audit CLI Contract](security-audit-cli-contract).
