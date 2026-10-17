#!/usr/bin/env python3
"""SkillSpector risk signal for every component in the catalog.

generate_components_json.py calls attach_skillspector() after it has built the
catalog. Each component gets a `skillspector` object (score, severity,
recommendation and the top findings) that the dashboard shows as a traffic
light on the card and on the component page.

SkillSpector (NVIDIA, Apache-2.0) scans a skill directory and requires a
SKILL.md. Skills and mods are scanned as directories; single-file components
(agents, commands, loops, hooks, MCPs, settings, sandboxes) are copied into a
temporary directory with a SKILL.md, plus a hook or statusline's sibling
script, so the same static rules apply to them.

Scanning is ~6 s per component, so results are cached in the previous
docs/components.json: a component whose files hash the same, under the same
SkillSpector version, keeps its earlier result. Only new or changed
components are rescanned. Without the `skillspector` CLI on PATH nothing is
scanned and every component keeps its previous result (or none).

The signal is display-only: it never changes ordering, search or ranking.

Standalone use (scans and prints, writes nothing):
    skillspector_catalog.py cli-tool/components/agents/security/x.md ...
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

COMPONENTS_ROOT = Path("cli-tool/components")

# Findings kept per component. The full report stays in CI; the catalog only
# needs enough for the hover detail.
MAX_FINDINGS = 5

# Sibling script extensions that ship with a hook or statusline JSON.
SCRIPT_EXTS = (".py", ".sh", ".js", ".mjs", ".ts", ".ps1")

SKIP_PARTS = {"node_modules", ".git", "__pycache__"}

SCANNED_TYPES = ("agents", "commands", "mcps", "settings", "hooks", "sandbox", "skills", "loops", "mods")


def skillspector_version() -> str | None:
    if not shutil.which("skillspector"):
        return None
    try:
        out = subprocess.run(
            ["skillspector", "--version"], capture_output=True, text=True, check=False
        ).stdout
    except OSError:
        return None
    # "SkillSpector v2.12.0"
    return out.strip().split()[-1].lstrip("v") if out.strip() else None


def source_files(component_type: str, component: dict) -> tuple[Path, list[Path]]:
    """Return (base dir, files) that make up a component on disk."""
    base = COMPONENTS_ROOT / component_type
    if component_type in ("skills", "mods"):
        root = base / component["path"]
        files = sorted(
            p
            for p in root.rglob("*")
            if p.is_file() and not SKIP_PARTS.intersection(p.relative_to(root).parts)
        )
        return root, files
    main = base / component["path"]
    files = [main]
    if main.suffix == ".json":
        for ext in SCRIPT_EXTS:
            sibling = main.with_suffix(ext)
            if sibling.is_file():
                files.append(sibling)
    return main.parent, files


def content_hash(root: Path, files: list[Path]) -> str:
    h = hashlib.sha256()
    for f in files:
        h.update(str(f.relative_to(root)).encode())
        h.update(b"\0")
        h.update(f.read_bytes())
        h.update(b"\0")
    return h.hexdigest()[:16]


def _stub_skill_md(component: dict) -> str:
    desc = " ".join(str(component.get("description") or component["name"]).split())
    return f"---\nname: {component['name']}\ndescription: {json.dumps(desc, ensure_ascii=False)}\n---\n"


def stage(component_type: str, component: dict, root: Path, files: list[Path], tmp: Path) -> Path:
    """Lay the component out as a skill directory SkillSpector accepts."""
    if component_type == "skills":
        return root
    target = tmp / component["name"]
    target.mkdir(parents=True)
    if component_type == "mods":
        for f in files:
            dest = target / f.relative_to(root)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(f, dest)
        # Stub only: the README is scanned as its own file, copying it into
        # SKILL.md would count every finding in it twice.
        (target / "SKILL.md").write_text(_stub_skill_md(component), encoding="utf-8")
        return target
    main = files[0]
    if main.suffix == ".md":
        text = main.read_text(encoding="utf-8")
        if not text.startswith("---"):
            text = _stub_skill_md(component) + "\n" + text
        (target / "SKILL.md").write_text(text, encoding="utf-8")
    else:
        (target / "SKILL.md").write_text(_stub_skill_md(component), encoding="utf-8")
        for f in files:
            shutil.copyfile(f, target / f.name)
    return target


def _finding(issue: dict, staged_main: str | None) -> dict:
    loc = issue.get("location") or {}
    file = loc.get("file") or ""
    if staged_main and file == "SKILL.md":
        file = staged_main
    return {
        "id": issue.get("id") or "",
        "category": issue.get("category") or "",
        "severity": (issue.get("severity") or "LOW").upper(),
        "title": issue.get("pattern") or issue.get("explanation") or "",
        "file": file,
        "line": loc.get("start_line"),
    }


SEVERITY_RANK = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def scan(component_type: str, component: dict, root: Path, files: list[Path]) -> dict:
    with tempfile.TemporaryDirectory(prefix="skillspector-") as tmp:
        target = stage(component_type, component, root, files, Path(tmp))
        proc = subprocess.run(
            ["skillspector", "scan", str(target), "--no-llm", "--format", "json"],
            capture_output=True,
            text=True,
            check=False,
        )
    # Exit 1 means a high score, not a failure; 2 is a real error.
    if proc.returncode == 2:
        raise RuntimeError((proc.stderr or proc.stdout or "scan failed").strip()[:300])
    data = json.loads(proc.stdout)
    risk = data.get("risk_assessment") or {}
    # Single-file components were staged as SKILL.md; report the real name.
    staged_main = None
    if component_type not in ("skills", "mods") and files[0].suffix == ".md":
        staged_main = files[0].name
    issues = sorted(
        data.get("issues") or [],
        key=lambda i: (SEVERITY_RANK.get((i.get("severity") or "LOW").upper(), 9), -(i.get("confidence") or 0)),
    )
    # The same rule often fires on many lines; show each (rule, file) once.
    findings: dict = {}
    for issue in issues:
        f = _finding(issue, staged_main)
        key = (f["id"], f["title"], f["file"])
        if key in findings:
            findings[key]["count"] += 1
        else:
            f["count"] = 1
            findings[key] = f
    return {
        "score": int(risk.get("score") or 0),
        "severity": (risk.get("severity") or "LOW").upper(),
        "recommendation": risk.get("recommendation") or "SAFE",
        "issueCount": len(issues),
        # "partial" when some analysis could not run (e.g. a referenced file
        # is not bundled); SkillSpector then says CAUTION even at score 0.
        "analysis": (data.get("analysis_completeness") or {}).get("status") or "",
        "findings": list(findings.values())[:MAX_FINDINGS],
    }


def previous_results(catalog_path: str = "docs/components.json") -> dict:
    """Map "type/path" -> skillspector object from the last generated catalog."""
    try:
        with open(catalog_path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    out = {}
    for ctype, items in data.items():
        if not isinstance(items, list):
            continue
        for c in items:
            if isinstance(c, dict) and c.get("skillspector") and c.get("path"):
                out[f"{ctype}/{c['path']}"] = c["skillspector"]
    return out


def attach_skillspector(components_data: dict, catalog_path: str = "docs/components.json",
                        only: set[str] | None = None, workers: int | None = None) -> None:
    """Set component['skillspector'] on every component, scanning only stale ones.

    `only` limits fresh scans to these "type/path" keys (used to try the
    pipeline on a few components) and always rescans them; everything else
    keeps its cached result.
    """
    cache = previous_results(catalog_path)
    version = skillspector_version()
    if version is None:
        print("⚠️ skillspector not on PATH: keeping previous SkillSpector results")

    todo = []
    for ctype in SCANNED_TYPES:
        for c in components_data.get(ctype, []):
            key = f"{ctype}/{c['path']}"
            try:
                root, files = source_files(ctype, c)
                digest = content_hash(root, files)
            except OSError:
                continue
            prev = cache.get(key)
            fresh = prev and prev.get("hash") == digest and (version is None or prev.get("version") == version)
            if only is not None:
                # Trial runs rescan exactly the listed components.
                fresh = key not in only
            if fresh or version is None:
                # A stale result is better than none until it is rescanned.
                if prev:
                    c["skillspector"] = prev
                continue
            todo.append((ctype, c, root, files, digest, key))

    if not todo:
        return
    print(f"🛡️  SkillSpector {version}: scanning {len(todo)} new or changed components...")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def run(job):
        ctype, c, root, files, digest, key = job
        try:
            result = scan(ctype, c, root, files)
        except Exception as e:  # one broken component never aborts the batch
            print(f"  ⚠️ {key}: {e}")
            return
        result.update({"hash": digest, "version": version, "scannedAt": now})
        c["skillspector"] = result

    with ThreadPoolExecutor(max_workers=workers or os.cpu_count() or 2) as pool:
        for i, _ in enumerate(pool.map(run, todo), 1):
            if i % 50 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)} scanned")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        p = Path(arg)
        rel = p.relative_to(COMPONENTS_ROOT)
        ctype = rel.parts[0]
        path = "/".join(rel.parts[1:])
        name = p.stem if p.is_file() else p.name
        comp = {"name": name, "path": path, "description": ""}
        root, files = source_files(ctype, comp)
        print(arg, json.dumps(scan(ctype, comp, root, files), indent=1))
