# Python Linter

Run Python code linting and formatting tools.

## Purpose

This command helps you maintain code quality using Python's best linting and formatting tools.

## Usage

```
/lint
```

## What this command does

1. **Runs multiple linters** (flake8, pylint, black, isort)
2. **Provides detailed feedback** on code quality issues
3. **Auto-fixes formatting** where possible
4. **Checks type hints** if mypy is configured

## Example Commands

### Black (code formatting)
```bash
# Format all Python files
black .

# Check formatting without changing files
black --check .

# Format specific file
black src/main.py
```

### flake8 (style guide enforcement)
```bash
# Check all Python files
flake8 .

# Check specific directory
flake8 src/

# Check with specific rules
flake8 --max-line-length=88 .
```

### isort (import sorting)
```bash
# Sort imports in all files
isort .

# Check import sorting
isort --check-only .

# Sort imports in specific file
isort src/main.py
```

### pylint (comprehensive linting)
```bash
# Run pylint on all files
pylint src/

# Run with specific score threshold
pylint --fail-under=8.0 src/

# Generate detailed report
pylint --output-format=html src/ > pylint_report.html
```

### mypy (type checking)
```bash
# Check types in all files
mypy .

# Check specific module
mypy src/models.py

# Check with strict mode
mypy --strict src/
```

## Configuration Files

Most projects benefit from configuration files:

### .flake8
```ini
[flake8]
max-line-length = 88
exclude = .git,__pycache__,venv
ignore = E203,W503
```

### pyproject.toml
```toml
[tool.black]
line-length = 88

[tool.isort]
profile = "black"
```

## Best Practices

- Run linters before committing code
- Use consistent formatting across the project
- Fix linting issues promptly
- Configure linters to match your team's style
- Use type hints for better code documentation