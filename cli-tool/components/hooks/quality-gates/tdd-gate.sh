#!/bin/bash
# tdd-gate.sh — Enforce Test-Driven Development: tests must exist before production code
# Source: pm-workspace (https://github.com/gonzalezpazmonica/pm-workspace)
# License: MIT
#
# Blocks editing production code if no corresponding test file exists.
# Forces developers and AI agents to write tests FIRST, then implement.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=""

# Only applies to Edit and Write tools
if [ "$TOOL" = "Edit" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
elif [ "$TOOL" = "Write" ]; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  exit 0
fi

[ -z "$FILE_PATH" ] && exit 0

# Get file extension
EXT="${FILE_PATH##*.}"

# Only check production code extensions
case "$EXT" in
  cs|py|ts|tsx|js|jsx|go|rs|rb|php|java|kt|swift|dart) ;;
  *) exit 0 ;;
esac

# Skip files that don't need TDD gate
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  *Test*|*test*|*Spec*|*spec*|*_test.*|*.test.*|*.spec.*) exit 0 ;;
  *Migration*|*migration*|*.dto.*|*DTO*|*.config.*|*Config.*) exit 0 ;;
  *Program.cs|*Startup.cs|*appsettings*|*.csproj|*.sln) exit 0 ;;
  *.d.ts|*.config.ts|*.config.js|tsconfig*|package.json) exit 0 ;;
  Dockerfile|docker-compose*|*.tf|*.tfvars|*.yml|*.yaml) exit 0 ;;
  *.md|*.txt|*.json|*.xml|*.html|*.css|*.scss) exit 0 ;;
esac

# Skip paths that are not production code
case "$FILE_PATH" in
  */test/*|*/tests/*|*/Test/*|*/Tests/*|*/__tests__/*) exit 0 ;;
  */spec/*|*/specs/*|*/Spec/*|*/Specs/*) exit 0 ;;
  */fixtures/*|*/mocks/*|*/stubs/*|*/fakes/*) exit 0 ;;
  */migrations/*|*/Migrations/*|*/seeds/*) exit 0 ;;
  */config/*|*/Config/*|*/scripts/*) exit 0 ;;
esac

# Search for corresponding test file
NAME_NO_EXT="${BASENAME%.*}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

TESTS_FOUND=$(find "$PROJECT_ROOT" -type f \( \
  -name "${NAME_NO_EXT}Test.*" -o \
  -name "${NAME_NO_EXT}Tests.*" -o \
  -name "${NAME_NO_EXT}.test.*" -o \
  -name "${NAME_NO_EXT}.spec.*" -o \
  -name "${NAME_NO_EXT}_test.*" -o \
  -name "test_${NAME_NO_EXT}.*" \
  \) 2>/dev/null | head -1)

if [ -z "$TESTS_FOUND" ]; then
  echo "TDD GATE: No tests found for '$BASENAME'. Write tests BEFORE implementing production code. Create: ${NAME_NO_EXT}Test.${EXT} or ${NAME_NO_EXT}.test.${EXT}" >&2
  exit 2
fi

exit 0
