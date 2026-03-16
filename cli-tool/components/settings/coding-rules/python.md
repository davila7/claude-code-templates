---
description: Python conventions following PEP 8 and modern best practices
globs: ["**/*.py"]
---

# Python Rules

## Style
- Follow PEP 8: 4-space indentation, 88-character line limit (Black-compatible).
- Use f-strings for string interpolation. Do not use `%` formatting or `.format()`.
- Use double quotes for strings unless the string contains a double quote.

## Type Hints
- Add type hints to all function signatures (parameters and return type).
- Use `from __future__ import annotations` for forward references.
- Use `Optional[X]` or `X | None` (Python 3.10+) for nullable types. Never leave them unannotated.
- Use `TypeVar` and generics when writing reusable utilities.

## Data Modeling
- Use `dataclasses` for plain data containers. Use `pydantic` `BaseModel` when validation or serialization is needed.
- Do not use bare `dict` or `tuple` to represent structured data.

## File and Path Handling
- Use `pathlib.Path` for all file-system operations. Never use `os.path`.

## Control Flow and Collections
- Prefer list comprehensions for simple one-to-one or filter transforms.
- Use generator expressions when the result is consumed only once.
- Avoid nested comprehensions deeper than two levels.

## Logging and Debugging
- Use the `logging` module for diagnostic output. Avoid `print` for debugging. For CLI tools that produce user-facing stdout output, `print` is acceptable.
- Configure loggers at the module level: `logger = logging.getLogger(__name__)`.

## Error Handling
- Catch specific exception types. Never use a bare `except:` or `except Exception:` without re-raising or logging.
- Raise `ValueError` for invalid input, `RuntimeError` for unexpected state.
- Use context managers (`with`) for resource management.

## Imports
- Group imports: standard library, third-party, local. Separate each group with a blank line.
- Do not use wildcard imports (`from module import *`).
