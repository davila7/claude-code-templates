#!/usr/bin/env python3
"""
validate-components.py — Pre-commit validator for cli-tool/components/ files.

Checks (errors block commit, warnings are informational):
  C1 - YAML frontmatter required fields
  C2 - allowed-tools coverage for commands (all bash commands used in body declared)
  C3 - No dot-notation slash command references (/cmd.name instead of /cmd-name)
  C4 - No hardcoded absolute paths
  C5 - No nested triple-backtick fences (use 5-backticks for outer fence)
  C6 - [WARN] Cross-references resolve to real component files

Usage:
  python3 scripts/validate-components.py            # validates staged files only
  python3 scripts/validate-components.py --all      # validates all component files
"""

import re
import sys
import subprocess
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

REPO_ROOT = Path(
    subprocess.check_output(["git", "rev-parse", "--show-toplevel"],
                            stderr=subprocess.DEVNULL)
    .decode().strip()
)
COMPONENTS_ROOT = REPO_ROOT / "cli-tool" / "components"

# Required frontmatter fields by component type
REQUIRED_FIELDS = {
    "commands": ["description", "allowed-tools", "argument-hint"],
    "agents":   ["name", "description", "tools", "model"],
    "skills":   ["name", "description"],
    "mcps":     ["description"],
    "hooks":    [],   # JSON files — skipped by this validator
    "settings": [],
}

# Bash commands that appear in allowed-tools as non-Bash entries (skip them)
NON_BASH_TOOLS = {
    "Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep",
    "WebSearch", "WebFetch", "Task", "TodoWrite", "NotebookEdit",
}

# Path patterns that indicate absolute/hardcoded paths (errors)
ABSOLUTE_PATH_PATTERNS = [
    (r"C:\\Users\\[A-Za-z]",     "Windows absolute path (C:\\Users\\...)"),
    (r"C:/Users/[A-Za-z]",       "Windows absolute path (C:/Users/...)"),
    (r"/Users/[A-Z][a-z]",       "macOS absolute path (/Users/Username)"),
    (r"/home/[a-z][a-z0-9_-]+/", "Linux absolute path (/home/username/)"),
]

# Patterns to skip for absolute path check (examples/placeholders)
ABSOLUTE_PATH_SKIP = re.compile(
    r"(example|placeholder|your-username|YOUR_|<username>|/home/user/|#)",
    re.IGNORECASE
)

# URL path fragments to skip for cross-reference check
CROSS_REF_SKIP_PREFIXES = (
    "/api/", "/dev/", "/etc/", "/tmp/", "/var/", "/usr/",
    "/home/", "/Users/", "/proc/", "/sys/",
)

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

Issue = tuple  # (path: Path, lineno: int, check_id: str, message: str)


