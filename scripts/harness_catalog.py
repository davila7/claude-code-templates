#!/usr/bin/env python3
"""Agent compatibility for every skill, from NVIDIA SkillEvaluator's Harness Check.

`skillevaluator harness-check DIR` (Apache-2.0, no API key, no agent run) reads a
skill and says, from each agent's documented loading rules, whether Claude Code,
Codex, Copilot CLI, OpenCode, Hermes and OpenClaw load it as written, load it
with part of the text changed ("degraded"), or do not load it at all.

Two uses:

* generate_components_json.py calls attach_harness() after it has built the
  catalog. Each skill gets a `harness` object that the component page shows in
  its "Compatibility" tab. Results are cached in the previous
  docs/components.json by file hash + SkillEvaluator version, like SkillSpector,
  so a run only checks new or changed skills. Without the `skillevaluator` CLI
  on PATH every skill keeps its previous result (or none).
* skill-security-scan.yml runs `harness_catalog.py --changed` on a PR and posts
  the Markdown report as a comment. It never fails the PR.

The signal is display-only: it never changes ordering, search or ranking.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import external_skills
from skillspector_catalog import content_hash, source_files
from skillspector_scan import discover_changed_skills

# Agents in the order the page shows them.
AGENT_NAMES = {
    "claude-code": "Claude Code",
    "codex": "Codex",
    "copilot-cli": "Copilot CLI",
    "opencode": "OpenCode",
    "hermes": "Hermes",
    "openclaw": "OpenClaw",
}

# A slow skill must not hold up a catalog run or a PR.
TIMEOUT_SECONDS = 120

COMMENT_MARKER = "<!-- harness-check-report:v1 -->"
MAX_COMMENT_CHARS = 60000


def skillevaluator_version() -> str | None:
    if not shutil.which("skillevaluator"):
        return None
    try:
        out = subprocess.run(
            ["skillevaluator", "--version"], capture_output=True, text=True, check=False, timeout=60
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    # "skillevaluator, version 1.0.1"
    return out.strip().split()[-1] if out.strip() else None


def check(directory: Path) -> list[dict]:
    """Run Harness Check on one skill directory; return one entry per agent.

    Each entry keeps the agent id, its status, the agent release the rule was
    verified on, and the notes that change what the agent receives (advisory
    notes, such as "restart to pick up edits", are left out).
    """
    with tempfile.TemporaryDirectory(prefix="harness-") as tmp:
        out = Path(tmp) / "harness.json"
        proc = subprocess.run(
            ["skillevaluator", "harness-check", str(directory), "--json", str(out)],
            capture_output=True,
            text=True,
            check=False,
            timeout=TIMEOUT_SECONDS,
        )
        if not out.is_file():
            raise RuntimeError((proc.stderr or proc.stdout or "harness-check wrote no report").strip()[-300:])
        data = json.loads(out.read_text(encoding="utf-8"))
    by_path = data.get("harness_compatibility") or {}
    if len(by_path) != 1:
        raise RuntimeError(f"expected one skill in the report, got {len(by_path)}")
    entries = next(iter(by_path.values()))
    agents = []
    for entry in entries:
        agent = entry.get("harness") or ""
        notes = [
            {
                "id": f.get("id") or "",
                "effect": f.get("effect") or "",
                "message": f.get("message") or "",
                "fix": f.get("fix") or "",
            }
            for f in entry.get("findings") or []
            if f.get("effect") and f.get("effect") != "advisory"
        ]
        agents.append({
            "id": agent,
            "status": entry.get("status") or "",
            "verified": str(entry.get("verified_version") or "").split(" ")[0],
            "notes": notes,
        })
    order = list(AGENT_NAMES)
    agents.sort(key=lambda a: order.index(a["id"]) if a["id"] in order else len(order))
    return agents


def skill_dir(directory: Path) -> Path:
    """The folder to check: an external skill is checked at its pinned commit."""
    if external_skills.is_external(directory):
        return external_skills.local_dir(directory.resolve())
    return directory


def previous_results(catalog_path: str = "docs/components.json") -> dict:
    """Map skill path -> harness object from the last generated catalog."""
    try:
        with open(catalog_path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    return {
        c["path"]: c["harness"]
        for c in data.get("skills") or []
        if isinstance(c, dict) and c.get("harness") and c.get("path")
    }


def attach_harness(components_data: dict, catalog_path: str = "docs/components.json",
                   workers: int | None = None, scan_enabled: bool = True) -> None:
    """Set skill['harness'] on every skill, checking only new or changed ones."""
    cache = previous_results(catalog_path)
    version = skillevaluator_version() if scan_enabled else None
    if version is None and scan_enabled:
        print("⚠️ skillevaluator not on PATH: keeping previous Harness Check results")

    todo = []
    for c in components_data.get("skills", []):
        prev = cache.get(c["path"])
        try:
            root, files = source_files("skills", c)
            digest = content_hash(root, files)
        except (OSError, ValueError, external_skills.ManifestError):
            if prev:
                c["harness"] = prev
            continue
        fresh = prev and prev.get("hash") == digest and prev.get("version") == version
        if fresh or version is None:
            # A stale result is better than none until it is checked again.
            if prev:
                c["harness"] = prev
            continue
        todo.append((c, root, digest, prev))

    if not todo:
        return
    print(f"🧩 SkillEvaluator {version} Harness Check: {len(todo)} new or changed skills...")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def run(job):
        c, root, digest, prev = job
        try:
            agents = check(root)
        except Exception as e:  # one broken skill never aborts the batch
            print(f"  ⚠️ skills/{c['path']}: {e}")
            if prev:
                c["harness"] = prev
            return
        c["harness"] = {"agents": agents, "version": version, "checkedAt": now, "hash": digest}

    with ThreadPoolExecutor(max_workers=workers or os.cpu_count() or 2) as pool:
        for i, _ in enumerate(pool.map(run, todo), 1):
            if i % 100 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)} checked")


def _md(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def build_markdown(results: list[dict], version: str | None) -> str:
    lines = [COMMENT_MARKER, "## Agent compatibility (NVIDIA SkillEvaluator Harness Check)", ""]
    if not results:
        lines.append("No changed skills to check.")
        return "\n".join(lines) + "\n"
    rows, clean, failed = [], [], []
    for r in results:
        if r.get("error"):
            failed.append(r)
            continue
        changed = [a for a in r["agents"] if a["status"] != "loads"]
        if not changed:
            clean.append(r["path"])
        for a in changed:
            name = AGENT_NAMES.get(a["id"], a["id"])
            agent = f"{name} {a['verified']}".strip()
            for n in a["notes"] or [{"message": a["status"], "fix": ""}]:
                why = _md(n["message"]) + (f" Fix: {_md(n['fix'])}" if n.get("fix") else "")
                rows.append(f"| `{r['path']}` | {agent} | {a['status'].replace('_', ' ')} | {why} |")
    checked = len(results) - len(failed)
    lines.append(f"Checked {checked} changed skill{'s' if checked != 1 else ''} against how six agents load skills. "
                 "This check is informational and never blocks the merge.")
    lines.append("")
    if rows:
        lines += ["| Skill | Agent | Result | Why · fix |", "| --- | --- | --- | --- |", *rows, ""]
    if clean:
        lines.append("Loads unchanged in all six agents: " + ", ".join(f"`{p}`" for p in clean) + ".")
        lines.append("")
    if failed:
        lines.append("Could not be checked (the PR is not affected): "
                     + ", ".join(f"`{r['path']}` ({_md(r['error'])})" for r in failed) + ".")
        lines.append("")
    lines.append(f"<sub>[NVIDIA SkillEvaluator](https://github.com/NVIDIA/SkillEvaluator)"
                 f"{' ' + version if version else ''} · `skillevaluator harness-check`</sub>")
    body = "\n".join(lines) + "\n"
    if len(body) > MAX_COMMENT_CHARS:
        body = body[:MAX_COMMENT_CHARS] + "\n\n_Report truncated; see the workflow artifact._\n"
    return body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("paths", nargs="*", type=Path, help="Skill directories to check.")
    parser.add_argument("--changed", action="store_true", help="Check the skills changed vs --base-ref.")
    parser.add_argument("--base-ref", default="origin/main")
    parser.add_argument("--output-md", default="harness-report.md")
    args = parser.parse_args()

    dirs = discover_changed_skills(args.base_ref) if args.changed else args.paths
    version = skillevaluator_version()
    results = []
    for d in dirs:
        r = {"path": str(d).removeprefix("cli-tool/components/skills/")}
        try:
            if version is None:
                raise RuntimeError("skillevaluator is not installed")
            r["agents"] = check(skill_dir(d))
        except Exception as e:
            r["error"] = str(e)[:200]
        results.append(r)
    Path(args.output_md).write_text(build_markdown(results, version), encoding="utf-8")
    print(Path(args.output_md).read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
