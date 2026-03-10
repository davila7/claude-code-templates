# Jinja Template Review Checklist

Use this checklist before finalizing generated or refactored templates.

## 1) Safety and Escaping

- [ ] Autoescaping policy is explicit for HTML/XML contexts.
- [ ] `|safe` usage is minimal and justified with trusted source assumptions.
- [ ] Untrusted template execution uses sandboxed environment.
- [ ] Context data excludes unnecessary objects and side-effectful methods.

## 2) Correctness and Data Contracts

- [ ] Required context variables are present and consistently named.
- [ ] Undefined behavior strategy is intentional (`StrictUndefined` in development where possible).
- [ ] Fallbacks use explicit `default` or `is defined` checks.
- [ ] Includes/imports resolve with existing template paths.

## 3) Architecture and Maintainability

- [ ] Inheritance chain is clear: base -> section/layout -> page.
- [ ] Block names are semantic and non-duplicated.
- [ ] Repeated fragments are extracted into macros or includes.
- [ ] Template logic remains presentation-focused; heavy business logic is in application code.

## 4) Readability and Output Stability

- [ ] Whitespace configuration is explicit (`trim_blocks`, `lstrip_blocks`).
- [ ] Trim markers (`-%}`) are used only when needed.
- [ ] Control flow (`if`, `for`, tests) is readable and not deeply nested.
- [ ] Generated output format (HTML, SQL, config, text) is stable and deterministic.

## 5) Performance and Runtime Behavior

- [ ] Environment is reused (not recreated on every render).
- [ ] Appropriate loader is configured (filesystem/package/etc.).
- [ ] Cache/reload settings match runtime environment expectations.
- [ ] Optional bytecode cache is considered for high-throughput usage.

## 6) Final Delivery Requirements

- [ ] Templates are complete and directly runnable.
- [ ] Assumptions are noted when required data/contracts are missing.
- [ ] Changes align with existing project naming/layout conventions.
- [ ] Official Jinja docs are referenced for non-obvious behaviors.
