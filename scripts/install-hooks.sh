#!/usr/bin/env bash
# install-hooks.sh — Install git hooks for claude-code-templates
# Run once after cloning: bash scripts/install-hooks.sh

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_FILE="$HOOKS_DIR/pre-commit"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "ERROR: Not inside a git repository (.git/hooks not found)"
  exit 1
fi

cat > "$HOOK_FILE" << 'HOOK_BODY'
#!/usr/bin/env bash
# Pre-commit hook — validates cli-tool/components/ files before every commit
set -euo pipefail

CHANGED=$(git diff --cached --name-only --diff-filter=ACM | grep '^cli-tool/components/' || true)
if [ -z "$CHANGED" ]; then
  exit 0
fi

python3 "$(git rev-parse --show-toplevel)/scripts/validate-components.py"
HOOK_BODY

chmod +x "$HOOK_FILE"

echo "Pre-commit hook installed at $HOOK_FILE"
echo ""
echo "Validate all components anytime:"
echo "  python3 scripts/validate-components.py --all"