def get_staged_component_files() -> list[Path]:
    """Return staged .md files under cli-tool/components/."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            capture_output=True, text=True, check=True
        )
        files = []
        for line in result.stdout.strip().splitlines():
            p = REPO_ROOT / line.strip()
            if (line.startswith("cli-tool/components/")
                    and line.endswith(".md")
                    and p.exists()):
                files.append(p)
        return files
    except subprocess.CalledProcessError:
        return []


def get_all_component_files() -> list[Path]:
    """Return all .md files under cli-tool/components/."""
    return list(COMPONENTS_ROOT.rglob("*.md"))


def get_component_type(path: Path) -> str:
    """Infer component type from directory structure."""
    parts = path.relative_to(COMPONENTS_ROOT).parts
    return parts[0] if parts else "unknown"


def is_primary_component(path: Path) -> bool:
    """
    Return True only for primary component files (not support/reference files).

    Primary components:
      commands/{category}/{name}.md          (depth 2 from root)
      agents/{category}/{name}.md            (depth 2 from root)
      mcps/{category}/{name}.md              (depth 2 from root)
      skills/{category}/{skillname}/SKILL.md (depth 3, filename must be SKILL.md)
      hooks/{category}/{name}.md|.json       (depth 2 from root)
      settings/{category}/{name}.json        (depth 2 from root)

    Non-primary (skipped):
      Any file inside a references/, contracts/, examples/, docs/ subdirectory
      Skill support files that are not named SKILL.md
    """
    try:
        parts = path.relative_to(COMPONENTS_ROOT).parts
    except ValueError:
        return False

    if len(parts) < 2:
        return False

    component_type = parts[0]

    # Skip files in known support subdirectories at any depth
    support_dirs = {"references", "contracts", "examples", "docs", "assets", "templates"}
    if any(p in support_dirs for p in parts[1:]):
        return False

    if component_type == "skills":
        # Skills: only SKILL.md at depth 3 (type/category/skillname/SKILL.md)
        return len(parts) == 4 and path.name == "SKILL.md"

    # All other types: only direct children of category directories (depth 2)
    return len(parts) == 3


def parse_frontmatter(content: str) -> tuple[dict, str, str | None]:
    """
    Parse YAML frontmatter from file content.
    Returns (frontmatter_dict, body_str, error_str).
    """
    if not content.startswith("---"):
        return {}, content, "No YAML frontmatter found (file must start with ---)"

    end = content.find("\n---", 3)
    if end == -1:
        return {}, content, "Unclosed YAML frontmatter (no closing ---)"

    fm_raw = content[3:end].strip()
    body = content[end + 4:].lstrip("\n")

    if not HAS_YAML:
        # Minimal parser: key: value lines only
        fm = {}
        for line in fm_raw.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                fm[k.strip()] = v.strip()
        return fm, body, None

    try:
        fm = yaml.safe_load(fm_raw) or {}
        return fm, body, None
    except yaml.YAMLError as e:
        return {}, body, f"Invalid YAML frontmatter: {e}"


def extract_bash_commands_from_body(body: str) -> list[tuple[int, str]]:
    """
    Extract bash commands actually invoked in ```bash code blocks.
    Returns list of (line_number_in_body, command_name).
    Line numbers are approximate (relative to body start).
    """
    commands = []
    in_bash_block = False
    fence_start_line = 0

    for lineno, line in enumerate(body.splitlines(), 1):
        stripped = line.strip()
        if not in_bash_block:
            if re.match(r"^```\s*bash\s*$", stripped, re.IGNORECASE):
                in_bash_block = True
                fence_start_line = lineno
        else:
            if stripped == "```":
                in_bash_block = False
            elif stripped and not stripped.startswith("#"):
                # Extract first token (the command)
                token = re.split(r"[\s|&;<>()]", stripped)[0]
                token = token.lstrip("$").strip()
                if token and re.match(r"^[a-zA-Z][a-zA-Z0-9_-]*$", token):
                    commands.append((lineno, token))

    return commands


def get_declared_bash_tools(allowed_tools_str: str) -> set[str]:
    """
    Parse allowed-tools frontmatter value and return set of declared bash command names.
    e.g. "Bash(git:*), Bash(mkdir:*), Read, Write" -> {"git", "mkdir"}
    """
    declared = set()
    for entry in allowed_tools_str.split(","):
        entry = entry.strip()
        m = re.match(r"Bash\(([^:)]+)[):*]", entry)
        if m:
            declared.add(m.group(1).strip())
        elif entry in NON_BASH_TOOLS:
            continue
        elif re.match(r"^Bash$", entry):
            # Bare "Bash" = all commands allowed
            declared.add("*")
    return declared


def build_all_command_names() -> set[str]:
    """Return set of all command file stems (e.g. 'sdd-specify', 'project-health')."""
    commands_dir = COMPONENTS_ROOT / "commands"
    if not commands_dir.exists():
        return set()
    return {p.stem for p in commands_dir.rglob("*.md")}


# ---------------------------------------------------------------------------
# CHECKS
# ---------------------------------------------------------------------------

def check_c1_frontmatter(path: Path, fm: dict, fm_error: str | None,
                          component_type: str) -> list[Issue]:
    """C1: Required frontmatter fields."""
    issues = []
    if fm_error:
        issues.append((path, 1, "C1", fm_error))
        return issues

    required = REQUIRED_FIELDS.get(component_type, [])
    for field in required:
        if field not in fm or not fm[field]:
            issues.append((path, 1, "C1",
                           f"Missing required frontmatter field: '{field}'"))
    return issues


