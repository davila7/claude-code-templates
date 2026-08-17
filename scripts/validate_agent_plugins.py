#!/usr/bin/env python3
"""
Agent Plugins (open standard) conformance linter for cli-tool/components/.

Checks the component source tree against the requirements that matter when
packaging components into Agent Plugins v1.0.0 bundles (agent-plugins.org)
and the Agent Skills spec (agentskills.io). Report-only by default: it
prints findings grouped by severity and always exits 0 unless --strict is
passed (then exits 1 if any ERROR was found).

This script never modifies files. Normalization happens at bundle-generation
time; this linter exists so the drift is visible and new components can be
born conformant.

Usage:
    python scripts/validate_agent_plugins.py [--strict] [--type TYPE] [--quiet]

Vendored schemas: schemas/agent-plugins/1.0.0/{plugin,mcp}.schema.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml  # type: ignore
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

REPO_ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_DIR = REPO_ROOT / "cli-tool" / "components"
SCHEMAS_DIR = REPO_ROOT / "schemas" / "agent-plugins" / "1.0.0"

# agentskills.io: 1-64 chars, lowercase alnum + single hyphens, no edge hyphens
SKILL_NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# agent-plugins.org plugin.json name: a-z 0-9 . - , alnum edges, no -- or ..
PLUGIN_NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$")

SKILL_STANDARD_KEYS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}

SECRET_PATTERNS = [
    re.compile(r"AIzaSy[0-9A-Za-z_-]{20,}"),
    re.compile(r"sk-[0-9A-Za-z]{20,}"),
    re.compile(r"ghp_[0-9A-Za-z]{20,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]


class Report:
    def __init__(self):
        self.errors = []    # spec violations a bundler cannot fix mechanically
        self.warnings = []  # fixed automatically at bundle time, but drift worth seeing
        self.infos = []     # structural notes (depth exceptions, strays)

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def info(self, msg):
        self.infos.append(msg)


def parse_frontmatter(text):
    """Return (frontmatter_dict_or_None, had_delimiters)."""
    if not text.startswith("---"):
        return None, False
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None, False
    raw = parts[1]
    if HAS_YAML:
        try:
            data = yaml.safe_load(raw)
            return (data if isinstance(data, dict) else None), True
        except yaml.YAMLError:
            return None, True
    # Naive fallback: top-level "key: value" lines only
    data = {}
    for line in raw.splitlines():
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if m:
            data[m.group(1)] = m.group(2).strip()
    return (data or None), True


def rel(path):
    return str(path.relative_to(REPO_ROOT))


def looks_like_secret(value):
    if not isinstance(value, str):
        return False
    # Placeholder conventions used across the catalog are fine
    if value.startswith("<") or value.startswith("${") or value.upper().startswith("YOUR_"):
        return False
    return any(p.search(value) for p in SECRET_PATTERNS)


def check_skills(report):
    skills_dir = COMPONENTS_DIR / "skills"
    count = 0
    for category in sorted(skills_dir.iterdir()):
        if not category.is_dir():
            report.info(f"skills/: stray file at category level: {rel(category)}")
            continue
        if (category / "SKILL.md").is_file():
            # No-category skill living directly under skills/ — the bundler
            # must assign it a home, but it is itself a valid skill dir.
            report.info(f"{rel(category)}: skill at category level (no category dir)")
            count += check_one_skill(report, category)
            continue
        for skill_dir in sorted(category.iterdir()):
            if not skill_dir.is_dir():
                report.info(f"skills/{category.name}/: stray file: {rel(skill_dir)}")
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.is_file():
                # Nested layouts (e.g. scientific/document-skills/docx) hold
                # skills one level deeper; the bundler flattens them.
                nested = sorted(d for d in skill_dir.iterdir() if d.is_dir() and (d / "SKILL.md").is_file())
                if nested:
                    report.info(f"{rel(skill_dir)}: nested skill group ({len(nested)} skills one level deeper; bundler must flatten)")
                    for inner in nested:
                        count += check_one_skill(report, inner)
                    continue
                case_variants = [f for f in skill_dir.iterdir() if f.name.lower() == "skill.md"]
                if case_variants:
                    report.error(f"{rel(skill_dir)}: SKILL.md has wrong case ({case_variants[0].name}) — invisible to spec discovery")
                else:
                    report.error(f"{rel(skill_dir)}: no SKILL.md — not a valid skill directory")
                continue
            count += check_one_skill(report, skill_dir)
    return count


def check_one_skill(report, skill_dir):
    skill_md = skill_dir / "SKILL.md"
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    fm, had_delims = parse_frontmatter(text)
    where = rel(skill_md)
    if fm is None:
        report.error(f"{where}: missing or unparseable YAML frontmatter")
        return 1
    name = fm.get("name")
    if not name:
        report.error(f"{where}: frontmatter missing required 'name'")
    else:
        name = str(name)
        if not SKILL_NAME_RE.match(name) or len(name) > 64:
            report.warn(f"{where}: name '{name}' violates agentskills.io format (lowercase alnum + hyphens, <=64) — bundler will rewrite")
        elif name != skill_dir.name:
            report.warn(f"{where}: name '{name}' != directory '{skill_dir.name}' — bundler will rewrite to match")
    desc = fm.get("description")
    if not desc:
        report.error(f"{where}: frontmatter missing required 'description'")
    elif len(str(desc)) > 1024:
        report.error(f"{where}: description is {len(str(desc))} chars (max 1024)")
    compat = fm.get("compatibility")
    if compat and len(str(compat)) > 500:
        report.error(f"{where}: compatibility is {len(str(compat))} chars (max 500)")
    extra = set(fm.keys()) - SKILL_STANDARD_KEYS
    if extra:
        report.warn(f"{where}: non-standard frontmatter keys {sorted(extra)} — bundler folds these into 'metadata'")
    return 1


def check_mcps(report):
    count = 0
    for mcp_file in sorted((COMPONENTS_DIR / "mcps").rglob("*.json")):
        count += 1
        where = rel(mcp_file)
        try:
            data = json.loads(mcp_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            report.error(f"{where}: invalid JSON ({e})")
            continue
        top_keys = set(data.keys())
        if "mcpServers" not in top_keys:
            report.error(f"{where}: missing top-level 'mcpServers'")
            continue
        if top_keys - {"mcpServers"}:
            report.warn(f"{where}: extra top-level keys {sorted(top_keys - {'mcpServers'})} — dropped at bundle time")
        for server_name, server in data["mcpServers"].items():
            if not isinstance(server, dict):
                report.error(f"{where}: server '{server_name}' is not an object")
                continue
            if "description" in server:
                report.warn(f"{where}: server '{server_name}' has non-standard 'description' — stripped at bundle time")
            env = server.get("env") or {}
            for env_key, env_val in env.items():
                if env_key in ("PLUGIN_ROOT", "PLUGIN_DATA"):
                    report.error(f"{where}: server '{server_name}' env defines reserved '{env_key}' (forbidden by spec)")
                if looks_like_secret(env_val):
                    report.error(f"{where}: server '{server_name}' env '{env_key}' looks like an embedded credential")
            command = server.get("command")
            url = server.get("url")
            if command:
                if re.search(r"\s", str(command)):
                    report.error(f"{where}: server '{server_name}' command '{command}' is a shell string — spec requires a single executable token")
            elif url:
                if not str(url).startswith(("https://", "http://localhost", "http://127.")):
                    report.error(f"{where}: server '{server_name}' url must be HTTPS (or loopback HTTP)")
            else:
                report.error(f"{where}: server '{server_name}' has neither 'command' (stdio) nor 'url' (http)")
        base = mcp_file.stem
        if not PLUGIN_NAME_RE.match(base) or "--" in base or ".." in base:
            report.warn(f"{where}: basename '{base}' needs normalization for plugin.json name charset (a-z0-9.-)")
    return count


def check_hooks(report):
    count = 0
    for hook_file in sorted((COMPONENTS_DIR / "hooks").rglob("*.json")):
        where = rel(hook_file)
        try:
            data = json.loads(hook_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            report.error(f"{where}: invalid JSON ({e})")
            continue
        if "hooks" not in data:
            report.info(f"{where}: no 'hooks' key — not a hook component (stray data file?)")
            continue
        count += 1
        for sf in data.get("supportingFiles", []):
            dest = sf.get("destination", "") if isinstance(sf, dict) else ""
            if dest.startswith(("~", "/")) or re.match(r"^[A-Za-z]:\\\\", dest):
                report.warn(f"{where}: supportingFiles destination '{dest}' is outside a plugin root — bundler must rewrite relative to the plugin")
    return count


def check_agents_commands_loops(report):
    counts = {}
    for comp_type, required_fm in (("agents", True), ("commands", False), ("loops", True)):
        n = 0
        for md_file in sorted((COMPONENTS_DIR / comp_type).rglob("*.md")):
            n += 1
            text = md_file.read_text(encoding="utf-8", errors="replace")
            fm, _ = parse_frontmatter(text)
            where = rel(md_file)
            if fm is None:
                if required_fm:
                    report.warn(f"{where}: missing YAML frontmatter — needs name/description before bundling")
                continue
            if comp_type == "loops":
                refs = fm.get("components") or []
                if isinstance(refs, str):
                    refs = [r.strip() for r in refs.strip("[]").split(",") if r.strip()]
                for ref in refs:
                    if ":" not in str(ref):
                        report.error(f"{where}: components ref '{ref}' is not 'type:path'")
                        continue
                    rtype, rpath = str(ref).split(":", 1)
                    plural = rtype.strip() + "s"
                    rpath = rpath.strip()
                    base = COMPONENTS_DIR / plural / rpath
                    if plural in ("agents", "commands", "loops"):
                        exists = base.with_suffix(".md").is_file()
                    elif plural in ("hooks", "settings", "mcps"):
                        exists = base.with_suffix(".json").is_file()
                    elif plural == "skills":
                        exists = (base / "SKILL.md").is_file()
                    else:
                        exists = False
                    if not exists:
                        report.error(f"{where}: components ref '{ref}' does not resolve to a real component")
        counts[comp_type] = n
    return counts


def check_schemas(report):
    for schema_name in ("plugin.schema.json", "mcp.schema.json"):
        path = SCHEMAS_DIR / schema_name
        if not path.is_file():
            report.error(f"schemas/agent-plugins/1.0.0/{schema_name}: missing vendored schema")
            continue
        try:
            schema = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            report.error(f"{rel(path)}: invalid JSON ({e})")
            continue
        expected_id = f"https://agent-plugins.org/schemas/1.0.0/{schema_name}"
        if schema.get("$id") != expected_id:
            report.error(f"{rel(path)}: $id '{schema.get('$id')}' != canonical '{expected_id}'")


def main():
    parser = argparse.ArgumentParser(description="Agent Plugins conformance linter (report-only)")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any ERROR is found")
    parser.add_argument("--type", choices=["skills", "mcps", "hooks", "agents"], help="limit to one component family")
    parser.add_argument("--quiet", action="store_true", help="print only the summary")
    args = parser.parse_args()

    if not HAS_YAML:
        print("note: PyYAML not installed — using naive frontmatter parser (pip install pyyaml for exact results)\n")

    report = Report()
    counts = {}
    check_schemas(report)
    if args.type in (None, "skills"):
        counts["skills"] = check_skills(report)
    if args.type in (None, "mcps"):
        counts["mcps"] = check_mcps(report)
    if args.type in (None, "hooks"):
        counts["hooks"] = check_hooks(report)
    if args.type in (None, "agents"):
        counts.update(check_agents_commands_loops(report))

    if not args.quiet:
        for label, items in (("ERROR", report.errors), ("WARN", report.warnings), ("INFO", report.infos)):
            for msg in items:
                print(f"[{label}] {msg}")
        if report.errors or report.warnings or report.infos:
            print()

    scanned = ", ".join(f"{k}: {v}" for k, v in counts.items())
    print(f"Scanned components — {scanned}")
    print(f"Summary: {len(report.errors)} errors, {len(report.warnings)} warnings, {len(report.infos)} notes")
    print("Errors block spec conformance; warnings are auto-fixed at bundle time; notes are structural.")

    if args.strict and report.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
