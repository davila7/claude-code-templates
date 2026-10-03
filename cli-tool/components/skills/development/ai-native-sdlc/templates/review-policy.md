# Review policy

Project-wide review passes, run in Stage 5 before any PR opens. Each pass is
executed by an adversarial reviewer that did not write the code, instructed to
refute the diff, and to report only findings with a concrete failure scenario.
Edit this file to encode your organization's policy — it is version-controlled
institutional knowledge, and changing it changes every future review.

## Pass: Bugs
- Logic errors, off-by-ones, unhandled error paths, race conditions.
- Broken edge cases: empty inputs, nulls, unicode, concurrent access, clock
  and timezone assumptions.
- Behavior that contradicts the spec's acceptance criteria.

## Pass: Security
- Injection (SQL, command, path, template), unsafe deserialization.
- Secrets in code, logs, or fixtures; credentials in URLs.
- AuthN/AuthZ gaps: missing checks, confused-deputy paths, IDOR.
- Unvalidated input at trust boundaries; unsafe defaults.

## Pass: Compliance

Replace the examples below with your organization's actual obligations:

- PII handled per policy (collection minimized, retention bounded, logs clean).
- License compatibility of any new dependency.
- Audit-relevant actions are logged.

## Pass: Simplification
- Duplication of logic that already exists in the codebase.
- Abstractions with one caller; configurability nothing uses.
- Code the diff added that the diff also made unnecessary.

## Rules
- No style nits — linters own style.
- Every finding names a failure scenario; "this looks wrong" is not a finding.
- An empty pass is a valid result and is recorded as such.
