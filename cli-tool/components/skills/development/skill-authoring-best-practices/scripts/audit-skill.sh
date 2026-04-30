#!/usr/bin/env bash
# audit-skill.sh — Mechanical lint pass for a SKILL.md file
#
# Usage:  bash audit-skill.sh path/to/SKILL.md
#         bash audit-skill.sh path/to/skill-directory/
#
# Reports issues against the skill-authoring-best-practices checklist.
# Exit code: number of issues found (0 = clean).

set -u

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path-to-SKILL.md or skill-directory>"
  exit 1
fi

target="$1"
if [ -d "$target" ]; then
  skill_md="$target/SKILL.md"
else
  skill_md="$target"
fi

if [ ! -f "$skill_md" ]; then
  echo "ERROR: $skill_md not found"
  exit 2
fi

issues=0
warn() {
  echo "  ❌ $1"
  issues=$((issues + 1))
}
ok() {
  echo "  ✅ $1"
}
info() {
  echo "  ℹ️  $1"
}

echo "Auditing: $skill_md"
echo

# 1. Frontmatter exists
if ! head -1 "$skill_md" | grep -q '^---$'; then
  warn "Missing YAML frontmatter (no opening --- on line 1)"
fi

# 2. Extract frontmatter block
fm=$(awk '/^---$/{c++; if(c==2)exit; next} c==1' "$skill_md")
if [ -z "$fm" ]; then
  warn "Frontmatter is empty"
fi

# 3. name field
name=$(echo "$fm" | grep -E '^name:' | head -1 | sed 's/^name:[[:space:]]*//' | tr -d '"' | tr -d "'")
if [ -z "$name" ]; then
  warn "Missing 'name' field in frontmatter"
else
  if echo "$name" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
    ok "name is kebab-case: $name"
  else
    warn "name is not kebab-case: '$name'"
  fi

  # name must match directory
  dir_name=$(basename "$(dirname "$skill_md")")
  if [ "$name" != "$dir_name" ]; then
    warn "name '$name' does not match directory '$dir_name'"
  fi
fi

# 4. description field
description=$(awk '
  /^---$/{c++; if(c==2)exit; next}
  c==1 && /^description:/{
    sub(/^description:[[:space:]]*/, "")
    val = $0
    # Handle multiline | or > styles
    if (val == "|" || val == ">") {
      while ((getline line) > 0 && line !~ /^[a-zA-Z_-]+:/) {
        sub(/^[[:space:]]+/, "", line)
        val = val " " line
      }
    }
    print val
    exit
  }
' "$skill_md" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$description" ] || [ "$description" = "|" ] || [ "$description" = ">" ]; then
  warn "Description is empty or placeholder"
else
  desc_len=${#description}
  if [ "$desc_len" -gt 1024 ]; then
    warn "Description is $desc_len chars (max 1024)"
  else
    ok "Description length: $desc_len chars"
  fi

  # Check for "Use when" trigger
  if echo "$description" | grep -qi 'use when\|use this skill when\|this skill should be used'; then
    ok "Description contains trigger phrase"
  else
    warn "Description missing 'Use when ...' trigger phrase"
  fi

  # Check for first-person voice
  if echo "$description" | grep -qE '\b(I |I'\''m |my |me )\b'; then
    warn "Description appears to use first-person voice (use third person)"
  fi

  # Check for time-sensitive content
  if echo "$description" | grep -qiE 'as of [0-9]{4}|currently|latest version|right now'; then
    warn "Description contains time-sensitive content"
  fi
fi

# 5. SKILL.md line count
total_lines=$(wc -l < "$skill_md" | tr -d ' ')
if [ "$total_lines" -gt 100 ]; then
  warn "SKILL.md is $total_lines lines (recommended: under 100; consider splitting into reference files)"
else
  ok "SKILL.md line count: $total_lines"
fi

# 6. Hardcoded secrets
if grep -qE '(AIzaSy|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|gho_[a-zA-Z0-9]{20,}|-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----)' "$skill_md"; then
  warn "Possible hardcoded secret detected — review carefully"
else
  ok "No obvious secrets in SKILL.md"
fi

# 7. Absolute paths
if grep -qE '(/Users/[a-zA-Z]|/home/[a-zA-Z]|C:\\Users)' "$skill_md"; then
  warn "Absolute paths detected — use relative paths or \$CLAUDE_PROJECT_DIR"
else
  ok "No absolute paths in SKILL.md"
fi

# 8. Reference depth (look for nested references)
skill_dir=$(dirname "$skill_md")
ref_files=$(find "$skill_dir" -maxdepth 2 -name '*.md' ! -name 'SKILL.md' 2>/dev/null)
nested=0
for rf in $ref_files; do
  link_count=$(grep -cE '\[.+\]\([^)]+\.md\)' "$rf" 2>/dev/null)
  link_count=${link_count:-0}
  if [ "$link_count" -gt 3 ] 2>/dev/null; then
    info "Reference file may chain too deep: $rf ($link_count .md links)"
    nested=$((nested + 1))
  fi
done

# 9. Check for at least one example
if grep -qiE '^#+ .*example|^#+ .*quick start' "$skill_md"; then
  ok "Has Examples or Quick Start section"
else
  warn "No 'Example' or 'Quick start' heading found"
fi

# Summary
echo
if [ "$issues" -eq 0 ]; then
  echo "✅ All checks passed"
  exit 0
else
  echo "❌ $issues issue(s) found"
  exit 1
fi
