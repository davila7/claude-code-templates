---
name: jinja2-template-best-practices
description: Generate and refactor Jinja2 templates using production best practices for security, maintainability, and readability. Use when creating or updating .j2/.jinja/.html templates, designing base/child template architectures, writing macros/includes/imports, configuring Jinja environments, or enforcing template quality rules across projects.
---

# Jinja2 Template Best Practices

## Overview

Generate robust Jinja2 templates that are safe by default, easy to maintain, and consistent across projects.
Apply a repeatable workflow for template architecture, macro design, escaping, whitespace control, and final quality checks.

## Workflow

1. Identify target output and runtime
   - Determine whether output is HTML, XML, JSON, SQL, config files, or plain text.
   - If rendering HTML/XML, configure autoescaping explicitly.

2. Design template structure before writing logic
   - Define base template, child templates, and reusable partials/macros.
   - Keep business logic in application code; keep templates focused on presentation and light formatting.

3. Implement with safety defaults
   - Use explicit escaping strategy and avoid broad `|safe` usage.
   - Treat undefined variables as errors during development (e.g., StrictUndefined).
   - Add clear guards (`is defined`, `default`) only where behavior is intentional.

4. Optimize readability and reuse
   - Extract repeated blocks into macros.
   - Use consistent naming for blocks/macros/partials.
   - Configure whitespace controls intentionally and use trim markers only where needed.

5. Review and finalize
   - Validate inheritance chains, import/include context behavior, and escaping boundaries.
   - Run through the checklist in `references/review-checklist.md` before delivery.

## Non-Negotiable Rules

- Enable and configure autoescaping explicitly for HTML/XML templates.
- Prefer `Environment(...)` with explicit loader and explicit `autoescape` policy.
- Avoid untrusted template execution in a regular environment. Use sandboxing for untrusted templates.
- Keep templates declarative: present data, do not implement heavy domain/business logic.
- Use macros/includes/imports to remove repetition; avoid copy-paste template fragments.
- Treat undefined values intentionally: fail fast in development, handle intentionally in templates.
- Use `|safe` only for trusted pre-sanitized content and document why it is safe.
- Keep one clear block hierarchy: `base` → `section/layout` → `page`.
- Keep whitespace decisions explicit (`trim_blocks`, `lstrip_blocks`, `-%}`) to avoid noisy diffs.
- Favor predictable context keys and stable naming conventions across all templates.

## Output Expectations

- Produce complete, directly usable Jinja templates (not pseudo-code).
- Include minimal comments only for non-obvious choices (escaping boundaries, unusual inheritance decisions).
- Preserve existing project conventions when editing an existing template set.
- If information is missing, choose safe defaults and document assumptions in output notes.

## Reference Files

- **Environment and security defaults**: `references/environment-and-security.md`
  - Read when setting up `Environment`, autoescaping, undefined handling, sandboxing, and performance options.
- **Template architecture and patterns**: `references/template-patterns.md`
  - Read when designing inheritance trees, macros, includes/imports, and context strategy.
- **Final verification checklist**: `references/review-checklist.md`
  - Read before delivering generated templates or refactors.

## Official Documentation

- Jinja main docs: https://jinja.palletsprojects.com/en/stable/
- Template Designer docs: https://jinja.palletsprojects.com/en/stable/templates/
- API docs: https://jinja.palletsprojects.com/en/stable/api/
- Sandbox docs: https://jinja.palletsprojects.com/en/stable/sandbox/
