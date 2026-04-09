---
description: Testing conventions for test and spec files across all languages
globs: ["**/*test*", "**/*spec*", "**/test/**", "**/tests/**", "**/spec/**"]
---

# Testing Rules

## Structure
- Follow the Arrange-Act-Assert (AAA) pattern. Separate each phase with a blank line.
- Each test covers one behavior or concept. Do not assert multiple unrelated things in one test.
- Use descriptive test names that state the behavior under test, not the implementation: `"returns 404 when user does not exist"` not `"test_get_user_error"`.

## What to Test
- Test observable behavior (return values, state changes, emitted events), not internal implementation details.
- Do not test private methods directly. If a private method is complex enough to test in isolation, extract it.
- Test edge cases: empty input, null/nil, boundaries, error paths.

## Test Doubles
- Prefer real objects over mocks when the real object is fast and has no external dependencies.
- Use mocks and stubs only for: external network calls, databases, clocks, and random number generators.
- Keep stubs as simple as possible. A stub that replicates too much logic becomes a second implementation to maintain.

## Reliability
- Never use `sleep`, fixed timeouts, or polling loops in tests. Use deterministic triggers or dependency injection for time.
- Tests must be independent and runnable in any order. Never rely on state left by a previous test.
- Clean up all data and side effects created during a test (use transactions, temporary directories, or teardown hooks).

## Organization
- Place test files adjacent to the code they test, or in a mirrored directory structure.
- Group related tests with `describe`/`context` blocks (or equivalent) to make output readable.
- Mark slow or integration tests so they can be excluded from fast feedback loops.