def check_c2_allowed_tools(path: Path, fm: dict, body: str) -> list[Issue]:
    """C2: All bash commands in body must be declared in allowed-tools."""
    issues = []
    allowed_str = fm.get("allowed-tools", "")
    if not allowed_str:
        return issues  # C1 already catches missing allowed-tools

    declared = get_declared_bash_tools(str(allowed_str))
    if "*" in declared:
        return []  # bare Bash = all allowed

    # Shell built-ins and common posix utilities that don't need Bash(x:*) entries
    builtins = {
        "set", "export", "echo", "printf", "source", ".", "if", "then",
        "else", "fi", "for", "while", "do", "done", "case", "esac",
        "read", "local", "return", "exit", "true", "false", "test", "[",
        "[[", "cat", "cd", "pwd", ":", "eval",
    }

    used_commands = extract_bash_commands_from_body(body)
    for lineno, cmd in used_commands:
        if cmd in builtins:
            continue
        if cmd in declared:
            continue
        issues.append((path, lineno, "C2",
                       f"Bash command '{cmd}' used in body but not in allowed-tools\n"
                       f"     Add to frontmatter: Bash({cmd}:*)"))
    return issues


def check_c3_dot_notation(path: Path, content: str) -> list[Issue]:
    """C3: No /command.subcommand dot-notation slash references.

    Only flags patterns that look like slash commands:
    - /word.word (no file extension like .js, .ts, .md, .txt, .py, etc.)
    - Not preceded by http/https or a domain character
    - Both segments are purely alphabetic with hyphens (no dots-in-names)
    """
    # Common file extensions to exclude
    FILE_EXTENSIONS = re.compile(
        r"\.(js|ts|jsx|tsx|md|txt|py|sh|json|yaml|yml|html|css|scss|"
        r"vue|svelte|go|rs|rb|java|php|cs|cpp|c|h|sql|env|toml|xml|"
        r"lock|log|png|jpg|gif|svg|ico|woff|ttf|pdf|zip|tar|gz|liquid|"
        r"graphql|gql|prisma|proto|tf|tfvars|myshopify|proxy)$",
        re.IGNORECASE
    )

    issues = []
    for lineno, line in enumerate(content.splitlines(), 1):
        # Skip lines that are clearly URLs or domain references
        if re.search(r"https?://", line):
            continue

        for m in re.finditer(r"(?<![.\w])/([a-z][a-z0-9-]+)\.([a-z][a-z0-9-]+)(?![./\w])", line):
            segment1 = m.group(1)
            segment2 = m.group(2)
            full_ext = f".{segment2}"

            # Skip if segment2 looks like a file extension
            if FILE_EXTENSIONS.match(full_ext):
                continue

            # Skip if either segment contains numbers (likely a version or domain)
            if re.search(r"\d", segment2):
                continue

            issues.append((path, lineno, "C3",
                           f"Dot-notation slash reference: /{segment1}.{segment2}\n"
                           f"     Use hyphen notation: /{segment1}-{segment2}"))
    return issues


def check_c4_absolute_paths(path: Path, content: str) -> list[Issue]:
    """C4: No hardcoded absolute/user-specific paths."""
    issues = []
    for lineno, line in enumerate(content.splitlines(), 1):
        if ABSOLUTE_PATH_SKIP.search(line):
            continue
        for pattern, description in ABSOLUTE_PATH_PATTERNS:
            if re.search(pattern, line):
                issues.append((path, lineno, "C4",
                               f"Hardcoded absolute path ({description})\n"
                               f"     Use relative paths or $VARIABLE references"))
                break  # one issue per line
    return issues


