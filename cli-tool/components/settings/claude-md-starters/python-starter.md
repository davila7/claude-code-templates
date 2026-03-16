# CLAUDE.md Starter: Python Project

Copy this into your project root as `CLAUDE.md` and customize the placeholders.

---

```markdown
# CLAUDE.md

## Project Overview

- **Name**: <project-name>
- **Description**: <one-line description>
- **Python version**: 3.12
- **Package manager**: uv (use `uv run` to execute commands)

## Quick Commands

```bash
# Install dependencies
uv sync

# Run the application
uv run python -m <package_name>

# Run tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=<package_name> --cov-report=term-missing

# Lint and format
uv run ruff check .
uv run ruff format .

# Type checking
uv run mypy <package_name>
```

## Project Structure

```text
<project-name>/
├── src/<package_name>/    # Main package
│   ├── __init__.py
│   ├── main.py
│   └── ...
├── tests/                 # Test files mirror src/ structure
│   ├── conftest.py
│   └── test_*.py
├── pyproject.toml         # Project config (dependencies, tools)
└── CLAUDE.md
```

## Code Style

- Use type hints on all function signatures
- Use `from __future__ import annotations` at the top of every module
- Prefer `pathlib.Path` over `os.path`
- Use f-strings for string formatting
- Maximum line length: 88 characters (ruff/black default)
- Use snake_case for functions and variables, PascalCase for classes
- Imports: stdlib first, then third-party, then local (ruff handles this)

## Testing

- Use pytest (not unittest)
- Name test files `test_<module>.py`, test functions `test_<behavior>()`
- Use fixtures in `conftest.py` for shared setup
- Use `pytest.mark.parametrize` for data-driven tests
- Mock external dependencies with `unittest.mock.patch` or `pytest-mock`
- Always run `uv run pytest` before committing

## Error Handling

- Use specific exception types, never bare `except:`
- Define custom exceptions in `<package_name>/exceptions.py`
- Log errors with `logging` module, not `print()`

## Dependencies

- Add dependencies with `uv add <package>`
- Add dev dependencies with `uv add --dev <package>`
- Never edit `uv.lock` manually

## Conventions

- <Add project-specific conventions here>
- <Add naming patterns, API design rules, etc.>
```

---

## Variants

### pip + venv (instead of uv)

Replace the Quick Commands section:

```markdown
## Quick Commands

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
pip install -e ".[dev]"
pytest
ruff check . && ruff format .
mypy <package_name>
```
```

### Poetry

Replace the Quick Commands section:

```markdown
## Quick Commands

```bash
poetry install
poetry run pytest
poetry run ruff check . && poetry run ruff format .
poetry run mypy <package_name>
```
```

### Django

Add these sections:

```markdown
## Django Commands

```bash
uv run python manage.py runserver
uv run python manage.py makemigrations
uv run python manage.py migrate
uv run python manage.py test
uv run python manage.py shell
```

## Django Conventions

- Apps go in `apps/` directory
- Use class-based views for CRUD, function views for simple endpoints
- Always create and apply migrations, never modify the database directly
- Use `django.conf.settings` for configuration, not hardcoded values
- Templates go in `<app>/templates/<app>/`
```

### FastAPI

Add these sections:

```markdown
## API Conventions

- Use Pydantic models for request/response schemas in `schemas/`
- Use dependency injection for shared logic (auth, db sessions)
- Group routes by domain in separate routers under `routers/`
- Use `HTTPException` with appropriate status codes
- All endpoints must have docstrings (used for OpenAPI docs)
```
