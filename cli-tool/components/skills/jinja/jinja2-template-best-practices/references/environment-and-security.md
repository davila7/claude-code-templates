# Jinja Environment and Security Defaults

## Table of Contents
- [Baseline Environment](#baseline-environment)
- [Autoescaping Rules](#autoescaping-rules)
- [Undefined Strategy](#undefined-strategy)
- [Sandboxing Untrusted Templates](#sandboxing-untrusted-templates)
- [Performance and Caching](#performance-and-caching)
- [Unsafe Patterns to Reject](#unsafe-patterns-to-reject)

## Baseline Environment

Use an explicit environment setup instead of ad-hoc defaults.

```python
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

env = Environment(
    loader=FileSystemLoader("templates"),
    autoescape=select_autoescape(["html", "htm", "xml"]),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
    auto_reload=True,
)
```

Why this baseline:
- `select_autoescape(...)` sets explicit escaping policy for markup-like outputs.
- `StrictUndefined` catches missing variables early instead of silently rendering empty output.
- `trim_blocks` + `lstrip_blocks` reduce accidental whitespace noise.

## Autoescaping Rules

- For HTML/XML output, enable autoescaping intentionally.
- Avoid using `|safe` unless content is trusted and already sanitized.
- Keep escaping strategy consistent across all templates in a project.
- Remember that macros and `super()` return template data marked safe in Jinja behavior; still validate boundaries where data enters templates.

## Undefined Strategy

Use strict undefined behavior during development and CI to catch context drift.

Template-level guidance:
- Prefer explicit checks: `value is defined`
- Use defaults intentionally: `value|default("fallback")`
- Do not hide data-contract errors with broad defaulting everywhere.

## Sandboxing Untrusted Templates

If template source is user-authored or otherwise untrusted:
- Use `jinja2.sandbox.SandboxedEnvironment` (or `ImmutableSandboxedEnvironment`).
- Pass only minimal required data into context.
- Avoid passing rich objects with side-effectful methods.
- Catch rendering exceptions and enforce CPU/memory limits at runtime.

## Performance and Caching

- Reuse one configured `Environment` per app/service, do not recreate per render.
- Use template loaders (filesystem/package) instead of raw `from_string` for maintainability and inheritance.
- Enable bytecode cache in high-throughput environments where appropriate.
- Tune `cache_size` and `auto_reload` by environment:
  - development: `auto_reload=True`
  - production: lower reload overhead and rely on deployment invalidation strategy

## Unsafe Patterns to Reject

- Rendering untrusted templates in a normal `Environment`.
- Blanket `|safe` usage to bypass escaping.
- Silent undefined behavior in critical templates where correctness matters.
- Mixing heavy business logic into templates (complex branching, data mutation intent).
- Building environment configuration implicitly across many modules.
