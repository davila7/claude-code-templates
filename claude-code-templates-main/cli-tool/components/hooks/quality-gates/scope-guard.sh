#!/bin/bash
# scope-guard.sh — Detect files modified outside the scope of an active spec
# Source: pm-workspace (https://github.com/gonzalezpazmonica/pm-workspace)
# License: MIT
#
# Compares git-modified files against files declared in the active .spec.md.
# Warns about out-of-scope modifications but does NOT block (exit 0).
# Essential for preventing scope creep during Spec-Driven Development.

INPUT=$(cat)

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

# Get modified files (tracked unstaged + staged), handle safely
MODIFIED=$({ git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; } | sort -u)

if [ -z "$MODIFIED" ]; then
  exit 0
fi

# Find active spec: most recently modified .spec.md (within last 60 minutes)
# Sort by modification time (-t) and take the newest one
SPEC_FILE=$(find "$PROJECT_ROOT" -name "*.spec.md" -mmin -60 -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn | head -1 | cut -d' ' -f2-)

# Fallback for systems without -printf (macOS)
if [ -z "$SPEC_FILE" ]; then
  SPEC_FILE=$(find "$PROJECT_ROOT" -name "*.spec.md" -mmin -60 -type f -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null | head -1)
fi

# If no active spec, cannot verify scope
if [ -z "$SPEC_FILE" ] || [ ! -f "$SPEC_FILE" ]; then
  exit 0
fi

# Extract declared files from spec using broader regex
# Matches paths like: src/Application/Orders/Handler.cs, tests/unit/test_foo.py
DECLARED=$(sed -n '/[Ff]icheros\|[Ff]iles to [Cc]reate\|[Ff]iles to [Mm]odify/,/^## /p' "$SPEC_FILE" \
  | grep -oE '[a-zA-Z0-9_./@\-]+\.[a-zA-Z0-9]{1,8}' \
  | sort -u)

if [ -z "$DECLARED" ]; then
  exit 0
fi

# Compare: find modified files NOT in the declared list
# Use while-read to handle filenames with spaces safely
OUT_OF_SCOPE=""
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  BASENAME=$(basename "$FILE")
  MATCH=0

  while IFS= read -r DECL; do
    [ -z "$DECL" ] && continue
    # Exact path match
    if [ "$FILE" = "$DECL" ]; then
      MATCH=1
      break
    fi
    # Check if declared path is a suffix of the modified file path
    case "$FILE" in
      */"$DECL") MATCH=1; break ;;
    esac
  done <<< "$DECLARED"

  if [ "$MATCH" -eq 0 ]; then
    # Exclude files that are always legitimate outside scope
    case "$BASENAME" in
      *.spec.md|*.test.*|*Test.*|*Tests.*|*_test.*|test_*) continue ;;
      *.md|*.json|*.yml|*.yaml|*.lock) continue ;;
      .gitignore|Dockerfile|docker-compose*|*.csproj|*.sln|package.json) continue ;;
    esac
    case "$FILE" in
      */test/*|*/tests/*|*/Test/*|*/Tests/*|*/__tests__/*) continue ;;
    esac
    OUT_OF_SCOPE="${OUT_OF_SCOPE}  - ${FILE}\n"
  fi
done <<< "$MODIFIED"

if [ -n "$OUT_OF_SCOPE" ]; then
  echo "SCOPE GUARD: Files modified OUTSIDE the scope of active spec ($(basename "$SPEC_FILE")):" >&2
  printf "%b" "$OUT_OF_SCOPE" >&2
  echo "" >&2
  echo "Review if these changes are intentional or if the agent expanded the scope." >&2
  # Warning only, does not block
  exit 0
fi

exit 0
