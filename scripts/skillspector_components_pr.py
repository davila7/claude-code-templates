#!/usr/bin/env python3
"""SkillSpector report for the non-skill components a PR changes.

skill-security-scan.yml already gates skills. Agents, commands, hooks, MCPs,
settings, loops, sandboxes and mods were only scanned after merge, when
generate_components_json.py refreshes the catalog. This runs the same staging
and scan as the catalog (skillspector_catalog.scan) on the changed ones, so a
PR shows the result the component page will show once it is live.

Report only: it never fails the job. The catalog scan has many false
positives outside skills (pentesting agents, fake keys in mod tests), so a
gate here would block good PRs.

Usage:
    skillspector_components_pr.py --base-ref origin/main --output-md report.md
    skillspector_components_pr.py --files changed.txt --output-md report.md
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skillspector_catalog import (  # noqa: E402
    COMPONENTS_ROOT,
    SCRIPT_EXTS,
    scan,
    skillspector_version,
    source_files,
)

# Skills have their own blocking workflow (skill-security-scan.yml).
TYPES = ("agents", "commands", "mcps", "settings", "hooks", "sandbox", "loops", "mods")
COMMENT_MARKER = "<!-- skillspector-components-report:v1 -->"
MAX_COMMENT_CHARS = 60000


def changed_files(base_ref: str) -> list[str]:
    out = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=d", f"{base_ref}...HEAD", "--", str(COMPONENTS_ROOT)],
        capture_output=True, text=True, check=True,
    ).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def to_components(paths: list[str]) -> list[tuple[str, dict]]:
    """Map changed files to (type, component) pairs, one per component."""
    seen: dict[str, tuple[str, dict]] = {}
    for raw in paths:
        p = Path(raw)
        try:
            rel = p.relative_to(COMPONENTS_ROOT)
        except ValueError:
            continue
        if len(rel.parts) < 2 or rel.parts[0] not in TYPES:
            continue
        ctype = rel.parts[0]
        if ctype == "mods":
            if len(rel.parts) < 4:
                continue  # mods/README.md, mods/tsconfig.json, mods/types/...
            path = "/".join(rel.parts[1:3])
            if not (COMPONENTS_ROOT / ctype / path / ".claude-plugin" / "plugin.json").is_file():
                continue
            name = rel.parts[2]
        else:
            main = p
            if p.suffix in SCRIPT_EXTS:
                # A hook/statusline script is scanned with the JSON next to it.
                main = p.with_suffix(".json")
            if main.suffix not in (".md", ".json") or not main.is_file():
                continue
            path = "/".join(main.relative_to(COMPONENTS_ROOT / ctype).parts)
            name = main.stem
        seen.setdefault(f"{ctype}/{path}", (ctype, {"name": name, "path": path, "description": ""}))
    return [seen[k] for k in sorted(seen)]


def build_markdown(version: str, rows: list[dict]) -> str:
    lines = [COMMENT_MARKER, "## SkillSpector scan of changed components", ""]
    lines.append(
        f"Static analysis (`--no-llm`, SkillSpector {version}) of the agents, commands, hooks, MCPs, "
        "settings, loops and mods this PR changes, staged the same way as the catalog scan on aitmpl.com. "
        "Skills are reported by the SkillSpector Security Scan comment. "
        "This report is informative and does not block the PR."
    )
    lines.append("")
    if not rows:
        lines.append("No non-skill components changed.")
        return "\n".join(lines)
    lines.append("| Component | Score | Observations | Top observations |")
    lines.append("|-----------|-------|--------------|------------------|")
    for r in rows:
        if r.get("error"):
            lines.append(f"| `{r['key']}` | — | scan error | {r['error'][:120]} |")
            continue
        res = r["result"]
        top = "; ".join(
            f"{f['title'] or f['id']}" + (f" ({f['file']}:{f['line']})" if f.get("line") else f" ({f['file']})" if f.get("file") else "")
            for f in res["findings"][:3]
        ).replace("|", "\\|")
        note = " (partial analysis)" if res.get("analysis") == "partial" else ""
        lines.append(f"| `{r['key']}` | {res['score']}/100{note} | {res['issueCount']} | {top or 'none'} |")
    lines.append("")
    lines.append("_Many observations outside skills are false positives (security tooling that names the "
                 "patterns it checks, placeholder keys). Review them; they are not a verdict._")
    text = "\n".join(lines)
    if len(text) > MAX_COMMENT_CHARS:
        text = text[: MAX_COMMENT_CHARS - 100] + "\n\n_...report truncated._"
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--base-ref")
    src.add_argument("--files", help="file with one changed path per line")
    ap.add_argument("--output-md", default="skillspector-components-report.md")
    a = ap.parse_args()

    version = skillspector_version()
    if version is None:
        print("::error::skillspector is not on PATH")
        return 1
    paths = changed_files(a.base_ref) if a.base_ref else Path(a.files).read_text().splitlines()
    rows = []
    for ctype, comp in to_components(paths):
        key = f"{ctype}/{comp['path']}"
        try:
            root, files = source_files(ctype, comp)
            rows.append({"key": key, "result": scan(ctype, comp, root, files)})
        except Exception as e:  # one broken component never aborts the report
            rows.append({"key": key, "error": str(e)})
        print(f"scanned {key}")
    Path(a.output_md).write_text(build_markdown(version, rows), encoding="utf-8")
    print(f"{len(rows)} component(s) scanned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
