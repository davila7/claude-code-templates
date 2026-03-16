---
description: Go idioms and conventions for .go files
globs: ["**/*.go"]
---

# Go Rules

## Error Handling
- Check errors immediately after every call that returns one. Never defer error checks.
- Return errors to the caller. Do not `panic` for recoverable errors.
- Wrap errors with context: `fmt.Errorf("loading config: %w", err)`.
- Define custom error types using `errors.New` or a struct implementing the `error` interface.

## Function Signatures
- Pass `context.Context` as the first parameter in functions that do I/O or may be cancelled.
- Keep function signatures short. If a function needs more than four or five parameters, use an options struct.

## Variables and Naming
- Use short variable names in small scopes (`i`, `v`, `err`, `n`).
- Use descriptive names for package-level and exported identifiers.
- Prefer `:=` for local variable declarations. Use `var` only when zero-value initialization is intentional or the type must be explicit.

## Interfaces
- Define interfaces at the point of use (in the package that consumes them), not in the package that implements them.
- Keep interfaces small - one to three methods is ideal.
- Use interfaces to make code testable by allowing fake/stub implementations.

## Testing
- Use table-driven tests with `[]struct{ name, input, want }` slices.
- Name subtests with `t.Run(tc.name, ...)` so failures are easy to identify.
- Prefer the standard `testing` package. Add `testify/assert` only when it reduces significant boilerplate.

## Project Layout
- Follow the standard Go project layout: `cmd/`, `internal/`, `pkg/`.
- Keep `main` packages in `cmd/<binary-name>/main.go`.
- Put packages that must not be imported externally under `internal/`.

## Concurrency
- Use channels to communicate between goroutines. Do not share memory without a mutex.
- Always specify goroutine lifecycle: who starts it, who waits for it, and how it exits.
