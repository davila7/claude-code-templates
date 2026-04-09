---
description: Rust patterns and idioms for .rs files
globs: ["**/*.rs"]
---

# Rust Rules

## Error Handling
- Use `Result<T, E>` for all recoverable errors. Do not use `unwrap()` or `expect()` in library code.
- Use the `?` operator to propagate errors rather than matching on every `Result` manually.
- Define custom error types that implement `std::fmt::Display` and `std::error::Error`.
- Use `thiserror` for library errors and `anyhow` for application-level error handling.
- Reserve `panic!` for unrecoverable programmer errors (e.g., violated invariants).

## Ownership and Borrowing
- Prefer `&str` over `String` for function parameters that only need to read a string.
- Prefer `&[T]` over `&Vec<T>` for function parameters that only need to read a slice.
- Return owned types (`String`, `Vec<T>`) from functions that create new data.
- Minimize clone calls. If you need to clone frequently, reconsider the ownership design.

## Types and Traits
- Use `derive` macros (`Debug`, `Clone`, `PartialEq`, `serde::Serialize`) whenever possible.
- Implement `Display` for types that will appear in user-facing output.
- Prefer newtype wrappers over raw primitives for domain values (e.g., `struct UserId(u64)`).
- Use iterators and iterator adapters (`map`, `filter`, `collect`) instead of manual loops.

## Unsafe Code
- Minimize `unsafe` blocks. Encapsulate unsafe code in a small, well-documented module.
- Every `unsafe` block must have a comment explaining the invariant that makes it sound.

## Tooling
- Follow all `clippy` recommendations. Treat clippy warnings as errors in CI.
- Run `rustfmt` on all files. Do not manually format code that rustfmt would reformat.
- Use `cargo test` for unit and integration tests. Place unit tests in a `#[cfg(test)]` module at the bottom of the source file.
