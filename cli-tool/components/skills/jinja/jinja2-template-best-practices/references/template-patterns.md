# Jinja Template Patterns and Architecture

## Table of Contents
- [Template Layout Strategy](#template-layout-strategy)
- [Inheritance Rules](#inheritance-rules)
- [Macros and Imports](#macros-and-imports)
- [Includes and Context](#includes-and-context)
- [Whitespace and Output Stability](#whitespace-and-output-stability)
- [Practical Pattern Examples](#practical-pattern-examples)

## Template Layout Strategy

Use a predictable structure:

```text
templates/
  base/
    base.html
  components/
    forms.html
    table.html
  pages/
    home.html
    account.html
```

Guidelines:
- Keep one global base layout (`base/base.html`).
- Keep reusable template helpers in dedicated component files.
- Keep page templates thin and focused on page-level blocks.

## Inheritance Rules

- Put `{% extends "..." %}` as the first meaningful tag in child templates.
- Define stable, semantic block names (`title`, `head`, `content`, `footer`).
- Use `{{ super() }}` when extending parent block behavior.
- Do not declare duplicate block names within the same template.

Preferred skeleton:

```jinja
{# templates/base/base.html #}
<!doctype html>
<html>
  <head>
    <title>{% block title %}{% endblock %}</title>
    {% block head %}{% endblock %}
  </head>
  <body>
    {% block content %}{% endblock %}
  </body>
</html>
```

```jinja
{# templates/pages/home.html #}
{% extends "base/base.html" %}
{% block title %}Home{% endblock %}
{% block content %}
  <h1>{{ heading }}</h1>
{% endblock %}
```

## Macros and Imports

Use macros for repeated presentation structures.

```jinja
{# templates/components/forms.html #}
{% macro input(name, value='', type='text') -%}
  <input type="{{ type }}" name="{{ name }}" value="{{ value|e }}">
{%- endmacro %}
```

```jinja
{% import "components/forms.html" as forms %}
{{ forms.input("email", user.email) }}
```

Guidelines:
- Name macro files by domain (`forms`, `cards`, `tables`).
- Keep macros small and composable.
- Prefix private helper macros with `_` when they should not be imported.

## Includes and Context

- Use `include` for small composition pieces.
- Use `without context` when isolation is required.
- Use `ignore missing` only for intentionally optional templates.

Examples:

```jinja
{% include "components/alerts.html" %}
{% include "components/tenant-banner.html" ignore missing %}
{% include "components/private-fragment.html" without context %}
```

## Whitespace and Output Stability

- Configure `trim_blocks` and `lstrip_blocks` at environment level for stable output.
- Use `-%}` trimming surgically around loops and control blocks.
- Avoid excessive trim markers that reduce readability.

Example for compact output:

```jinja
{%- for item in items -%}
{{ item }}
{%- endfor -%}
```

## Practical Pattern Examples

- Navigation highlighting: set `active_page` in child template and read it in base nav.
- Loop fallback rendering: prefer `{% else %}` inside loops for empty states.
- Context contracts: document required context keys per page template.