def check_c5_nested_backticks(path: Path, content: str) -> list[Issue]:
    """C5: No triple-backtick blocks nested inside triple-backtick blocks."""
    issues = []
    depth = 0
    open_fence_line = 0

    for lineno, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()

        # 5+ backtick lines are outer wrappers — skip (they're the correct fix)
        if re.match(r"^`{5,}", stripped):
            continue

        is_fence = re.match(r"^```", stripped)
        if not is_fence:
            continue

        is_closing = re.match(r"^```\s*$", stripped)

        if depth == 0:
            if not is_closing:
                depth = 1
                open_fence_line = lineno
        elif depth == 1:
            if is_closing:
                depth = 0
            else:
                # Opening another fence while already inside one
                issues.append((path, lineno, "C5",
                               f"Nested triple-backtick fence (opens inside block at line {open_fence_line})\n"
                               f"     Use 5-backticks (`````) for the outer fence"))
                # Don't increment depth further — report each nested open
    return issues


def check_c6_cross_references(path: Path, body: str,
                               all_command_names: set[str]) -> list[Issue]:
    """C6 [WARN]: Slash command cross-references should resolve to real files."""
    warnings = []
    seen = set()

    for lineno, line in enumerate(body.splitlines(), 1):
        for m in re.finditer(r"/([a-z][a-z0-9-]{2,})", line):
            ref = m.group(1)
            full = f"/{ref}"

            if full in seen:
                continue
            seen.add(full)

            # Skip known non-command path prefixes
            if any(full.startswith(p) for p in CROSS_REF_SKIP_PREFIXES):
                continue

            # Skip URL-like patterns (contain dots after the slash)
            if "." in ref:
                continue

            # Only warn if it looks like a command (has a hyphen = likely a slash command)
            if "-" not in ref:
                continue

            # Check if the referenced command exists
            if ref not in all_command_names:
                warnings.append((path, lineno, "C6-WARN",
                                 f"Slash command reference /{ref} not found in cli-tool/components/commands/\n"
                                 f"     Verify the command exists or update the reference"))

    return warnings


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def format_issue(issue: Issue) -> str:
    path, lineno, check_id, message = issue
    rel = path.relative_to(REPO_ROOT)
    return f"[{check_id}] {rel}:{lineno}\n     {message}"


def main():
    all_mode = "--all" in sys.argv

    if all_mode:
        files = get_all_component_files()
        print(f"Scanning all {len(files)} component files...")
    else:
        files = get_staged_component_files()
        if not files:
            sys.exit(0)  # Nothing to validate

    all_command_names = build_all_command_names()
    errors: list[Issue] = []
    warnings: list[Issue] = []

    for path in files:
        # Skip non-primary component files (reference docs, support files, etc.)
        if not is_primary_component(path):
            continue

        component_type = get_component_type(path)

        # Skip non-markdown-frontmatter files
        if component_type in ("hooks", "settings") and path.suffix != ".md":
            continue

        try:
            content = path.read_text(encoding="utf-8")
        except OSError as e:
            errors.append((path, 0, "IO", f"Cannot read file: {e}"))
            continue

        fm, body, fm_error = parse_frontmatter(content)

        errors  += check_c1_frontmatter(path, fm, fm_error, component_type)
        if component_type == "commands":
            errors += check_c2_allowed_tools(path, fm, body)
        errors   += check_c3_dot_notation(path, content)
        errors   += check_c4_absolute_paths(path, content)
        errors   += check_c5_nested_backticks(path, content)
        warnings += check_c6_cross_references(path, body, all_command_names)

    # ---------------------------------------------------------------------------
    # REPORT
    # ---------------------------------------------------------------------------

    if not errors and not warnings:
        if all_mode:
            print("All component files passed validation.")
        sys.exit(0)

    separator = "=" * 65

    if errors:
        print(f"\nCOMPONENT VALIDATOR: {len(errors)} error(s) found\n{separator}")
        for issue in errors:
            print(format_issue(issue))
        print()

    if warnings:
        print(f"WARNINGS ({len(warnings)}) — non-blocking:\n{separator}")
        for issue in warnings:
            print(format_issue(issue))
        print()

    if errors:
        print("COMMIT BLOCKED: Fix errors above before committing.")
        print("Emergency bypass (if absolutely necessary): git commit --no-verify")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
