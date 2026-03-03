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

# Get modified files (tracked unstaged + staged)
MODIFIED=$(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)
MODIFIED=$(echo "$MODIFIED" | sort -u | grep -v '^$')

if [ -z "$MODIFIED" ]; then
  exit 0
fi

# Find active spec: most recently modified .spec.md (within last 60 minutes)
SPEC_FILE=$(find "$PROJECT_ROOT" -name "*.spec.md" -mmin -60 2>/dev/null | sort -t/ -k1,1 | tail -1)

# If no active spec, cannot verify scope
if [ -z "$SPEC_FILE" ] || [ ! -f "$SPEC_FILE" ]; then
  exit 0
fi

# Extract declared files from spec
# Looks for "Files to Create/Modify" section and extracts file paths
DECLARED=$(sed -n '/[Ff]icheros\|[Ff]iles to [Cc]reate/,/^## /p' "$SPEC_FILE" \
  | grep -oE '[a-zA-Z0-9_./\-]+\.[a-z]{1,5}' \
  | sort -u)

if [ -z "$DECLARED" ]; then
  exit 0
fi

# Compare: find modified files NOT in the declared list
OUT_OF_SCOPE=""
for FILE in $MODIFIED; do
  BASENAME=$(basename "$FILE")
  MATCH=0
  for DECL in $DECLARED; do
    DECL_BASE=$(basename "$DECL")
    if [ "$FILE" = "$DECL" ] || [ "$BASENAME" = "$DECL_BASE" ]; then
      MATCH=1
      break
    fi
    if echo "$FILE" | grep -qF "$DECL"; then
      MATCH=1
      break
    fi
  done
  if [ "$MATCH" -eq 0 ]; then
    # Exclude files that are always legitimate outside scope
    case "$BASENAME" in
      *.spec.md|*.test.*|*Test*|*test*|*.md|*.json|*.yml|*.yaml) continue ;;
      .gitignore|Dockerfile|docker-compose*|*.csproj|*.sln|package.json) continue ;;
    esac
    case "$FILE" in
      */test/*|*/tests/*|*/Test/*|*/Tests/*|*/__tests__/*) continue ;;
    esac
    OUT_OF_SCOPE="$OUT_OF_SCOPE\n  - $FILE"
  fi
done

if [ -n "$OUT_OF_SCOPE" ]; then
  echo "SCOPE GUARD: Files modified OUTSIDE the scope of active spec ($SPEC_FILE):" >&2
  echo -e "$OUT_OF_SCOPE" >&2
  echo "" >&2
  echo "Review if these changes are intentional or if the agent expanded the scope." >&2
  # Warning only, does not block
  exit 0
fi

exit 0
